# Spyret library and IDE ownership

Spyret now supplies the reusable browser integration. A Drive-imported native
module can install its own CPO display adapter; the IDE does **not** need a
Spytial-specific output branch. See [library setup](BROWSER_LIBRARY.md).

| Functionality | Owner |
| --- | --- |
| Value capture, relationalization, reconstruction, `_spytial` collection | Spyret |
| Generated Pyret rule types, YAML section composition | Spyret |
| Pyret-facing diagram functions and runtime suspension/Stop handling | Spyret |
| Evaluator/layout setup, opaque handles, source preview and views | Spyret browser entry |
| CPO renderer compatibility code | Spyret, isolated in `registerCpoOutput` |
| Layout semantics, parsing, solving, graph controls and diagnostics | Core |
| Source selection, YAML source writeback, undo and keyboard shortcuts | IDE |
| Builtin aliases and package/asset delivery for existing programs | IDE build configuration |

In the separate companion IDE change, the `spytial` builtin becomes a small
forwarding wrapper around
`spyret/browser`. `spytial-rules` is a build-time copy of the generated Pyret
module. Its old `spytial-view` module and Spytial branch in `output-ui` are removed.
Existing `SP.diagram(value, yaml)` and `_output` methods continue to work; new
programs can use `SP.diagram(value)` and typed rules.

Stock CPO can instead load `spyret/pyret-module` through its existing `gdrive-js`
locator, optionally hidden behind one URL-imported `.arr` wrapper. No new native
URL locator or IDE plugin is required for that route. Drive hosting/access is a
separate deployment step.

The companion IDE change consumes a lockfile-verified vendored Spyret 0.2.0 package
archive, so this coordinated change builds without an unpublished registry
version or a sibling source checkout. Once 0.2.0 is published, replace that
archive dependency with the exact npm version and regenerate the copied assets;
no runtime code needs to change.

Future work should focus on an upstream public display-registration and
cancellation API, deployment/Drive-access testing, and optional source-editor
integration. The existing private CPO adapter remains a compatibility dependency.
