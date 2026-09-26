# Layout hooks and typed rules

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

See the [generated rule reference](SPYTIAL_RULES_REFERENCE.md) for every
constructor, enum and option. Pyret annotations check field types; serialization
checks numeric bounds, string patterns and incompatible directions. Selector
meaning and result arity remain Core's responsibility.

To update the API, pin the desired Core release in `package.json` and the lockfile,
then run `npm run generate:spytial`. Commit the generated Pyret source, serializer
schema and reference together. `npm run check:spytial` and the tests detect drift;
unknown field types or enum vocabularies fail generation for explicit handling.
No Core runtime dependency is added to the published package.

