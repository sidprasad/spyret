# Pyret relationalization rules

Spyret turns Pyret values into an `IDataInstance` by representing values as
atoms and their structure as relations between atoms. Constructor variants
determine atom types; constructor fields determine relations. This document
characterizes the encoding used by `toDataInstance(value, runtime)` and the
portable `capturePyret` API. See [Portable Pyret capture](PYRET_CAPTURE.md) for
API usage and the snapshot format.

## Atoms and relations

An atom has an identity, a type, and a display label. A relation has an identity,
a name, a positional type signature, and a set of tuples containing atom IDs.
The notation `f(a, b)` below means that the relation named `f` contains the tuple
`(a, b)`. It is schematic notation, not Pyret source or a query expression.

Let `A(v)` denote the atom representing value `v`. Nested values follow the same
rules recursively. Positions are zero-based `Index` atoms, separate from
ordinary `Number` atoms; the same position atom is reused across containers.

| Pyret value | Representing atom | Structural relations |
| --- | --- | --- |
| Number, string, boolean | `Number`, `String`, or `Boolean`, labeled with the value | None |
| `nothing` | `Nothing` | None |
| Constructor application `C(v1, ..., vn)` | An atom typed by constructor `C` | For each declared field `fi`, a binary tuple `fi(A(v), A(vi))` |
| Singleton variant such as `empty` | An atom typed by that constructor | No field tuples |
| Zero-argument constructor application `C()` | An atom typed by `C` | Unary `nullary-constructor(A(v))` |
| List | Ordinary `link` and `empty` constructor atoms | Binary `first(link, value)` and `rest(link, tail)` |
| Tuple or raw array | `Tuple` or `RawArray` | Ternary `element(container, index, value)` |
| Ordinary object | `Object` | For each field `f`, a ternary tuple `f(object, fieldPosition, value)` |
| String dictionary | `StringDict` or `MutableStringDict` | `entry(dictionary, index, key, value)`; unary `sealed(dictionary)` when applicable |
| Table | `Table` | `column(table, index, name)` and `row(table, rowIndex, cell1, ..., cellN)` |
| Mutable reference | `Reference` | `target(reference, value)` and, for the supported unrestricted references, unary `unrestricted(reference)` |

Primitive labels preserve string content and boolean values. Numeric labels
preserve exact integer and rational values, and distinguish rough numbers from
exact numbers, including rough negative zero.

## Inductive datatypes

Consider this declaration:

```pyret
data Tree:
  | leaf
  | node(value, left, right)
end
```

Each observed `node` value becomes an atom typed by the `node` constructor.
Its three declared fields become binary relations named `value`, `left`, and
`right`. Each observed `leaf` value becomes a `leaf` atom with no field tuples.
For `node(10, leaf, leaf)`, the encoding is schematically:

```text
Atoms:
  n : node
  x : Number, label "10"
  e : leaf

Relations:
  value = {(n, x)}
  left  = {(n, e)}
  right = {(n, e)}
```

The two fields point to the same `leaf` atom because they contain the same
singleton value. A constructor application with fields produces one tuple per
field, rather than a single tuple containing all its arguments.

Constructor identities are nominal and scoped to a capture. Two distinct
constructors named `node` receive different type IDs, even if they have the
same fields. The ordinary constructor name remains the atom label and, except
for reserved builtin names, a type alias usable by name-based selectors. An
alias selects the union of observed constructors with that spelling.

Field relation IDs encode the constructor type ID, the field position, and the
field name. Consequently, identically named fields on different constructors
are distinct relations. Field order is preserved in this metadata even though
the field tuples themselves are binary.

A singleton variant `C` and a zero-argument application `C()` both have no
fields. The latter additionally has a `nullary-constructor` fact. A mutable
declared field additionally produces `mutable-field(owner, position)`; its
reference cell is represented explicitly, so the field points to a `Reference`
atom whose `target` points to the current value.

Capture records observed constructor state. It does not recover the enclosing
`Tree` declaration, unobserved variants, or erased generic parameters.

