/** Publish immutable, public CPO imports for one tagged Spyret release. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeDriveWrapper } from './make-drive-wrapper.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const driveApi = 'https://www.googleapis.com';
const idPattern = /^[A-Za-z0-9_-]+$/;

function checksum(bytes, algorithm) {
  return createHash(algorithm).update(bytes).digest('hex');
}

function requireId(value, label) {
  if (!idPattern.test(value || '')) throw new Error(`Invalid or missing ${label}`);
  return value;
}

function driveQuery(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

export class DrivePublisher {
  constructor(token, fetchImpl = fetch) {
    if (!token) throw new Error('Missing Google access token');
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(url, options = {}) {
    const response = await this.fetch(driveApi + url, {
      ...options,
      headers: { Authorization: `Bearer ${this.token}`, ...options.headers },
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`Drive API ${response.status} ${url.split('?')[0]}: ${detail}`);
    }
    return response.json();
  }

  async folder(folderId) {
    requireId(folderId, 'Drive folder ID');
    const query = new URLSearchParams({ supportsAllDrives: 'true', fields: 'id,mimeType,driveId' });
    const folder = await this.request(`/drive/v3/files/${folderId}?${query}`);
    if (folder.mimeType !== 'application/vnd.google-apps.folder' || !folder.driveId) {
      throw new Error('Drive destination must be a folder in a shared drive');
    }
    return folder;
  }

  async findFiles(folder, name) {
    const query = new URLSearchParams({
      q: `'${driveQuery(folder.id)}' in parents and name = '${driveQuery(name)}' and trashed = false`,
      corpora: 'drive', driveId: folder.driveId,
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
      fields: 'nextPageToken,files(id,name,mimeType,md5Checksum,size)', pageSize: '1000',
    });
    const files = [];
    do {
      const result = await this.request(`/drive/v3/files?${query}`);
      files.push(...result.files);
      if (!result.nextPageToken) break;
      query.set('pageToken', result.nextPageToken);
    } while (true);
    return files;
  }

  async upload(folder, name, bytes, mimeType) {
    const boundary = `spyret-${randomUUID()}`;
    const metadata = { name, parents: [folder.id], mimeType };
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const query = new URLSearchParams({ uploadType: 'multipart', supportsAllDrives: 'true', fields: 'id,name,mimeType,md5Checksum,size' });
    return this.request(`/upload/drive/v3/files?${query}`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
  }

  async makePublic(fileId) {
    requireId(fileId, 'Drive file ID');
    const query = new URLSearchParams({ supportsAllDrives: 'true', fields: 'nextPageToken,permissions(id,type,role)' });
    let hasPublicReader = false;
    do {
      const result = await this.request(`/drive/v3/files/${fileId}/permissions?${query}`);
      hasPublicReader ||= result.permissions.some(permission =>
        permission.type === 'anyone' && permission.role === 'reader');
      if (!result.nextPageToken) break;
      query.set('pageToken', result.nextPageToken);
    } while (true);
    if (hasPublicReader) return;
    await this.request(`/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
    });
  }

  async ensureFile(folder, name, bytes, mimeType) {
    const matches = await this.findFiles(folder, name);
    if (matches.length > 1) throw new Error(`Multiple Drive files named ${name}; resolve the duplicate before rerunning`);
    const file = matches[0] || await this.upload(folder, name, bytes, mimeType);
    if (file.name !== name || file.mimeType !== mimeType ||
        file.md5Checksum !== checksum(bytes, 'md5') || Number(file.size) !== bytes.length) {
      throw new Error(`Drive file ${name} already exists with different contents or type; bump the version`);
    }
    await this.makePublic(file.id);
    return file.id;
  }
}

export async function publishDriveRelease({ version, folderId, token,
  output = path.join(root, 'release'), nativeSource = path.join(root, 'dist/spyret.pyret.js'), fetchImpl = fetch }) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid release version');
  const publisher = new DrivePublisher(token, fetchImpl);
  const folder = await publisher.folder(folderId);
  const stem = `spyret-v${version}`;
  const nativeName = `${stem}.js`;
  const wrapperName = `${stem}.arr`;
  const native = fs.readFileSync(nativeSource);
  fs.mkdirSync(output, { recursive: true });

  const nativeId = await publisher.ensureFile(folder, nativeName, native, 'text/javascript');
  const wrapperPath = path.join(output, wrapperName);
  makeDriveWrapper(nativeId, wrapperPath, nativeName, path.join(root, 'pyret/spytial.arr'));
  const wrapper = fs.readFileSync(wrapperPath);
  const wrapperId = await publisher.ensureFile(folder, wrapperName, wrapper, 'text/plain');
  fs.copyFileSync(nativeSource, path.join(output, nativeName));

  const importLine = `import shared-gdrive(${JSON.stringify(wrapperName)}, ${JSON.stringify(wrapperId)}) as S`;
  const manifest = {
    version, import: importLine,
    native: { name: nativeName, driveId: nativeId, sha256: checksum(native, 'sha256') },
    wrapper: { name: wrapperName, driveId: wrapperId, sha256: checksum(wrapper, 'sha256') },
  };
  fs.writeFileSync(path.join(output, `${stem}-drive.json`), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(output, `${stem}-import.md`),
    `## Import Spyret ${version} in CPO\n\n\`\`\`pyret\n${importLine}\n\`\`\`\n\n` +
    `This version uses two publicly readable, versioned Google Drive files.\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(process.env.GITHUB_REF_NAME, `v${pkg.version}`, 'Release tag must match package version');
  const manifest = await publishDriveRelease({
    version: pkg.version,
    folderId: process.env.SPYRET_DRIVE_FOLDER_ID,
    token: process.env.GOOGLE_ACCESS_TOKEN,
  });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Spyret ${pkg.version} CPO import\n\n\`\`\`pyret\n${manifest.import}\n\`\`\`\n\n`);
  console.log(manifest.import);
}
