/** One Pyret import for both the generated rules and the Drive-hosted native module. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [driveId, destination] = process.argv.slice(2);
if (!driveId || !/^[A-Za-z0-9_-]+$/.test(driveId) || !destination) {
  throw new Error('Usage: node scripts/make-drive-wrapper.mjs DRIVE_FILE_ID OUTPUT.arr');
}
const rules = fs.readFileSync(fileURLToPath(new URL('../pyret/spytial.arr', import.meta.url)), 'utf8');
fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
fs.writeFileSync(destination, rules.replace('provide-types *\n', 'provide-types *\n' +
  `import gdrive-js("spyret.js", ${JSON.stringify(driveId)}) as NativeSpyret\n`) + `
# Native module hosted on Google Drive; this wrapper can be served over HTTPS.
show = NativeSpyret.show
diagram = NativeSpyret.diagram
diagram-with-rules = NativeSpyret.diagram-with-rules
genlayout = NativeSpyret.genlayout
`);
console.log('Wrote ' + destination);
