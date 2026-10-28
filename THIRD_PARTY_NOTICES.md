# Third-party boundaries

Nexus's routing core is original code under this repository's existing MIT
licence. It uses provider interface names and source-backed audit facts; it does
not vendor complete native plugins, external servers, model weights or restricted
components. The optional source patches include small upstream context excerpts.

| Upstream | Inspected licence boundary |
|---|---|
| db-lyon/ue-mcp | MIT |
| ChiR24/Unreal_mcp / EngineWire | MIT root and plugin |
| believer-oss/Claireon | MIT; bundled embedding model has a separate MIT notice |
| ImagineTheGames/UnrealAgentPlayer | MIT |
| zajalist/hayba | MIT; bundled assets carry their own notices |
| IvanMurzak/Unreal-MCP | Apache-2.0 root; RQL and vendored Code-Exec use PolyForm Shield 1.0.0 |

Exact repository URLs and reviewed revisions are in
`catalog/upstreams.lock.json`; source evidence is in the audit documents.

Do not interpret a root licence as applying uniformly to every bundled component.
Do not strip notices when copying code in future work. The PolyForm Shield
components were not copied, adapted or relicensed here. Keeping a component behind
an external adapter does not by itself settle whether a proposed use complies
with its licence.

Future vendoring must include the exact upstream notices and a component-level
licence inventory. A source revision update also requires rechecking licence and
dependency changes.

## Optional patch notices

The Claireon, Hayba and UnrealAgentPlayer patch contexts derive from their pinned
MIT sources. Their complete original notices are preserved here:

- [Claireon MIT notice](third_party/licenses/Claireon-MIT.txt)
- [Hayba MIT notice](third_party/licenses/Hayba-MIT.txt)
- [UnrealAgentPlayer MIT notice](third_party/licenses/UnrealAgentPlayer-MIT.txt)

Keep these notices and the upstream notices when distributing patched builds.
Nexus's new wrapper/patch changes do not remove any upstream attribution.

## Runtime SDK dependencies

The gateway uses the official Model Context Protocol TypeScript SDK packages:
`@modelcontextprotocol/client`, `@modelcontextprotocol/core` and
`@modelcontextprotocol/server` at 2.4.0, and `@modelcontextprotocol/node` at 2.1.2.
These packages are Apache-2.0 licensed. `package-lock.json` pins their transitive
dependency versions and integrity values. npm installation retains their licence
files; `node_modules` is not vendored into this repository. Review dependency
notices again when redistributing a bundled executable or updating the lockfile.
