# Generated Pyret rule reference

Core 6.5.1; language 2026-09-18.

Import `pyret/spytial.arr` as `S`. Every rule takes one record and returns `S.SpytialRule`.
Put required and optional fields in the same record; omit optional fields to use Core defaults.
There are no separate `-with` constructors. Pyret checks required fields through record annotations.
Enum values are qualified through `S`, for example `S.below`, `S.dashed`, and `S.horizontal`.
Nested style blocks are typed constructors such as `S.line-style({color: "red"})`.

Numeric bounds, patterns and incompatible direction combinations are checked during serialization.

| Constructor | Required record fields | Optional record fields |
| --- | --- | --- |
| `orientation({...})` | `selector: String`, `directions: List<Direction>` | `hold: Hold`, `source: RuleSource` |
| `cyclic({...})` | `selector: String` | `direction: Rotation`, `hold: Hold`, `source: RuleSource` |
| `align({...})` | `selector: String`, `direction: Alignment` | `hold: Hold`, `source: RuleSource` |
| `group({...})` | `selector: String`, `name: String` | `add-edge: GroupAddEdge`, `show-label: Boolean`, `text-style: TextStyle`, `hold: Hold`, `source: RuleSource` |
| `size({...})` | `width: Number`, `height: Number` | `selector: String`, `source: RuleSource` |
| `hide-atom({...})` | `selector: String` | `source: RuleSource` |
| `flag({...})` | `name: LayoutFlag` |  |
| `atom-style({...})` | `selector: String` | `fill-style: FillStyle`, `border-style: BorderStyle`, `icon-style: IconStyle`, `text-style: TextStyle`, `show-label: Boolean`, `source: RuleSource` |
| `edge-style({...})` | `field: String` | `selector: String`, `filter: String`, `line-style: LineStyle`, `text-style: TextStyle`, `show-label: Boolean`, `hidden: Boolean`, `source: RuleSource` |
| `attribute({...})` | `field: String` | `selector: String`, `filter: String`, `text-style: TextStyle`, `source: RuleSource` |
| `tag({...})` | `to-tag: String`, `name: String`, `value: String` | `text-style: TextStyle`, `source: RuleSource` |
| `hide-field({...})` | `field: String` | `selector: String`, `filter: String`, `source: RuleSource` |
| `inferred-edge({...})` | `name: String`, `selector: String` | `draw: String`, `line-style: LineStyle`, `text-style: TextStyle`, `color: String`, `style: LinePattern`, `weight: Number`, `highlight: String`, `source: RuleSource` |
| `icon({...})` (deprecated; use atom-style) | `selector: String`, `path: String` | `show-labels: Boolean`, `source: RuleSource` |
| `atom-color({...})` (deprecated; use atom-style) | `value: String`, `selector: String` | `source: RuleSource` |
| `edge-color({...})` (deprecated; use edge-style) | `field: String`, `value: String` | `selector: String`, `filter: String`, `style: LinePattern`, `weight: Number`, `highlight: String`, `show-label: Boolean`, `hidden: Boolean`, `source: RuleSource` |

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
