// Usage: node tests/browser-import/run.mjs /path/to/pyret-embed/dist
// Add --test for the browser smoke test; set PUPPETEER_MODULE and CHROME_PATH.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const here = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = path.resolve(here, '../..');
const coreVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/spytial-core/package.json'), 'utf8')).version;
if (!process.argv[2]) throw new Error('Supply the pyret-embed/dist directory');
const upstream = path.resolve(process.argv[2]);
const publicCpo = process.argv.includes('--public-cpo');
const driveMode = process.argv.includes('--drive') || publicCpo;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-drive-test-'));
if (driveMode) execFileSync(process.execPath, [path.join(root, 'scripts/make-drive-wrapper.mjs'), 'test-drive-module', path.join(scratch, 'spyret.arr')]);
const library = {
  '/spyret.arr': path.join(scratch, 'spyret.arr'),
  '/spyret-browser.js': path.join(root, 'dist/spyret.pyret.js'),
  '/library/spyret.mjs': path.join(root, 'dist/spyret.mjs'),
  '/library/spytial.arr': path.join(root, 'pyret/spytial.arr'),
  '/library/js-yaml.mjs': path.join(root, 'node_modules/js-yaml/dist/js-yaml.mjs'),
  '/library/spytial-core.js': path.join(root, 'node_modules/spytial-core/dist/browser/spytial-core-complete.global.js')
};
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (driveMode && name === '/example.arr') {
    const source = fs.readFileSync(path.join(here, 'example.arr'), 'utf8')
      .replace(/import file[^\n]+\nimport js-file[^\n]+/, 'import url("' + libraryOrigin + '/spyret.arr") as Spyret')
      .replaceAll('S.', 'Spyret.');
    return res.writeHead(200, {'Content-Type': 'text/plain'}).end(source);
  }
  const files = library[name] ? [library[name]] : [here, upstream, path.join(upstream, 'build/web')]
    .map(base => {
      const file = path.resolve(base, '.' + (name === '/' ? '/index.html' : name));
      return file.startsWith(base + path.sep) ? file : '';
    });
  const file = files.find(file => file && fs.existsSync(file) && fs.statSync(file).isFile());
  if (!file) {
    if (process.env.DEBUG) console.error('Not found:', name);
    return res.writeHead(404).end(name);
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const libraryOrigin = publicCpo ? 'https://spyret-library.test' : url;
console.log(url);
if (process.argv.includes('--test')) {
  let browser;
  try {
    const require = createRequire(import.meta.url);
    const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
    });
    const page = await browser.newPage();
    if (driveMode) {
      // Replace ONLY Drive transport; the upstream gdrive-js locator, compiler,
      // native module evaluation and display code all remain real.
      await page.evaluateOnNewDocument(moduleUrl => {
        let storage;
        Object.defineProperty(window, 'storageAPI', { configurable: true,
          set() {}, get() {
            if (!storage) storage = window.Q({
              getFileById(id) {
                if (id !== 'test-drive-module') throw new Error('Unexpected Drive ID');
                return window.Q({ getName: () => 'spyret.js', getUniqueId: () => id,
                  getContents: () => window.Q(fetch(moduleUrl).then(response => response.text())) });
              }
            });
            return storage;
          }
        });
      }, libraryOrigin + '/spyret-browser.js');
    }
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (request.url().startsWith('https://spyret-library.test/')) {
        const response = await fetch(url + new URL(request.url()).pathname);
        return request.respond({ status: response.status, contentType: response.headers.get('content-type'),
          headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(await response.arrayBuffer()) });
      }
      if (request.url() === `https://cdn.jsdelivr.net/npm/spytial-core@${coreVersion}/dist/browser/spytial-core-complete.global.js`) {
        return request.respond({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(library['/library/spytial-core.js']) });
      }
      return request.continue();
    });
    const browserErrors = [];
    await page.setViewport({ width: 1500, height: 1100 });
    page.on('pageerror', error => { browserErrors.push(String(error)); console.error('Browser error:', String(error)); });
    page.on('console', msg => {
      if (process.env.DEBUG || ['error', 'warn'].includes(msg.type())) console.error(msg.type(), msg.text());
    });
    page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()));
    await page.goto(publicCpo ? 'https://code.pyret.org/editor' : url);
    let frame;
    if (publicCpo) {
      frame = page.mainFrame();
      await frame.waitForFunction(() => window.CPO && CPO.editor && !document.querySelector('#runButton').disabled,
        { timeout: 90000 });
      const source = await (await fetch(url + '/example.arr')).text();
      await frame.evaluate(source => CPO.editor.cm.setValue(source), source);
    } else {
      try {
        await page.waitForFunction(() => window.embedAPI, { timeout: 60000 });
      } catch (error) {
        await page.screenshot({ path: '/tmp/spyret-import-startup.png' });
        console.error(await page.evaluate(() => document.body.innerText));
        throw error;
      }
      console.log('Embed initialized');
      frame = page.frames().find(frame => frame.url().includes('editor.embed.html'));
    }
    await frame.waitForSelector('#runButton:not([disabled])', { timeout: 60000 });
    for (let run = 0; run < (publicCpo ? 1 : 2); run++) {
      if (publicCpo) await frame.click('#runButton');
      else await page.evaluate(() => window.embedAPI.runDefinitions());
      try {
        await frame.waitForFunction(() => {
          if (document.querySelector('#output .compile-error, #output .error, .spyret-diagram[data-error]')) {
            throw new Error(document.querySelector('#output').innerText);
          }
          return document.querySelectorAll('.spyret-diagram[data-rendered="true"][data-settled="true"]').length === 3;
        },
          { timeout: 120000 });
      } catch (error) {
        console.error(await frame.evaluate(() => document.querySelector('#output')?.innerText));
        throw error;
      }
      const state = await frame.evaluate(() => {
        const views = [...document.querySelectorAll('.spyret-diagram')];
        return {
          specs: views.map(view => view.dataset.specCount),
          graphs: views.map(view => {
            const graph = view.querySelector('webcola-cnd-graph');
            return {
              svgs: (graph.shadowRoot || graph).querySelectorAll('svg').length,
              positions: graph.getNodePositions(),
              height: graph.getBoundingClientRect().height
            };
          }),
          images: document.querySelectorAll('#output canvas').length,
          text: document.querySelector('#output').innerText
        };
      });
      assert.deepEqual(state.specs, ['1', '0', '1']);
      assert.ok(state.graphs.every(graph => graph.svgs > 0 && graph.height === 400 &&
        graph.positions.length > 0 && graph.positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))),
      'All diagrams must have visible SVGs and finite node positions');
      assert.ok(state.images > 0, 'Stock image renderer must still work');
      assert.match(state.text, /42/);
      // Let Core's fit transition finish before exercising its zoom control.
      await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
      const before = await frame.$eval('webcola-cnd-graph', graph => graph.getCurrentTransform().k);
      await frame.$eval('webcola-cnd-graph', graph => graph.shadowRoot.querySelector('#zoom-in').click());
      await frame.waitForFunction(before => document.querySelector('webcola-cnd-graph').getCurrentTransform().k > before, {}, before);
      await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
      await frame.click('.spyret-diagram > button');
      assert.equal(await frame.$eval('.spyret-diagram', view => view.querySelectorAll('webcola-cnd-graph').length), 0);
      await frame.click('.spyret-diagram > button');
      await frame.waitForFunction(() => document.querySelectorAll('.spyret-diagram[data-settled="true"]').length === 3);
      console.log('Run ' + (run + 1) + ': typed hook, no hook, explicit YAML bypass, finite graph positions, image, number, zoom passed');
      if (run === 0 && !publicCpo) {
        await page.evaluate(() => window.embedAPI.clearInteractions());
        await frame.waitForFunction(() => document.querySelectorAll('.spyret-diagram').length === 0);
      }
    }
    await frame.$eval('webcola-cnd-graph', graph => graph.resetViewToFitContent());
    await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
    const screenshot = process.env.SCREENSHOT || '/tmp/spyret-import-poc.png';
    await page.screenshot({ path: screenshot });
    assert.deepEqual(browserErrors, [], 'Browser must have no uncaught exceptions');
    console.log('Screenshot: ' + screenshot);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
