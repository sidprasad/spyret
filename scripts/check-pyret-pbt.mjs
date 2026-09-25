/** Standard-Pyret properties, compiled and executed in Node without an IDE. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import values from '../tests/fixtures/values.cjs';
import constructors from '../tests/fixtures/constructors.cjs';
import { PyretDataInstance, replit } from '../dist/spyret.mjs';

if (!process.argv[2]) throw new Error('Supply a built standard Pyret lang/ checkout');
const root = path.resolve(process.argv[2]);
const seed = Number(process.env.REIFY_SEED || 1);
const runs = Number(process.env.REIFY_FUZZ_RUNS || 100);
if (!Number.isInteger(seed) || !Number.isSafeInteger(runs) || runs < 1) throw new Error('Invalid seed/run count');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-pbt-'));
fs.symlinkSync(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
const builtins = path.join(output, 'builtins');
fs.mkdirSync(builtins);
for (const name of fs.readdirSync(path.join(root, 'src/js/trove'))) {
  fs.symlinkSync(path.join(root, 'src/js/trove', name), path.join(builtins, name));
}
const records = path.join(output, 'captures.jsonl');
const bundle = fileURLToPath(new URL('../dist/spyret.js', import.meta.url));
fs.writeFileSync(path.join(builtins, 'capture-test.js'), `({
  requires: [], nativeRequires: [${JSON.stringify(bundle)}, "fs"],
  provides: { values: { capture: ["arrow", ["String", "Any", "String"], "Nothing"] } },
  theModule: function(runtime, namespace, uri, library, fs) {
    return runtime.makeModuleReturn({ capture: runtime.makeFunction(function(id, value, repr) {
      if (typeof runtime.ffi.isVSConstrRender !== "undefined") throw new Error("Expected standard Pyret");
      var snapshot = library.capturePyret([{name: "value", value: value}], library.createPyretRuntimeAdapter(runtime));
      fs.appendFileSync(${JSON.stringify(records)}, JSON.stringify({id: id, repr: repr, snapshot: snapshot}) + "\\n");
      return runtime.nothing;
    }) }, {});
  }
})`);
let groupId = 0;
let checked = 0;
const evidence = [];
function run(source, name, checkMode) {
  const file = path.join(output, name + '.arr');
  fs.writeFileSync(file, source);
  const executable = path.join(output, name + '.jarr');
  const args = ['build/phaseA/pyret.jarr', '--outfile', path.relative(root, executable), '--build-runnable', file,
    '--builtin-js-dir', builtins, '--builtin-arr-dir', 'src/arr/trove',
    '--compiled-dir', path.join(output, 'compiled'), '--deps-file', 'build/phaseA/bundled-node-deps.js', '--require-config', 'src/scripts/standalone-configA.json'];
  if (!checkMode) args.push('-no-check-mode');
  try {
    execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024 });
    const stdout = execFileSync(process.execPath, [executable], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 20 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, name + '.log'), stdout);
    return stdout;
  } catch (error) {
    fs.writeFileSync(path.join(output, name + '.log'), String(error.stdout || '') + String(error.stderr || ''));
    throw error;
  }
}
function group(cases, prelude) {
  const id = groupId++;
  fs.writeFileSync(records, '');
  run('import capture-test as Capture\n' + prelude + '\n' + cases.map((expr, i) =>
    `block:\n spyret-input = ${expr}\n Capture.capture("${i}", spyret-input, torepr(spyret-input))\nend`).join('\n'), `producer-${id}`, false);
  const rows = fs.readFileSync(records, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s));
  assert.equal(rows.length, cases.length, 'Every fixture must produce a capture');
  assert.deepEqual(rows.map(r => r.id), cases.map((_, i) => String(i)));
  // This fresh process receives only snapshots: no runtime, original values,
  // expressions, declarations, expected inspection strings or producer caches.
  const sources = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { importPyretCapture, pyretCaptureSource } from ${JSON.stringify(new URL('../dist/spyret.mjs', import.meta.url).href)};
    assert.equal(typeof window, 'undefined');
    assert.equal(typeof globalThis.requirejs, 'undefined');
    let input = ''; for await (const chunk of process.stdin) input += chunk;
    const sources = JSON.parse(input).map(snapshot => {
      const { instance, snapshot: s } = importPyretCapture(snapshot);
      return pyretCaptureSource(instance, s.roots[0].atomId);
    });
    process.stdout.write(JSON.stringify(sources));
  `], { input: JSON.stringify(rows.map(r => r.snapshot)), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
  // Declarations and expected strings enter only after source reconstruction.
  const checks = sources.map((source, i) => `torepr(${source}) is ${replit(new PyretDataInstance(rows[i].repr))}`);
  const log = run(prelude + '\ncheck "portable capture inspection":\n' + checks.join('\n') + '\nend\n', `decoder-${id}`, true);
  assert.ok(log.includes(`all ${checks.length} tests passed`) || (checks.length === 1 && log.includes('your test passed')),
    `Pyret checks failed: ${output}/decoder-${id}.log\n${log}`);
  checked += checks.length;
  evidence.push({ group: id, cases: cases.length });
  console.log(`seed ${seed}: ${checked} exact Pyret checks passed`);
}
try {
  group(values.ROWS.filter(row => row.expect === 'supported').map(row => row.expr), values.PRELUDE);
  const fixed = constructors.fixtures();
  for (const prelude of new Set(fixed.map(row => row.prelude))) group(fixed.filter(row => row.prelude === prelude).map(row => row.expr), prelude);
  // Batch compilation keeps the test independent of an interactive evaluator.
  // fast-check still shrinks generated values within a failing batch.
  await fc.assert(fc.asyncProperty(fc.array(values.arbitraries(fc).value, { minLength: runs, maxLength: runs }),
    async expressions => group(expressions, values.PRELUDE)), { numRuns: 1, seed, verbose: true });
  const schema = constructors.schemaArbitrary(fc).chain(s => s.value.map(expr => ({ prelude: s.prelude, expressions: [...s.witnesses, expr] })));
  await fc.assert(fc.asyncProperty(fc.array(schema, { minLength: 20, maxLength: 20 }), async schemas => {
    for (const s of schemas) group(s.expressions, s.prelude);
  }), { numRuns: 1, seed, verbose: true });
  const report = { seed, generatedValues: runs, generatedDeclarations: 20, checks: checked,
    upstreamRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), groups: evidence };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  fs.rmSync(output, { recursive: true, force: true });
} catch (error) {
  console.error(`Reproduction artifacts retained at ${output}`);
  throw error;
}
