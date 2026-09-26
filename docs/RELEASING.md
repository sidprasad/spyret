# Releasing Spyret

Spyret is published as the public npm package `spyret`. The CJS, ESM, browser and
TypeScript entry points contain Spyret's adapters and bundled data contract
declarations, with no Core runtime dependency. The host passes the returned
`IDataInstance` to Core for layout/rendering; compatibility tests use Core 6.3.1.

## One-time npm setup

The first package publication requires an npm maintainer login. From a checked,
merged release commit, run:

```sh
npm login
npm ci
npm run typecheck
npm test
npx --yes --package npm@11.20.0 -c 'npm run test:package -- --out release'
npx --yes --package npm@11.20.0 npm publish ./release/spyret-0.1.0.tgz --access public
```

Also require green upstream PBT CI for this commit before publishing. The package
check installs the actual tarball into an empty project and exercises
CJS, ESM, browser and TypeScript consumers.

After the package exists, configure its npm **Trusted Publisher** settings:

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization/user | `sidprasad` |
| Repository | `spyret` |
| Workflow filename | `release.yml` |
| Environment | Leave empty |
| Allowed action | Enable direct `npm publish` |

With npm 11.15 or later, the equivalent command is:

```sh
npm trust github spyret --repo sidprasad/spyret --file release.yml --allow-publish
```

See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
No npm token needs to be stored in GitHub. Publishing uses OIDC and provenance.

## One-time Google Drive setup for CPO imports

Tagged releases also publish two versioned files to a **Google shared drive**:
`spyret-vVERSION.js` (the native module) and `spyret-vVERSION.arr` (the Pyret
wrapper). A service account cannot own files in a personal My Drive; it must be
able to create files in a shared drive folder. The two files are granted
`anyone`/`reader` access so CPO users can import them. Confirm that your shared
drive permits public file sharing before enabling this workflow.

1. Enable the Google Drive API in a Google Cloud project. Create a service
   account and add it as a **Contributor** (or a role with equivalent file
   creation and sharing rights) to a dedicated shared drive. Create a folder
   for Spyret releases in that drive. The service account should have no access
   to unrelated files.
2. Configure [GitHub OIDC to Google Cloud](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform)
   and [service account impersonation](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account).
   Restrict the provider to this repository and release tag refs, then grant
   that identity `roles/iam.workloadIdentityUser` on the service account. This
   avoids storing a long-lived Google key in GitHub.
3. Set these GitHub Actions **repository variables**:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_WIF_PROVIDER` | Full Workload Identity Provider resource name (`projects/NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`) |
   | `GOOGLE_SERVICE_ACCOUNT` | Service account email |
   | `SPYRET_DRIVE_FOLDER_ID` | ID of the dedicated folder in the shared drive |

The workflow requests a short-lived Drive access token after package testing,
then creates the versioned files. It checks the existing file's MIME type, size,
and checksum before reusing it, so a rerun cannot silently replace a version
with different content. If Drive authentication, sharing, or upload fails,
the release job fails; fix the configuration and rerun it against the same tag.
An npm version already published by the first run is accepted only if its
integrity matches the tested tarball.

## Later releases

1. On a release branch, run `npm version patch --no-git-tag-version` (or choose a
   minor/major bump), commit both manifests, and merge after CI passes.
2. On the updated `main`, tag that exact commit and push the tag:

   ```sh
   git tag v0.1.2
   git push origin v0.1.2
   ```

3. `release.yml` verifies the tag matches `package.json` and belongs to `main`,
   runs the unit/package suite and both standard-Pyret PBT seeds, tests the packed
   artifact, publishes it to npm, creates public versioned Drive imports, and
   attaches the package, native module, wrapper, and Drive manifest to a GitHub
   release. The release notes and workflow summary include the exact CPO import.

Prerelease versions publish under `next`; stable versions use `latest`. A failed
workflow can be rerun or manually dispatched against the same **tag**. An existing
npm version is accepted only when its integrity matches the tested tarball;
different contents require a version bump.

Version 0.1.0 was bootstrapped manually. Subsequent versions use the tagged
workflow. It installs its pinned npm into a separate tools directory so npm
does not replace itself while running.

The wrapper is imported with `shared-gdrive`, using the name and ID printed in
the release notes. Updating a program to a new Spyret version means replacing
that single import line. Previous Drive files and IDs remain intact; Drive IDs
are intentionally different for each release. Older tags do not contain this
workflow; publish a new tag after merging these changes.
