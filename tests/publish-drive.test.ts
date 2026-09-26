import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { publishDriveRelease } from '../scripts/publish-drive.mjs';

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function fakeDrive() {
  const files = new Map<string, { id: string; name: string; mimeType: string; md5Checksum: string; size: string }>();
  const publicIds = new Set<string>();
  let uploads = 0;
  let grants = 0;
  const ok = (value: unknown) => ({ ok: true, json: async () => value });
  const fetchImpl = async (input: string, init: { method?: string; body?: Buffer; headers?: Record<string, string> } = {}) => {
    const url = new URL(input);
    if (url.pathname === '/drive/v3/files/folder') return ok({ id: 'folder', mimeType: 'application/vnd.google-apps.folder', driveId: 'sharedDrive' });
    if (url.pathname === '/drive/v3/files') {
      const name = url.searchParams.get('q')?.match(/name = '([^']+)'/)?.[1];
      return ok({ files: name && files.has(name) ? [files.get(name)] : [] });
    }
    if (url.pathname === '/upload/drive/v3/files') {
      uploads++;
      const body = init.body!.toString();
      const boundary = init.headers!['Content-Type'].split('boundary=')[1];
      const [metadataPart, mediaPart] = body.split(`--${boundary}\r\n`).slice(1);
      const metadata = JSON.parse(metadataPart.split('\r\n\r\n')[1].trim());
      const media = mediaPart.split('\r\n\r\n')[1].split(`\r\n--${boundary}--`)[0];
      const file = { id: `file${uploads}`, name: metadata.name, mimeType: metadata.mimeType,
        md5Checksum: createHash('md5').update(media).digest('hex'), size: String(Buffer.byteLength(media)) };
      files.set(file.name, file);
      return ok(file);
    }
    const permissions = url.pathname.match(/^\/drive\/v3\/files\/(file\d+)\/permissions$/);
    if (permissions && init.method === 'POST') {
      grants++;
      publicIds.add(permissions[1]);
      return ok({ id: `permission${grants}` });
    }
    if (permissions) return ok({ permissions: publicIds.has(permissions[1]) ? [{ id: 'public', type: 'anyone', role: 'reader' }] : [] });
    throw new Error(`Unexpected Drive API request: ${url.pathname}`);
  };
  return { fetchImpl, files, publicIds, stats: () => ({ uploads, grants }) };
}

it('publishes a versioned native module and wrapper, and safely reruns the release', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spyret-drive-'));
  scratch.push(dir);
  const nativeSource = path.join(dir, 'native.js');
  fs.writeFileSync(nativeSource, '({ provides: { values: {} } })\n');
  const drive = fakeDrive();
  const options = { version: '1.2.3', folderId: 'folder', token: 'test-token',
    nativeSource, output: path.join(dir, 'release'), fetchImpl: drive.fetchImpl as typeof fetch };
  const first = await publishDriveRelease(options);
  expect(first.import).toBe('import shared-gdrive("spyret-v1.2.3.arr", "file2") as S');
  expect(fs.readFileSync(path.join(options.output, 'spyret-v1.2.3.arr'), 'utf8'))
    .toContain('import gdrive-js("spyret-v1.2.3.js", "file1") as NativeSpyret');
  expect(drive.publicIds.size).toBe(2);
  expect(drive.stats()).toEqual({ uploads: 2, grants: 2 });

  const second = await publishDriveRelease(options);
  expect(second).toEqual(first);
  expect(drive.stats()).toEqual({ uploads: 2, grants: 2 });

  fs.writeFileSync(nativeSource, 'different contents\n');
  await expect(publishDriveRelease(options)).rejects.toThrow('different contents or type');
  expect(drive.stats()).toEqual({ uploads: 2, grants: 2 });
});
