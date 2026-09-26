// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { driveFileId, importExample, prepareDriveRelease, prepareWrapper } from '../scripts/prepare-drive-release.mjs';

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function fixture({ version = '1.2.3', browser = true, packageVersion = version } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-manual-test-'));
  scratch.push(dir);
  const pkg = path.join(dir, 'package');
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(pkg, 'pyret'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'spyret', version: packageVersion }));
  const native = '({ provides: { values: {} }, theModule: function() {} })\n';
  if (browser) fs.writeFileSync(path.join(pkg, 'dist/spyret.pyret.js'), native);
  const rules = 'provide *\nprovide-types *\n# Rules from this exact release\n';
  if (browser) fs.writeFileSync(path.join(pkg, 'pyret/spytial.arr'), rules);
  const archive = path.join(dir, `spyret-${version}.tgz`);
  execFileSync('tar', ['-czf', archive, '-C', dir, 'package']);
  const calls: string[][] = [];
  const run = (command: string, args: string[], options: object) => {
    if (command !== 'gh') return execFileSync(command, args, options);
    calls.push(args);
    if (args[1] === 'view') return JSON.stringify({ tagName: `v${version}`, assets: [{ name: path.basename(archive) }] });
    if (args[1] === 'download') {
      fs.copyFileSync(archive, path.join(args[args.indexOf('--dir') + 1], path.basename(archive)));
      return '';
    }
    throw new Error(`Unexpected command: ${args}`);
  };
  return { output: path.join(dir, 'release'), native, rules, calls, run };
}

it('downloads matching native and rules, then generates the wrapper and single CPO import', () => {
  const setup = fixture();
  const release = prepareDriveRelease(setup);
  expect(setup.calls[0]).toEqual(['release', 'view', '--repo', 'sidprasad/spyret', '--json', 'tagName,assets']);
  expect(fs.readdirSync(path.dirname(release.nativePath))).toEqual(['spyret-v1.2.3.js']);
  expect(fs.readFileSync(release.nativePath, 'utf8')).toBe(setup.native);
  expect(fs.readFileSync(release.rulesPath, 'utf8')).toBe(setup.rules);
  prepareWrapper(release, 'https://drive.google.com/file/d/native_123/view?usp=sharing');
  expect(fs.readdirSync(path.dirname(release.nativePath))).toEqual(['spyret-v1.2.3.arr', 'spyret-v1.2.3.js']);
  const wrapper = fs.readFileSync(release.wrapperPath, 'utf8');
  expect(wrapper).toContain('# Rules from this exact release');
  expect(wrapper).toContain('import gdrive-js("spyret-v1.2.3.js", "native_123") as NativeSpyret');
  expect(wrapper).toContain('diagram = NativeSpyret.diagram');
  const example = importExample(release, 'https://drive.google.com/file/d/wrapper_456/view?usp=sharing');
  expect(example).toContain('import shared-gdrive("spyret-v1.2.3.arr", "wrapper_456") as S');
  expect(example).toContain('S.orientation("left + right", [list: S.direction-below])');
  expect(example).toContain('S.diagram(branch(leaf(1), leaf(2)))');
  expect(prepareWrapper(release, 'native_123')).toBe(release.wrapperPath);
  expect(() => prepareWrapper(release, 'different_id')).toThrow('already has different contents');
  expect(prepareDriveRelease(setup)).toEqual(release);
  fs.writeFileSync(release.nativePath, 'different release bytes');
  expect(() => prepareDriveRelease(setup)).toThrow('already has different contents');
});

it('supports selecting a specific prerelease', () => {
  const setup = fixture({ version: '1.2.3-beta.1' });
  const release = prepareDriveRelease({ ...setup, tag: 'v1.2.3-beta.1' });
  expect(setup.calls[0][2]).toBe('v1.2.3-beta.1');
  expect(path.basename(release.nativePath)).toBe('spyret-v1.2.3-beta.1.js');
});

it('rejects headless releases before preparing upload files', () => {
  const setup = fixture({ version: '0.1.1', browser: false });
  expect(() => prepareDriveRelease(setup)).toThrow('does not contain the Pyret browser module');
  expect(fs.existsSync(setup.output)).toBe(false);
});

it('rejects a mismatched package version', () => {
  const setup = fixture({ packageVersion: '1.2.2' });
  expect(() => prepareDriveRelease(setup)).toThrow('Release tag and package do not match');
  expect(fs.existsSync(setup.output)).toBe(false);
});

it('accepts Drive file links and IDs but rejects folders and unrelated links', () => {
  expect(driveFileId(' native_123-abc ')).toBe('native_123-abc');
  expect(driveFileId('https://drive.google.com/open?id=native_123')).toBe('native_123');
  for (const input of ['', 'https://example.com/file/d/file1/view', 'https://drive.google.com/drive/folders/folder1', 'bad"id']) {
    expect(() => driveFileId(input)).toThrow('Drive file link or file ID');
  }
});
