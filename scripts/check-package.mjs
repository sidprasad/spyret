/** Test the real packed artifact in an isolated consumer. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-package-'));
const outIndex = process.argv.indexOf('--out');
const destination = outIndex < 0 ? scratch : path.resolve(process.argv[outIndex + 1]);
fs.mkdirSync(destination, { recursive: true });
try {
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], { encoding: 'utf8' }));
  const files = new Set(packed.files.map(f => f.path));
  for (const file of ['dist/spyret.js', 'dist/spyret.mjs', 'dist/spyret.global.js', 'dist/spyret.d.ts', 'dist/spyret.d.mts', 'dist/spyret-browser.js', 'dist/spyret-browser.mjs', 'dist/spyret-browser.d.ts', 'dist/spyret-browser.d.mts', 'dist/spyret-browser.amd.js', 'dist/spyret.pyret.js', 'pyret/spytial.arr', 'LICENSE', 'THIRD_PARTY_NOTICES.txt']) assert.ok(files.has(file), `Missing ${file}`);
  assert.ok([...files].every(f => /^(dist\/|docs\/|pyret\/|package.json$|README.md$|LICENSE$|THIRD_PARTY_NOTICES.txt$)/.test(f)), 'Unexpected package contents');
  const consumer = path.join(scratch, 'consumer'); fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(destination, packed.filename)], { cwd: consumer, stdio: 'pipe' });
  const installed = JSON.parse(fs.readFileSync(path.join(consumer, 'node_modules/spyret/package.json'), 'utf8'));
  assert.deepEqual(Object.keys(installed.dependencies || {}), ['@types/graphlib']);
  assert.deepEqual(installed.peerDependencies || {}, {});
  assert.ok(!fs.existsSync(path.join(consumer, 'node_modules/spytial-core')), 'Consumer must not require unreleased Core');
  const smoke = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import vm from 'node:vm';
    import { createRequire } from 'node:module';
    import * as esm from 'spyret';
    import * as browser from 'spyret/browser';
    const require = createRequire(import.meta.url);
    const cjs = require('spyret');
    assert.equal(typeof browser.createPyretModule, 'function');
    assert.equal(typeof require('spyret/browser').createPyretModule, 'function');
    const native = vm.runInNewContext(fs.readFileSync(require.resolve('spyret/pyret-module'), 'utf8'));
    assert.equal(native.nativeRequires.length, 0);
    assert.equal(native.provides.values.show[0], 'arrow');
    assert.match(fs.readFileSync(require.resolve('spyret/spytial.arr'), 'utf8'), /data SpytialRule:/);
    const realm = vm.createContext({});
    vm.runInContext(fs.readFileSync(require.resolve('spyret/global'), 'utf8'), realm);
    for (const api of [esm, cjs, realm.Spyret]) {
      const value = { flag: true }; value.self = value;
      const adapter = { observe: v => typeof v === 'object'
        ? { kind: 'object', fields: Object.entries(v) } : { kind: 'primitive', value: v } };
      const snapshot = api.capturePyret([{ name: 'a', value }, { name: 'b', value }], adapter);
      const imported = api.importPyretCapture(JSON.parse(JSON.stringify(snapshot)));
      const a = imported.values.get('a');
      assert.equal(a, imported.values.get('b'));
      assert.equal(a.dict.self, a);
      assert.equal(a.dict.flag, true);
      assert.equal(imported.instance.generateGraph().nodeCount(), imported.instance.getAtoms().length);
      assert.equal(typeof api.prepareDiagram, 'function');
      assert.equal(typeof api.getSpytialSpec, 'function');
      assert.equal(typeof api.spytialRulesToYaml, 'function');
    }
    assert.equal(typeof window, 'undefined');
    console.log('Packed CJS, ESM and browser APIs preserve sharing/cycles without Core');
  `;
  fs.writeFileSync(path.join(consumer, 'smoke.mjs'), smoke);
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  const useTypes = `
    const data = new spyret.PyretDataInstance(42);
    const label: string = data.getAtoms()[0].label;
    const graph = data.generateGraph();
    const count: number = graph.nodeCount();
    const source: string = spyret.replit(data);
    const adapter: spyret.PyretRuntimeAdapter = { observe: () => ({kind: 'primitive', value: true}) };
    const snapshot = spyret.capturePyret([{name: 'n', value: 1}], adapter);
    const restored = spyret.importPyretCapture(snapshot);
    const id: string = restored.instance.getAtoms()[0].id;
    declare const runtime: spyret.SpytialRuntime;
    const specs: Promise<string[]> = spyret.getSpytialSpec(42, runtime);
    const yaml: string = spyret.spytialRulesToYaml(null, runtime);
  `;
  fs.writeFileSync(path.join(consumer, 'types.mts'), "import * as spyret from 'spyret';\nimport { combineSpytialSpecs, type BrowserHost } from 'spyret/browser';\nconst spec: string = combineSpytialSpecs([]);\n" + useTypes);
  fs.writeFileSync(path.join(consumer, 'types.cts'), "import spyret = require('spyret');\n" + useTypes);
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--typeRoots', path.join(consumer, 'node_modules/@types'), 'types.mts', 'types.cts'], { cwd: consumer, stdio: 'inherit' });
  console.log(`Packed declarations compile using only declared dependencies: ${packed.filename}`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
