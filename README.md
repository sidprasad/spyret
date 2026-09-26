# Spyret

[![Build and tests](https://github.com/sidprasad/spyret/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/sidprasad/spyret/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/spyret)](https://www.npmjs.com/package/spyret)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Spyret connects [Pyret](https://pyret.org/) values to
[Spytial](https://github.com/sidprasad/spytial-core) diagrams.
`toDataInstance(value, runtime)` turns a Pyret value into relational data for
Spytial; `await getSpytialSpec(value, runtime)` walks its reachable values and
collects one YAML string per distinct `_spytial` hook. Hooks can return typed
Pyret rules or raw YAML; values without hooks return `[]`. The JavaScript API
runs without an IDE, and the browser library lets Pyret programs display diagrams
in CPO through an import.

## JavaScript

```sh
npm install spyret
```

```js
import { toDataInstance, getSpytialSpec } from 'spyret';

// Use the Pyret runtime that owns the value, while it is idle or paused.
const instance = toDataInstance(pyretValue, runtime);
const specs = await getSpytialSpec(pyretValue, runtime); // string[]
// Pass the data and layout specs to Spytial-Core.
```

`toDataInstance` returns an `IDataInstance` and never invokes hooks. The collector
handles cycles and calls each distinct hook once. See the
[hook contract and typed rules](docs/SPYTIAL_HOOKS.md) for composition, errors and
runtime requirements. For portable snapshots and reconstruction, see the
[capture API](docs/PYRET_CAPTURE.md).

## Pyret: import, describe, display

Once a library maintainer has [hosted the library](docs/BROWSER_LIBRARY.md),
users can import its generated `.arr` wrapper in CPO, describe a type's layout
with `_spytial`, and call `show`:

```pyret
# Replace this placeholder with the hosted wrapper URL.
import url("https://YOUR_HOST/spyret.arr") as S

data Tree:
  | leaf(value)
  | branch(left, right)
sharing:
  method _spytial(self):
    [list: S.orientation("left + right", [list: S.direction-below])]
  end
end

S.show(branch(leaf(1), leaf(2)))
```

`show` collects the reachable types' rules, relationalizes the value and displays
a diagram. Compose rules with ordinary Pyret lists; constructors such as
`orientation`, `align` and `group` handle their constraint/directive category.
`S.show([list: 1, 2, 3])` also works without any hooks. To supply rules explicitly,
use `S.diagram-with-rules(value, rules)`, or `S.diagram(value, yaml)` for YAML.
See the [rule reference](docs/SPYTIAL_RULES_REFERENCE.md) for available constructors.

The import form depends on the host and file:

| Import | What it loads |
| --- | --- |
| `url("https://…/spyret.arr")` | The generated Pyret wrapper: typed rules and diagram functions in one import. It imports the native module from Drive internally. |
| `gdrive-js("spyret.js", "DRIVE_FILE_ID")` | The native JavaScript module in CPO, providing diagram functions. |
| `js-file("path/to/spyret")` | The same native module in a browser host with a filesystem bridge. |

A plain `url(...)` import cannot load native JavaScript. The packaged renderer
supports CPO; other browser hosts need an adapter. No changes to CPO itself are
required, although the library uses private CPO display APIs. **There is no
published library URL yet**; see the [hosting walkthrough](docs/BROWSER_LIBRARY.md)
for building, uploading to Drive and generating the wrapper.

Spyret owns Pyret adaptation and display integration; Core owns layout semantics
and graph rendering. Spyret-IDE can consume this library through a small wrapper;
its migration is a [separate companion change](docs/IDE_MIGRATION.md).

## Development

Requires Node 22 or later. The development dependency on released Core 6.3.2
provides its public interface types and tests layout/query compatibility.
Published Spyret builds include those type declarations and have no Core runtime
dependency.

```sh
npm ci
npm run typecheck
npm run build
npm test
```

To run against an unmodified `brownplt/pyret-lang` checkout, build its `lang/`
directory with `npm ci --ignore-scripts && make phaseA`, then run:

```sh
npm run test:upstream -- /path/to/pyret-lang/lang
npm run test:program -- /path/to/pyret-lang/lang
npm run test:spytial -- /path/to/pyret-lang/lang
REIFY_SEED=1 npm run test:pbt -- /path/to/pyret-lang/lang
REIFY_SEED=2 npm run test:pbt -- /path/to/pyret-lang/lang
```

CI pins upstream revision `6e62dcda5298606aa0abe66a372c4eb17a38db85`.
The unit suite includes 2,000 generated graphs across two seeds. Each upstream
PBT job compiles actual Pyret programs: fixed value/constructor cases, 100
generated values and 20 generated datatype declarations. Producer and decoder
run in separate processes; reconstruction receives only JSON snapshots. Actual
Pyret check blocks compare inspection strings. No browser or IDE is involved.

CommonJS and ES modules import `spyret`. The browser bundle is
`dist/spyret.global.js`, which defines `Spyret`.

## npm releases

Published builds contain Spyret's adapter and bundled interface declarations.
The standalone browser module loads Core 6.3.2; headless consumers do not need
a Core runtime.
`npm run test:package` verifies the actual tarball in an isolated consumer.
Version tags trigger the unit/package suite and both upstream PBT seeds before
publishing. See [release setup and commands](docs/RELEASING.md).

## Migration and provenance

The adapters and structural tests were extracted from
[Spytial-Core](https://github.com/sidprasad/spytial-core), including the capture
work in PR #618. Runtime fixture generators came from
[Spyret-IDE](https://github.com/sidprasad/spyret-ide). Both are maintained by
Siddhartha Prasad. Core retains its existing Pyret exports temporarily for
compatibility; new Pyret functionality belongs here.
