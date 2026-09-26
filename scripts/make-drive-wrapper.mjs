/** One Pyret import for both the generated rules and the Drive-hosted native module. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function makeDriveWrapper(driveId, destination, nativeName = 'spyret.js',
  rulesSource = fileURLToPath(new URL('../pyret/spytial.arr', import.meta.url))) {
  if (!/^[A-Za-z0-9_-]+$/.test(driveId) || !destination ||
      !/^spyret(?:-v[0-9A-Za-z.-]+)?\.js$/.test(nativeName)) {
    throw new Error('Usage: node scripts/make-drive-wrapper.mjs DRIVE_FILE_ID OUTPUT.arr [NATIVE_NAME.js] [RULES_SOURCE.arr]');
  }
  const rules = fs.readFileSync(rulesSource, 'utf8');
  const marker = 'provide-types *\n';
  if (!rules.includes(marker)) throw new Error('Pyret rules must provide their types');
  fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
  fs.writeFileSync(destination, rules.replace(marker, marker +
    `import gdrive-js(${JSON.stringify(nativeName)}, ${JSON.stringify(driveId)}) as NativeSpyret\n`) + `
# Native module hosted on Google Drive; this wrapper can be served over HTTPS.
diagram = NativeSpyret.diagram
diagram-with-rules = NativeSpyret.diagram-with-rules
genlayout = NativeSpyret.genlayout
`);
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [driveId, destination, nativeName, rulesSource] = process.argv.slice(2);
  console.log('Wrote ' + makeDriveWrapper(driveId, destination, nativeName, rulesSource));
}
