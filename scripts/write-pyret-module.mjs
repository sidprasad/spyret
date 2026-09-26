/** Package the same browser implementation for native Pyret and AMD hosts. */
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const bundle = fs.readFileSync('dist/spyret-browser.global.js', 'utf8');
const coreUrl = `https://cdn.jsdelivr.net/npm/spytial-core@${pkg.devDependencies['spytial-core']}/dist/browser/spytial-core-complete.global.js`;
const provides = { values: {
  // Pyret's native signature format has no optional-argument arrow.
  // The implementation checks the supported one- and two-argument forms.
  diagram: 'Any',
  'diagram-with-rules': ['arrow', ['Any', 'Any'], 'Any'],
  genlayout: ['arrow', ['Any', 'String'], 'Any'],
} };
fs.writeFileSync('dist/spyret.pyret.js', `// Spyret ${pkg.version}. Generated; upload this file to Google Drive as spyret.js.
({
  requires: [], nativeRequires: [],
  provides: ${JSON.stringify(provides)},
  theModule: function(runtime) {
    ${bundle}
    return SpyretBrowser.createCpoModule(runtime, document, ${JSON.stringify(coreUrl)});
  }
})\n`);
fs.writeFileSync('dist/spyret-browser.amd.js', `define('spyret/browser', [], function() {\n${bundle}\nreturn SpyretBrowser;\n});\n`);
