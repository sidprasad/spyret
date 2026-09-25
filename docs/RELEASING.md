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
npm install --global npm@11.20.0
npm ci
npm run typecheck
npm test
npm run test:package -- --out release
npm publish ./release/spyret-0.1.0.tgz --access public
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

## Later releases

1. On a release branch, run `npm version patch --no-git-tag-version` (or choose a
   minor/major bump), commit both manifests, and merge after CI passes.
2. On the updated `main`, tag that exact commit and push the tag:

   ```sh
   git tag v0.1.1
   git push origin v0.1.1
   ```

3. `release.yml` verifies the tag matches `package.json` and belongs to `main`,
   runs the unit/package suite and both standard-Pyret PBT seeds, tests the packed
   artifact, publishes it to npm, and attaches it to a GitHub release.

Prerelease versions publish under `next`; stable versions use `latest`. A failed
workflow can be rerun or manually dispatched against the same **tag**. An existing
npm version is accepted only when its integrity matches the tested tarball;
different contents require a version bump.

For the manually bootstrapped 0.1.0 release, push `v0.1.0` after configuring
trusted publishing. The workflow verifies that identical package and creates
the corresponding GitHub release.
