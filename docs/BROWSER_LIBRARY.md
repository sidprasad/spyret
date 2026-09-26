# Using Spyret as a Pyret library

Spyret owns the rule API, hook collection, Pyret adaptation, layout setup, diagram
views and CPO display registration. Core still owns the layout language, solver
and graph component. The default JavaScript entry remains headless; browser
integration is a separate `spyret/browser` entry.

## Import a published version in CPO

A maintainer runs `npm run release:drive` and follows the
[manual upload instructions](RELEASING.md). Use the import line they supply:

```pyret
import shared-gdrive("spyret-vVERSION.arr", "WRAPPER_DRIVE_FILE_ID") as S

S.diagram([list: 1, 2, 3])
```

To upgrade, replace the import line with the one from the newer release. The
wrapper imports the matching native module by its own Drive ID, so users need
only one import for typed constructors and diagram functions.

## An ordinary native import in CPO

CPO already supports native Pyret modules through `gdrive-js`. Upload the built
`dist/spyret.pyret.js` to Google Drive **as `spyret.js`**, and grant intended users
read access. Do not convert it to a Google document. With that file's ID:

```pyret
import gdrive-js("spyret.js", "YOUR_DRIVE_FILE_ID") as Spyret

Spyret.diagram([list: 1, 2, 3])
```

The file bundles Spyret's browser implementation. It loads pinned Core 6.3.2
from jsDelivr when first used, unless the page already supplies Core. No Spyret
scripts, builtin registration, or Spytial-specific renderer need to be added to
CPO. CPO's Drive access/authentication requirements still apply.

`js-file("path/to/spyret")` loads the same native file in browser hosts with a
filesystem bridge. Pyret's plain `url(...)` loader parses Pyret source, so it
cannot load the JavaScript file directly. This browser module needs a DOM and
CPO output support; Node consumers use the headless JavaScript APIs instead.

For the generated Pyret rule constructors alone, a release tag needs no Drive
file: `import url("https://raw.githubusercontent.com/sidprasad/spyret/vVERSION/pyret/spytial.arr") as R`.
The `diagram` functions live in the native JavaScript module, so a full Spyret
import in stock CPO still needs its `gdrive-js` locator. A local browser host
with a filesystem bridge can use `js-file` after downloading that release's
native asset.

## Diagram operations

| Pyret operation | Behavior |
| --- | --- |
| `S.diagram(value)` | Collect reachable `_spytial` hooks and compose their YAML sections in discovery order. No hooks means an empty spec. |
| `S.diagram(value, yaml)` | Use exactly the explicit YAML, preserving existing programs; does not invoke hooks. |
| `S.diagram-with-rules(value, rules)` | Use an explicit Pyret list of `SpytialRule`; does not invoke hooks. |
| `S.genlayout(value, yaml)` | Legacy DOM-returning entry; asset loading can suspend, so invoke through the runtime stack. Prefer opaque diagrams in Pyret programs. |

Each display of a diagram creates its own DOM. The portable capture is available
as `view.spytialCapture`. Core diagnostics remain on the layout passed to its
component; failed graph rendering produces a visible message. The source preview
is separate from capture, so inability to reconstruct source does not prevent
rendering.

## Host and compatibility boundary

JavaScript browser hosts can use `createPyretModule(runtime, host)` from
`spyret/browser`. A host provides a document, Core provider, and
`registerOutput(runtime, handle, render)` function; `render()` constructs a fresh
view. Hosts can implement their own output registration instead of using CPO.

The packaged CPO adapter installs itself lazily, when a diagram is requested.
It extends `runtime.ReprMethods.$cpo.opaque`, preserves the existing image/opaque
renderer, and keeps view handles in a weak map. While loading browser assets it observes Pyret's paused-thread break handler to
avoid resuming after Stop. Hooks execute on the caller's Pyret stack, preserving
normal cancellation rather than starting a nested runtime execution. These are
**private compatibility APIs**, not an upstream extension guarantee. Keep the
browser tests when upgrading Pyret/CPO. Other Pyret hosts need an appropriate
browser host adapter.

## Verification

The browser harness lives in `tests/browser-import/run.mjs`:

- Default: real `js-file` import in published, unmodified `pyret-embed@0.1.8`.
- `--drive`: one URL-imported wrapper, invoking the real upstream `gdrive-js`
  locator with deterministic simulated Drive storage.
- `--public-cpo`: the actual `https://code.pyret.org/editor` page with only
  library-file/Drive transport substituted. The compiler and output renderer
  are not patched by the test; Spyret registers itself through its import.

Tests cover typed hooks, no-hook values, finite graph positions, Core zoom,
ordinary images/numbers, and reruns. This proves the import/display mechanism,
not live Google permissions or a deployed shared file. Run the example printed
by `npm run release:drive` in CPO after uploading to check permissions and rendering.
