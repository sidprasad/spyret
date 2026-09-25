# Spyret

The interfaces between standard Pyret and Spytial. Spyret captures Pyret values
as portable relational data, reconstructs their structure, and emits Pyret source
where supported. It runs in Node or a browser without an IDE.

`spyret-ide` is one consumer. `spytial-core` owns generic graph data, queries,
layout and rendering. This package owns Pyret runtime adaptation, constructor
identity, exact numbers, collections, capture validation, reconstruction and the
tests of those contracts.

```js
import { capturePyret, createPyretRuntimeAdapter, importPyretCapture } from 'spyret';

const snapshot = capturePyret([
  { name: 'tree', value: tree },
], createPyretRuntimeAdapter(runtime));

// This receiver needs neither the original runtime nor an IDE.
const { instance, values } = importPyretCapture(JSON.parse(JSON.stringify(snapshot)));
// instance implements Spytial's IDataInstance; values contains structural values.
```

See [the capture contract](docs/PYRET_CAPTURE.md) for supported values and limits.
Closures are not serialized. Source preview is separate from structural capture.

## Development

Requires Node 22 or later. Core's unreleased headless data entry is pinned to a
reviewed source commit in the lockfile; its Git dependency builds that entry
during installation. Tests also use the released Core layout/evaluator package.

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

## Migration and provenance

The adapters and structural tests were extracted from
[Spytial-Core](https://github.com/sidprasad/spytial-core), including the capture
work in PR #618. Runtime fixture generators came from
[Spyret-IDE](https://github.com/sidprasad/spyret-ide). Both are maintained by
Siddhartha Prasad. Core retains its existing Pyret exports temporarily for
compatibility; new Pyret functionality belongs here.
