/** Download a published package and guide its manual upload to Google Drive. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { makeDriveWrapper } from './make-drive-wrapper.mjs';

const repo = 'sidprasad/spyret';

export function driveFileId(input) {
  let id = input.trim();
  if (id.startsWith('https://')) {
    const url = new URL(id);
    if (url.hostname !== 'drive.google.com') throw new Error('Paste a Google Drive file link or file ID.');
    id = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ||
      (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : '');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(id || '')) throw new Error('Paste a Google Drive file link or file ID.');
  return id;
}

function writeUnchangedOrNew(filename, contents) {
  const bytes = Buffer.from(contents);
  if (fs.existsSync(filename)) {
    if (!fs.readFileSync(filename).equals(bytes)) {
      throw new Error(`${filename} already has different contents. Use a new --out directory.`);
    }
  } else {
    fs.writeFileSync(filename, bytes, { flag: 'wx' });
  }
}

export function prepareDriveRelease({ tag, output = 'release', run = execFileSync } = {}) {
  const metadata = JSON.parse(run('gh', ['release', 'view', ...(tag ? [tag] : []),
    '--repo', repo, '--json', 'tagName,assets'], { encoding: 'utf8' }));
  const version = metadata.tagName.match(/^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/)?.[1];
  if (!version) throw new Error(`Unsupported release tag: ${metadata.tagName}`);
  const packageName = `spyret-${version}.tgz`;
  if (!metadata.assets.some(asset => asset.name === packageName)) {
    throw new Error(`Release ${metadata.tagName} has no ${packageName} package asset.`);
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-release-'));
  try {
    run('gh', ['release', 'download', metadata.tagName, '--repo', repo,
      '--pattern', packageName, '--dir', scratch], { stdio: 'pipe' });
    const archive = path.join(scratch, packageName);
    // Read only these archive members; never extract arbitrary paths or run package code.
    const read = member => run('tar', ['-xOzf', archive, `package/${member}`],
      { maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const pkg = JSON.parse(read('package.json').toString());
    if (pkg.name !== 'spyret' || pkg.version !== version) throw new Error('Release tag and package do not match.');
    let native, rules;
    try {
      native = read('dist/spyret.pyret.js');
      rules = read('pyret/spytial.arr');
    } catch {
      throw new Error(`Release ${metadata.tagName} does not contain the Pyret browser module and rules. ` +
        'Publish a browser-capable release (v0.2.0 or later), then rerun this command.');
    }
    if (!native.length || !rules.toString().includes('provide-types *\n')) {
      throw new Error('The released browser module or Pyret rules are incomplete.');
    }
    const directory = path.resolve(output, metadata.tagName);
    const upload = path.join(directory, 'upload');
    fs.mkdirSync(upload, { recursive: true });
    const stem = `spyret-${metadata.tagName}`;
    const nativePath = path.join(upload, `${stem}.js`);
    const rulesPath = path.join(directory, 'spytial.arr');
    writeUnchangedOrNew(nativePath, native);
    writeUnchangedOrNew(rulesPath, rules);
    return { directory, nativePath, rulesPath, wrapperPath: path.join(upload, `${stem}.arr`) };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

export function prepareWrapper(release, nativeId) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-wrapper-'));
  try {
    const wrapper = path.join(scratch, 'wrapper.arr');
    makeDriveWrapper(driveFileId(nativeId), wrapper, path.basename(release.nativePath), release.rulesPath);
    writeUnchangedOrNew(release.wrapperPath, fs.readFileSync(wrapper));
    return release.wrapperPath;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

export function importExample(release, driveLink) {
  const importLine = `import shared-gdrive(${JSON.stringify(path.basename(release.wrapperPath))}, ${JSON.stringify(driveFileId(driveLink))}) as S`;
  return `${importLine}

data Tree:
  | leaf(value)
  | branch(left, right)
sharing:
  method _spytial(self):
    [list: S.orientation("left + right", [list: S.direction-below])]
  end
end

S.diagram(branch(leaf(1), leaf(2)))
`;
}

async function main() {
  const { values } = parseArgs({ options: {
    tag: { type: 'string' }, out: { type: 'string', default: 'release' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: npm run release:drive -- [--tag v0.2.0] [--out release]\n' +
      'Requires Node 22+, GitHub CLI (gh), and tar. Downloads the latest stable release by default.\n' +
      'Prompts for Drive links after you upload each file; no Google API credentials needed.');
    return;
  }
  console.log(`Downloading ${values.tag || 'the latest release'} from ${repo}…`);
  const release = prepareDriveRelease({ tag: values.tag, output: values.out });
  const prompts = createInterface({ input: process.stdin, output: process.stdout });
  const askId = async question => {
    while (true) {
      const answer = await prompts.question(question);
      try { return driveFileId(answer); } catch (error) { console.error(error.message); }
    }
  };
  try {
    console.log(`\n1. Upload this file to Google Drive, keeping its filename:\n${release.nativePath}\n` +
      'Set General access to "Anyone with the link" / "Viewer". Keep it as a file; do not convert it.');
    const nativeId = await askId('\nPaste its Drive link (or file ID): ');
    prepareWrapper(release, nativeId);
    console.log(`\n2. Upload this wrapper to Google Drive, keeping its filename:\n${release.wrapperPath}\n` +
      'Set General access to "Anyone with the link" / "Viewer".');
    const wrapperId = await askId('\nPaste the wrapper’s Drive link (or file ID): ');
    if (wrapperId === nativeId) throw new Error('The wrapper must have its own Drive file ID. Rerun with the two different links.');
    const example = importExample(release, wrapperId);
    const examplePath = path.join(release.directory, 'import.arr');
    writeUnchangedOrNew(examplePath, example);
    console.log(`\n3. Paste this into CPO to check the release:\n\n${example}\nSaved to ${examplePath}\n` +
      'Share the import line with users. Keep these versioned Drive files unchanged.');
  } finally {
    prompts.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}
