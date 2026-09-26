# Spyret

The interfaces between standard Pyret and Spytial. Spyret captures Pyret values
as portable relational data, reconstructs their structure, and emits Pyret source
where supported. It runs in Node or a browser without an IDE.

`spyret-ide` is one consumer. `spytial-core` owns generic graph data, queries,
layout and rendering. This package owns Pyret runtime adaptation, constructor
identity, exact numbers, collections, capture validation, reconstruction and the
tests of those contracts.

```js
import { toDataInstance } from 'spyret';

const instance = toDataInstance(pyretValue, runtime);
// Pass instance directly to Spytial-Core's evaluator/layout APIs.
```

`toDataInstance` accepts a value and the standard Pyret runtime that owns it.
Spyret handles capture, relationalization and validation and returns an
`IDataInstance`. Core handles queries, layout and rendering. No
`spytial-core/data` entry point or Core runtime is needed inside Spyret.

For transport between processes, use `capturePyret` with
`createPyretRuntimeAdapter(runtime)`, then `importPyretCapture` at the receiver.
The receiver needs neither Pyret nor an IDE. Collecting layout YAML alongside
values can be added to Spyret later; YAML interpretation stays in Core.

See [the capture contract](docs/PYRET_CAPTURE.md) for supported values and limits,
and [the table representation](docs/PYRET_TABLES.md) for editable table data.
Closures are not serialized. Source preview is separate from structural capture.

## Development

Requires Node 22 or later. The development dependency on released Core 6.3.1
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
Hosts can use Core 6.3.1 for layout and rendering; Core 6.3.2 is not required.
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
