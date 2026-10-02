/** Compile the generated API with upstream Pyret and run hooks on its stack. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseLayoutSpec } from 'spytial-core';

if (!process.argv[2]) throw new Error('Supply a built Pyret language checkout');
const root = path.resolve(process.argv[2]);
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-spytial-'));
try {
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
  const builtins = path.join(output, 'builtins'); fs.mkdirSync(builtins);
  for (const name of fs.readdirSync(path.join(root, 'src/js/trove'))) {
    fs.symlinkSync(path.join(root, 'src/js/trove', name), path.join(builtins, name));
  }
  const destination = path.join(output, 'specs.json');
  const bundle = fileURLToPath(new URL('../dist/spyret.js', import.meta.url));
  fs.writeFileSync(path.join(builtins, 'spec-test.js'), `({
    requires: [], nativeRequires: [${JSON.stringify(bundle)}, "fs"],
    provides: { values: {
      collect: ["arrow", ["String", "Any"], "Nothing"],
      reject: ["arrow", ["String", "Any"], "Nothing"],
      pause: ["arrow", [], "Nothing"]
    } },
    theModule: function(runtime, namespace, uri, library, fs) {
      var results = {};
      function check(name, value, shouldReject) {
        // Capturing must never invoke the hook, including hooks that throw.
        library.toDataInstance(value, runtime);
        return runtime.pauseStack(function(restarter) {
          library.getSpytialSpec(value, runtime).then(function(specs) {
            if (shouldReject) return restarter.error(new Error('Expected rejection: ' + name));
            results[name] = specs;
            fs.writeFileSync(${JSON.stringify(destination)}, JSON.stringify(results));
            restarter.resume(runtime.nothing);
          }, function(error) {
            if (!shouldReject) return restarter.error(error);
            results[name] = String(error);
            fs.writeFileSync(${JSON.stringify(destination)}, JSON.stringify(results));
            restarter.resume(runtime.nothing);
          });
        });
      }
      return runtime.makeModuleReturn({
        collect: runtime.makeFunction(function(name, value) { return check(name, value, false); }),
        reject: runtime.makeFunction(function(name, value) { return check(name, value, true); }),
        pause: runtime.makeFunction(function() {
          return runtime.pauseStack(function(restarter) {
            setTimeout(function() { restarter.resume(runtime.nothing); }, 0);
          });
        })
      }, {});
    }
  })`);
  fs.copyFileSync(fileURLToPath(new URL('../pyret/spytial.arr', import.meta.url)), path.join(output, 'spytial.arr'));
  fs.copyFileSync(fileURLToPath(new URL('./fixtures/spytial-rules.arr', import.meta.url)), path.join(output, 'spytial-rules.arr'));
  const executable = path.join(output, 'program.jarr');
  execFileSync(process.execPath, ['build/phaseA/pyret.jarr', '--outfile', path.relative(root, executable), '--build-runnable', path.join(output, 'spytial-rules.arr'),
    '--builtin-js-dir', builtins, '--builtin-arr-dir', 'src/arr/trove', '--compiled-dir', path.join(output, 'compiled'),
    '--deps-file', 'build/phaseA/bundled-node-deps.js', '-no-check-mode',
    '--require-config', 'src/scripts/standalone-configA.json'], { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024 });
  execFileSync(process.execPath, [executable], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
  const results = JSON.parse(fs.readFileSync(destination, 'utf8'));
  for (const name of ['nested', 'dict', 'table', 'tuple']) {
    assert.equal(results[name].length, 2, `${name}: shared type hook must run once`);
    for (const yaml of results[name]) assert.ok(parseLayoutSpec(yaml));
  }
  assert.match(results.nested[0], /orientation/);
  assert.match(results.nested[0], /atomStyle/);
  assert.match(results.nested[0], /edgeStyle/);
  assert.match(results.nested[0], /dashed/);
  assert.match(results.nested[1], /0.5/);
  assert.deepEqual(results.raw, ['directives: []']);
  assert.match(results['short-enum'][0], /right/);
  assert.match(results['sparse-style'][0], /atomStyle/);
  assert.match(results['sparse-style'][0], /"selector": "leaf"/);
  assert.match(results['sparse-style'][0], /"showLabel": false/);
  assert.doesNotMatch(results['sparse-style'][0], /fillStyle|borderStyle|iconStyle|textStyle/);
  const plainEdge = parseLayoutSpec(results['inferred-default'][0]).directives.inferredEdges[0];
  const styledEdge = parseLayoutSpec(results['inferred-styled'][0]).directives.inferredEdges[0];
  assert.equal(plainEdge.name, 'value');
  assert.equal(styledEdge.selector, '(branch + leaf) <: (value.target)');
  assert.equal(styledEdge.color, '#2563eb');
  assert.equal(styledEdge.style, 'dashed');
  assert.equal(styledEdge.weight, 2);
  assert.deepEqual(styledEdge.textStyle, { color: '#1e3a8a', size: 'small' });
  assert.doesNotMatch(results['inferred-default'][0], /lineStyle|textStyle/);
  assert.equal(results.paused.length, 1);
  assert.match(results.paused[0], /hideField/);
  assert.equal(results.empty.length, 1);
  assert.deepEqual(results['no-hooks'], []);
  for (const name of ['invalid-return', 'invalid-size', 'unknown-style-field', 'wrong-style-block', 'throws', 'wrong-rule-type', 'wrong-wrapper', 'missing-required-field', 'unknown-rule-field']) {
    assert.match(results[name], /_spytial/);
  }
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(results, null, 2) + '\n');
  console.log('Compiled Spytial API: typed composition, nested collections, deduplication, cycles, yielding hooks and errors passed');
} finally { fs.rmSync(output, { recursive: true, force: true }); }
