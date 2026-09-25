/** Publish the tested tarball, allowing retries only for identical content. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.equal(process.env.GITHUB_REF_TYPE, 'tag');
assert.equal(process.env.GITHUB_REF_NAME, `v${pkg.version}`);
const tarballs = fs.readdirSync('release').filter(f => f.endsWith('.tgz'));
assert.equal(tarballs.length, 1, 'Expected exactly one tested release artifact');
const tarball = path.resolve('release', tarballs[0]);
const integrity = 'sha512-' + createHash('sha512').update(fs.readFileSync(tarball)).digest('base64');
const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${pkg.version}`);
if (response.ok) {
  const published = await response.json();
  assert.equal(published.dist.integrity, integrity, 'This version already exists with different contents; bump the version');
  console.log(`${pkg.name}@${pkg.version} already contains this exact artifact`);
} else {
  assert.equal(response.status, 404, `Cannot check registry version: HTTP ${response.status}`);
  execFileSync('npm', ['publish', tarball, '--access', 'public', '--provenance', '--tag', pkg.version.includes('-') ? 'next' : 'latest'], { stdio: 'inherit' });
}
