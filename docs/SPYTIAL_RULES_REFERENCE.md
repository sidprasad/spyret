# Generated Pyret rule reference

Core 6.3.2; language 2026-09-18.

Import `pyret/spytial.arr` as `S`. Constructors return `S.SpytialRule` automatically.
Optional fields use typed options. Start with `S.default-<rule>-options`,
chain `.with-<field>(value)`, then pass it to `<rule>-with` after the required arguments.
Style blocks similarly offer `default-<block>` and `.with-<field>(value)`.

Numeric bounds, patterns and incompatible direction combinations are checked during serialization.

| Constructor | Optional fields |
| --- | --- |
| `orientation(selector :: String, directions :: List<Direction>)` | `hold: Hold`, `source: RuleSource` |
| `cyclic(selector :: String)` | `direction: Rotation`, `hold: Hold`, `source: RuleSource` |
| `align(selector :: String, direction :: Alignment)` | `hold: Hold`, `source: RuleSource` |
| `group(selector :: String, name :: String)` | `add-edge: GroupAddEdge`, `show-label: Boolean`, `text-style: TextStyle`, `hold: Hold`, `source: RuleSource` |
| `size(width :: Number, height :: Number)` | `selector: String`, `source: RuleSource` |
| `hide-atom(selector :: String)` | `source: RuleSource` |
| `flag(name :: LayoutFlag)` |  |
| `atom-style()` | `selector: String`, `fill-style: FillStyle`, `border-style: BorderStyle`, `icon-style: IconStyle`, `text-style: TextStyle`, `show-label: Boolean`, `source: RuleSource` |
| `edge-style(field :: String)` | `selector: String`, `filter: String`, `line-style: LineStyle`, `text-style: TextStyle`, `show-label: Boolean`, `hidden: Boolean`, `source: RuleSource` |
| `attribute(field :: String)` | `selector: String`, `filter: String`, `text-style: TextStyle`, `source: RuleSource` |
| `tag(to-tag :: String, name :: String, value :: String)` | `text-style: TextStyle`, `source: RuleSource` |
| `hide-field(field :: String)` | `selector: String`, `filter: String`, `source: RuleSource` |
| `inferred-edge(name :: String, selector :: String)` | `draw: String`, `line-style: LineStyle`, `text-style: TextStyle`, `color: String`, `style: LinePattern`, `weight: Number`, `highlight: String`, `source: RuleSource` |
| `icon(selector :: String, path :: String)` (deprecated; use atom-style) | `show-labels: Boolean`, `source: RuleSource` |
| `atom-color(value :: String, selector :: String)` (deprecated; use atom-style) | `source: RuleSource` |
| `edge-color(field :: String, value :: String)` (deprecated; use edge-style) | `selector: String`, `filter: String`, `style: LinePattern`, `weight: Number`, `highlight: String`, `show-label: Boolean`, `hidden: Boolean`, `source: RuleSource` |

## Enum values

- `TextSize`: `text-size-small`, `text-size-normal`, `text-size-large`
- `LinePattern`: `line-pattern-solid`, `line-pattern-dashed`, `line-pattern-dotted`
- `IconPlacement`: `icon-placement-full`, `icon-placement-badge`
- `Direction`: `direction-above`, `direction-below`, `direction-left`, `direction-right`, `direction-directly-above`, `direction-directly-below`, `direction-directly-left`, `direction-directly-right`
- `Hold`: `hold-always`, `hold-never`
- `Rotation`: `rotation-clockwise`, `rotation-counterclockwise`
- `Alignment`: `alignment-horizontal`, `alignment-vertical`
- `GroupEdgeDirection`: `group-edge-direction-none`, `group-edge-direction-togroup`, `group-edge-direction-fromgroup`
- `LayoutFlag`: `layout-flag-hide-disconnected`, `layout-flag-hide-disconnected-built-ins`

## Blocks

- `text-style(size: Option<TextSize>, color: Option<String>)`
- `line-style(color: Option<String>, pattern: Option<LinePattern>, weight: Option<Number>, highlight: Option<String>)`
- `fill-style(color: Option<String>)`
- `border-style(color: Option<String>, width: Option<Number>)`
- `icon-style(path: Option<String>, placement: Option<IconPlacement>, opacity: Option<Number>)`
- `rule-source(text: String, location: Option<String>)`
- `group-add-edge(points: Option<GroupEdgeDirection>, line-style: Option<LineStyle>, text-style: Option<TextStyle>)`
