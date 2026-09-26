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
The receiver needs neither Pyret nor an IDE. Use `getSpytialSpec` to collect
layout rules alongside values; YAML interpretation stays in Core.

See [the capture contract](docs/PYRET_CAPTURE.md) for supported values and limits.
Closures are not serialized. Source preview is separate from structural capture.

## Layout rules in Pyret

The package includes `pyret/spytial.arr`, a typed rule library generated from
Core's language manifest. Copy or serve that file where your Pyret program can
import it (Node hosts can locate it with `require.resolve('spyret/spytial.arr')`).

```pyret
import file("spytial.arr") as S

data Tree:
  | leaf(value)
  | branch(children)
sharing:
  method _spytial(self) -> List<S.SpytialRule>:
    [list:
      S.orientation("children", [list: S.direction-below]),
      S.align("siblings", S.alignment-horizontal)
    ]
  end
end
```

Public constructors wrap their results as `constraint(Constraint)` or
`directive(Directive)` automatically. Compose rules with ordinary Pyret lists;
the serializer puts each rule in its proper YAML section. Optional fields and
style blocks have typed, immutable setters:

```pyret
S.atom-style-with(S.default-atom-style-options
  .with-selector("leaf")
  .with-fill-style(S.default-fill-style.with-color("red")))
```

From the JavaScript host, after evaluating the program:

```js
import { toDataInstance, getSpytialSpec } from 'spyret';

const instance = toDataInstance(pyretValue, runtime);
const specs = await getSpytialSpec(pyretValue, runtime); // string[]
```

The collector walks reachable values in breadth-first order, including lists,
objects, tuples, arrays, references, dictionaries and table cells. It handles
cycles and invokes each distinct `_spytial` function or method once per call,
with methods bound to their first encountered owner. Repeated hooks never stop
the traversal of an instance's children. Hooks should describe types, independent
of the particular instance; unobserved datatype variants cannot be discovered.

Each hook returns `List<SpytialRule>`, serialized as one YAML document. A raw YAML
string is also accepted as an escape hatch, unchanged and unvalidated. No hooks
yields `[]`; a hook returning an empty list yields one empty spec. Identical
documents from different hooks remain separate. Hook failures, malformed rules
and unsupported values reject the promise with a `SpytialSpecError` and path.

Hooks execute user code. Call the async collector while its owning runtime is
idle or paused; a native Pyret module can use `runtime.pauseStack` around the
promise. `spytialRulesToYaml(rules, runtime)` also serializes an already evaluated
rule list directly. Capture and `toDataInstance` never invoke hooks, and omit
callable `_spytial` metadata on ordinary objects or outside a datatype's declared
slots. Other capture restrictions still apply.

See the [generated rule reference](docs/SPYTIAL_RULES_REFERENCE.md) for every
constructor, enum and option. Pyret annotations check field types; serialization
checks numeric bounds, string patterns and incompatible directions. Selector
meaning and result arity remain Core's responsibility.

To update the API, pin the desired Core release in `package.json` and the lockfile,
then run `npm run generate:spytial`. Commit the generated Pyret source, serializer
schema and reference together. `npm run check:spytial` and the tests detect drift;
unknown field types or enum vocabularies fail generation for explicit handling.
No Core runtime dependency is added to the published package.

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
