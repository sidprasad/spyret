# Importable Spyret browser tests

This harness now tests the **packaged implementation**, `dist/spyret.pyret.js`.
There is no separate experimental renderer implementation. See
[the library guide](../../docs/BROWSER_LIBRARY.md) for usage and limitations.

With Node 22+, build Spyret and download the unmodified upstream embed:

```sh
npm ci
npm run build
mkdir -p /tmp/spyret-embed
npm pack pyret-embed@0.1.8 --pack-destination /tmp/spyret-embed
tar -xzf /tmp/spyret-embed/pyret-embed-0.1.8.tgz -C /tmp/spyret-embed
node experiments/importable-spytial/run.mjs /tmp/spyret-embed/package/dist
```

Open the printed URL and press Run. The host provides virtual files through the
embed's public filesystem RPC. Two generic fixes adapt the published default
RPC: its `is-absolute` method needs an `isAbsolute` alias, and `readFile` must
return decoded text. The host does not install Spyret/Core scripts or renderers.

For automated tests, supply Puppeteer and Chrome:

```sh
PUPPETEER_MODULE=/absolute/path/to/node_modules/puppeteer-core \
  node experiments/importable-spytial/run.mjs /tmp/spyret-embed/package/dist --test
```

`CHROME_PATH` overrides the default macOS Chrome path. Add `--drive` to exercise
one URL import and the existing `gdrive-js` locator. Add `--public-cpo` instead
to run against the actual public CPO editor. These two modes substitute Drive
storage with a fixture; the compiler, locator and renderer remain real. Core's
pinned CDN URL is served from the installed matching package during tests.
Public CPO may log unrelated Google-storage/network errors without a login.

Assertions cover rule collection, no hooks, visible SVGs with finite positions,
Core zoom, ordinary images and numbers, and repeated runs in the embed. The
screenshot defaults to `/tmp/spyret-import-poc.png`; override with `SCREENSHOT`.
Live Drive authorization/sharing remains a deployment check.

The downloaded `pyret-embed@0.1.8` archive has npm integrity:

```
sha512-LGA5uEBldKik+74YW4yTZxcDWUii9a/hF7VkLhDD2N4ZoCw/KRjHkR5/LFoImCVc7UXzhu+mae5k9GDjvLM9gw==
```
