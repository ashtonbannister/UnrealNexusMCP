# Third-party boundaries

Nexus's routing core is original code under this repository's existing MIT
licence. It uses provider interface names and source-backed audit facts; it does
not vendor native plugins, external server implementations, model weights or
restricted components.

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
