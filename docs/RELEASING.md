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
   artifact, publishes it to npm, and attaches it to a GitHub release.

Prerelease versions publish under `next`; stable versions use `latest`. A failed
workflow can be rerun or manually dispatched against the same **tag**. An existing
npm version is accepted only when its integrity matches the tested tarball;
different contents require a version bump.

Version 0.1.0 was bootstrapped manually. Subsequent versions use the tagged
workflow. It installs its pinned npm into a separate tools directory so npm
does not replace itself while running.