## Lists and other constructor based collections

Lists follow the ordinary constructor rules. For `[list: 10, 20]`:

```text
Atoms:
  l1 : link
  l2 : link
  e  : empty
  n1 : Number, label "10"
  n2 : Number, label "20"

Relations:
  first = {(l1, n1), (l2, n2)}
  rest  = {(l1, l2), (l2, e)}
```

The root is `l1`. There is no additional whole-list atom or indexed membership
relation. Order is represented by following `rest`; an empty list is represented
by its `empty` atom. Shared tails remain shared atoms.

Options, either values, and sets also follow their declared constructor
structure. A list-backed set retains its `list-set` wrapper and backing list;
a tree-backed set retains its `tree-set` wrapper and backing tree, including
tree fields such as heights. Sets do not become flat membership relations.

## Indexed containers and tables

Tuples and raw arrays have a container atom and indexed `element` tuples. For
an array containing `10` twice, both tuples point to the same number atom by
default, but their indices distinguish the two occurrences:

```text
element = {(a, index0, n10), (a, index1, n10)}
```

Ordinary object fields use their field names as relation names and include an
index to preserve observed field order. For example, `{x: 10, y: 20}` produces
`x(o, index0, n10)` and `y(o, index1, n20)`. Enumerable inherited fields are
included. Dictionaries instead use one `entry` relation, with string key atoms
and indices preserving observed entry order.

For a table with two columns, each row contributes a four-atom tuple:
`row(table, rowIndex, firstCell, secondCell)`. Headers are represented separately
as `column(table, columnIndex, headerString)`. Row indices preserve order and
duplicate rows. Row relations are separated by table width. Cells can contain
structured values, which are relationalized using the same rules.

Empty arrays, tuples, objects, dictionaries, and tables retain their container
atoms. A table row is represented by an n-ary relation tuple, without allocating
a separate row atom. Standalone Pyret `Row` values are unsupported.

## Identity and roots

By default, primitive occurrences with the same type and encoded label reuse
one atom. The lower-level `PyretDataInstance` constructor exposes
`stringsIdempotent`, `numbersIdempotent`, and `booleansIdempotent` options to
disable reuse separately; the public capture path uses the defaults.

Structured values are tracked by object identity. Repeated references to one
object reuse its atom; equal but distinct objects remain distinct. Cycles and
sharing across roots in one capture are preserved. Identical relation tuples
are stored only once; indexed encodings preserve distinct occurrences through
their index atoms.

Root names and optional observation metadata are stored separately from the
datum as root-name-to-atom mappings. They do not become structural relations.
Atom IDs are references, not binding names. Constructor identities are fresh
for each capture and are not stable declaration IDs across captures.

## Scope and implementation

The public capture path records structural state without invoking `_output`,
`_spytial`, or other user hooks. Declared datatype methods and callable layout
metadata are omitted. Functions or methods in state-bearing fields, opaque
values, unrecognized branded library objects, unsupported references, and
other unsupported state cause an explicit capture error rather than a partial
successful result. Supported references are initialized mutable cells carrying
only the owning runtime's `Any` annotation.

The nominal constructor guarantees described here belong to the public capture
path. Direct legacy `new PyretDataInstance(rawValue)` uses the supplied
constructor names and metadata, with fallback handling for older runtime object
shapes; it does not independently assign capture-scoped constructor identities.

The implementation and supporting tests are:

- [Runtime adapter](../src/data-instance/pyret/runtime-adapter.ts): classifies live values and validates supported state.
- [Capture](../src/data-instance/pyret/capture.ts): preserves identity across roots and assigns nominal constructor IDs.
- [Relationalizer](../src/data-instance/pyret/pyret-data-instance.ts): creates atoms, types, and relation tuples.
- [Constructor and field identity](../src/data-instance/pyret/identity.ts): encodes constructor identity and declared field order.
- [Capture tests](../tests/pyret/pyret-capture.test.ts) and [set fidelity tests](../tests/pyret/pyret-set-fidelity.test.ts): cover identity preservation and constructor-based collection structure.
