import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const core = JSON.parse(fs.readFileSync('node_modules/spytial-core/package.json', 'utf8'));
const notices = [
  `Spyret's adapter helpers and data contracts originate in Spytial-Core.\nAuthor: ${core.author}\nLicense: ${core.license} (declared by the source package)\nSource: https://github.com/sidprasad/spytial-core\nContracts verified against spytial-core ${pkg.devDependencies['spytial-core']}.\nNo Core runtime or renderer is included.`,
  ...['graphlib', 'lodash', 'js-yaml'].map(name => `${name}\n\n${fs.readFileSync(`node_modules/${name}/LICENSE`, 'utf8')}`),
];
fs.writeFileSync('THIRD_PARTY_NOTICES.txt', notices.join('\n\n---\n\n') + '\n');
