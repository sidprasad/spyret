# Generated Pyret rule reference

Core 6.3.2; language 2026-09-18.

Import `pyret/spytial.arr` as `S`. Constructors return `S.SpytialRule` automatically.
Enum values are qualified through `S`, for example `S.below` and `S.horizontal`.
Optional fields use Pyret records with named keys. Pass the record to `<rule>-with`;
`atom-style(selector, style)` and `edge-style(field, style)` take one directly.
Nested style blocks are typed constructors such as `S.fill-style({color: "red"})`.
Unset fields are omitted from YAML; Spytial Core supplies their defaults.

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
| `atom-style(selector :: String, style :: Any)` | A record with optional `fill-style`, `border-style`, `icon-style`, `text-style`, `show-label`, and `source` keys. |
| `edge-style(field :: String, style :: Any)` | A record with optional `selector`, `filter`, `line-style`, `text-style`, `show-label`, `hidden`, and `source` keys. |
| `attribute(field :: String)` | `selector: String`, `filter: String`, `text-style: TextStyle`, `source: RuleSource` |
| `tag(to-tag :: String, name :: String, value :: String)` | `text-style: TextStyle`, `source: RuleSource` |
| `hide-field(field :: String)` | `selector: String`, `filter: String`, `source: RuleSource` |
| `inferred-edge(name :: String, selector :: String)` | `draw: String`, `line-style: LineStyle`, `text-style: TextStyle`, `color: String`, `style: LinePattern`, `weight: Number`, `highlight: String`, `source: RuleSource` |
| `icon(selector :: String, path :: String)` (deprecated; use atom-style) | `show-labels: Boolean`, `source: RuleSource` |
| `atom-color(value :: String, selector :: String)` (deprecated; use atom-style) | `source: RuleSource` |
| `edge-color(field :: String, value :: String)` (deprecated; use edge-style) | `selector: String`, `filter: String`, `style: LinePattern`, `weight: Number`, `highlight: String`, `show-label: Boolean`, `hidden: Boolean`, `source: RuleSource` |

## Enum values

- `TextSize`: `small`, `normal`, `large`
- `LinePattern`: `solid`, `dashed`, `dotted`
- `IconPlacement`: `full`, `badge`
- `Direction`: `above`, `below`, `left`, `right`, `directly-above`, `directly-below`, `directly-left`, `directly-right`
- `Hold`: `always`, `never`
- `Rotation`: `clockwise`, `counterclockwise`
- `Alignment`: `horizontal`, `vertical`
- `GroupEdgeDirection`: `no-group-edge`, `togroup`, `fromgroup`
- `LayoutFlag`: `hide-disconnected`, `hide-disconnected-built-ins`

## Blocks

- `text-style({size: TextSize?, color: String?})`
- `line-style({color: String?, pattern: LinePattern?, weight: Number?, highlight: String?})`
- `fill-style({color: String?})`
- `border-style({color: String?, width: Number?})`
- `icon-style({path: String?, placement: IconPlacement?, opacity: Number?})`
- `rule-source({text: String, location: String?})`
- `group-add-edge({points: GroupEdgeDirection?, line-style: LineStyle?, text-style: TextStyle?})`
