# Spyret's layout rule language

Spyret lets a Pyret program describe how its data should be drawn. The
`pyret/spytial.arr` library, imported as `S` below, provides typed constructors
for Spytial constraints and directives. Each constructor returns an
`S.SpytialRule`; put rules in an ordinary Pyret list. `S.diagram(value)` finds
`_spytial` hooks on reachable values, collects their rules, and displays the
diagram. See [layout hooks](SPYTIAL_HOOKS.md) for the hook contract and
[the README](../README.md#pyret-import-describe-display) for the CPO import.
This page describes the 0.3.0 source API. The published v0.2.0 wrapper uses
prefixed enum names and `atom-style-with`; update those calls when moving to
0.3.0. Style properties now use named records and typed blocks instead of
`.with-*` chains.

## A first diagram

```pyret
# Use the versioned wrapper import supplied by the library maintainer.
import shared-gdrive("spyret-vVERSION.arr", "WRAPPER_DRIVE_FILE_ID") as S

data Tree:
  | leaf(value)
  | branch(left, right)
sharing:
  method _spytial(self) -> List<S.SpytialRule>:
    [list:
      S.orientation("left + right", [list: S.below]),
      S.orientation("left", [list: S.left]),
      S.orientation("right", [list: S.right]),
      S.atom-style("leaf", {fill-style: S.fill-style({color: "#e0f2ff"})})
    ]
  end
end

S.diagram(branch(leaf(1), leaf(2)))
```

The `left + right` selector finds parent-to-child pairs. For each pair,
`below` places the child below the parent. The next two rules put
left children to the left and right children to the right. The style rule fills
leaf nodes. Rule order does not turn later rules into overrides; Spytial applies
them together and reports conflicting constraints.

The same constructors work in a local `import file("spytial.arr") as S` if the
library is available as a file. That import supplies rule constructors; the
versioned wrapper also supplies `diagram` and `diagram-with-rules`.

## Selectors and direction

A selector is a **string containing a Spytial relational expression**, not a
Pyret function. A unary selector such as `"leaf"` selects nodes. A binary
selector such as `"left"` or `"left + right"` selects `(source, target)` pairs.
The expected arity depends on the rule. For orientation, the direction names
describe where the **target** goes relative to the source. Thus, if `left`
contains `(parent, child)`, `S.below` puts the child below its parent.

Common expressions are a type name (`"leaf"`), a field name (`"left"`), a
union (`"left + right"`), or a transitive closure (`"^(left + right)"`). Keep
operators inside the quoted Pyret string. See [Spytial Core's selector
documentation](https://github.com/sidprasad/spytial-core/blob/main/site/selectors.md)
for the full expression language and arity rules.

| Pyret direction | Meaning for the target |
| --- | --- |
| `S.above`, `S.below` | Strictly above or below; sideways offset is allowed. |
| `S.left`, `S.right` | Strictly left or right; vertical offset is allowed. |
| `S.directly-above`, `S.directly-below` | Above or below and horizontally centered. |
| `S.directly-left`, `S.directly-right` | Left or right and vertically centered. |

You can combine compatible directions, for example
`[list: S.below, S.left]`. Opposites such as `above` and
`below` cannot be combined. A `directly-*` direction can only be combined with
its matching plain direction. Spyret checks these combinations when it
serializes the rule list.

## Constraints: layout and visibility

| Constructor | What it does |
| --- | --- |
| `S.orientation(selector, directions)` | Places targets of a binary selector relative to sources. |
| `S.cyclic(selector)` | Arranges nodes in the order of a binary selector around a circle. |
| `S.align(selector, direction)` | Gives selected nodes or node pairs a common row (`S.horizontal`) or column (`S.vertical`). |
| `S.group(selector, name)` | Draws a box around selected nodes; a binary selector makes a group per first-column key. |
| `S.size(width, height)` | Sets node dimensions in pixels; select the affected nodes with `S.size-with(width, height, {selector: "..."})`. Both numbers must be positive. |
| `S.hide-atom(selector)` | Removes selected nodes and their edges from the diagram. |

For example:

```pyret
[list:
  S.cyclic-with("next", {direction: S.counterclockwise}),
  S.align("siblings", S.horizontal),
  S.group("children", "Family"),
  S.size-with(150, 80, {selector: "branch"}),
  S.hide-atom("InternalNode")
]
```

Constraints can also use `{hold: S.never}` to require that a relation
**does not** hold. For instance, negating `S.above` means the target is
not strictly above the source; it does not require the target to be below.
`S.always` expresses the normal positive constraint.

## Directives: appearance and labels

| Constructor | What it does |
| --- | --- |
| `S.flag(name)` | Applies a global display flag such as `S.hide-disconnected` or `S.hide-disconnected-built-ins`. |
| `S.atom-style(selector, style)` | Styles the selected nodes' fill, border, icon, label, and label visibility. |
| `S.edge-style(field, style)` | Styles a relation's edge line and label, or hides the edge. |
| `S.attribute(field)` | Shows a field as text inside its source node instead of as an edge. |
| `S.tag(to-tag, name, value)` | Adds computed text to matching nodes while retaining the original edges. |
| `S.hide-field(field)` | Hides a field's drawn edges. |
| `S.inferred-edge(name, selector)` | Draws additional edges computed from a selector. |

`field` names a relation; optional `selector` and `filter` fields narrow where
field-based directives apply. `tag` takes a unary `to-tag` selector and a
`value` selector whose first column identifies the node receiving the tag.

```pyret
[list:
  S.flag(S.hide-disconnected-built-ins),
  S.atom-style("leaf", {border-style: S.border-style({
    color: "#2563eb", width: 2
  })}),
  S.edge-style("left", {line-style: S.line-style({
    color: "#64748b", pattern: S.dashed
  })}),
  S.attribute("value"),
  S.hide-field("internal"),
  S.inferred-edge("descendant", "^(left + right)")
]
```

Use `atom-style`, `edge-style`, and `inferred-edge` for new styles. The exported
`icon`, `atom-color`, and `edge-color` constructors are older forms retained for
compatibility.

## Optional fields and reusable style blocks

Rules with optional fields have a short constructor for their required
arguments and a `-with` constructor that takes a Pyret record of named fields.
`atom-style` takes a selector and a style record; `edge-style` takes a field
and a style record. Within those records, nested styles use the named types
`S.TextStyle`, `S.LineStyle`, `S.FillStyle`, `S.BorderStyle`, and `S.IconStyle`.
For example, `S.text-style({color: "navy"})` makes a `TextStyle`. Leave any
field out to let Spytial Core supply its display default.

```pyret
S.orientation-with("children", [list: S.below], {hold: S.always})

S.group-with("children", "Family", {
  add-edge: S.group-add-edge({
    points: S.togroup,
    line-style: S.line-style({weight: 2})
  }),
  text-style: S.text-style({color: "#7c3aed"})
})
```

The group example draws a connector from each group key to its box. Its
`line-style` styles that connector; the group's own `text-style` styles its
caption. Most rule records also accept a `source: S.rule-source({...})` field;
this records the originating rule text and optional location
for error reports without changing layout.

The [generated rule reference](SPYTIAL_RULES_REFERENCE.md) lists every
constructor, option, enum, and style block for the currently pinned Core
language version. Spyret checks Pyret types through annotations, then checks
numeric bounds, string patterns, and direction compatibility while serializing.

## How rules become a diagram

`_spytial` returns `List<S.SpytialRule>`. Spyret turns each list into one YAML
document with `constraints` and `directives` sections; constructors choose the
correct section automatically. `S.diagram(value)` collects the hooks reachable
from `value`. To bypass hooks, call `S.diagram-with-rules(value, rules)`; an
existing YAML document can be passed as `S.diagram(value, yaml)`.

For example, `S.orientation("left", [list: S.below])` represents the
following constraint (the serializer quotes YAML keys and strings):

```yaml
constraints:
  - orientation:
      selector: left
      directions: [below]
directives: []
```

For host code, `getSpytialSpec(value, runtime)` returns the collected YAML
documents as `string[]`, and `spytialRulesToYaml(rules, runtime)` serializes an
already evaluated list. See [layout hooks](SPYTIAL_HOOKS.md) for collection
order, error behavior, and runtime requirements.
