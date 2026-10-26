# Capability inventory and audit index

Reviewed 2026-10-26. Read-only source inspection, JSON parsing and Python AST
literal extraction; no upstream modules were imported or executed.

These counts describe different layers, not comparable public-tool totals.
Do not add or rank them, or treat them as exhaustive semantic deduplication.
Pins and measured file hashes are in
[catalog/inventory-summary.json](../../catalog/inventory-summary.json).

## Domain reports

- [World and assets](world-assets.md)
- [Graphs, materials and UI](graphs-materials-ui.md)
- [Testing and observation](testing-observation.md)
- [Specialized capabilities](specialized.md)
- [Coordination, lifecycle and licensing](coordination.md)

Together with this inventory these are six source-review reports.
The machine-readable [decisions](../../catalog/decisions.json) and
[canonical operations](../../catalog/operations.json) determine runtime exposure.

## Pinned inventory subsets

| Provider | Measured subset | Public MCP surface |
|---|---|---|
| EngineWire [EW] | 427 canonical records; 1,582 distinct legacy pairs; 219 folded records; 23 internal parents | One tool: unreal |
| UE-MCP [UE] | 30 built-in categories; snapshots of 1,206 bridge specs and 830 Epic tools / 52 toolsets | Default micro tool: tools |
| UAP [UAP] | 44 literal public tool descriptors | Direct named tools over stdio |
| Claireon [CL] | Two native public names; optional proxy has three | tool_search, python_execute; proxy adds proxy |
| Hayba [HAY] | 160 legacy commands; 112 generator candidates before collisions | Deferred routing; seven bootstrap declarations before packs |
| Ivan Unreal-MCP [IV] | 26 standard editor declarations across six families | External MCP server; system/extensions/runtime differ |

## Fixed backend invocation forms

These describe backend contracts, not permission to expose arbitrary provider,
action or Python selection. Placeholders must come from reviewed fixed routes.

```text
UE-MCP:
tools({action:"call", category:CATEGORY, method:ACTION, args:PARAMS})

EngineWire:
unreal({operation:"execute", capability:CAPABILITY_ID, params:PARAMS})
or a fixed tool + action route

UAP:
NATIVE_TOOL(PARAMS)

Hayba (future adapter):
hayba_invoke({name:NATIVE_TOOL, args:PARAMS, via:"ts"})

Claireon (future adapter):
tool_search({query:QUERY, max_results:10})
python_execute({code:REVIEWED_WRAPPER, quiet:false})
```

Claireon internal catalog names are not public MCP tools. Fixed reviewed
wrappers must invoke claireon.<fixed_operation>, never caller-supplied code.
Hayba via:"ts" can fall through to legacy if a typed schema is missing;
future adapters must verify the expected typed contract.

Preserve EngineWire native authorization/consent through HTTP/SSE or its stdio
proxy. UE and Hayba use stdio; separate HTTP features are not automatically
interchangeable MCP transports.

## Extraction caveats

- EngineWire registry revision is 0b875b14b2156784. Preserve folded selectors
  and dispatch variants; documentation counts of 416/1,554 are stale here.
- UE golden snapshots overlap and omit local/extension behavior. The Epic
  snapshot records UE 5.8. Live registration and surface mode gate availability.
- UAP descriptors were extracted with ast.parse and ast.literal_eval, without
  imports. Static listing does not prove platform/rendering/PIE availability.
  Failure may arrive in text JSON despite successful transport.
- Claireon internal C++ schemas/gates need operation-specific review. No full
  internal count is claimed.
- Hayba legacy candidates use agent_callable=true and has_ts_wrapper=false.
  Collisions, settings and dynamic packs change exposure; no fixed public total
  is established.
- Ivan counts exclude system/extensions; runtime listing can be empty. The
  external MCP server is not this repository. Vendored RQL/Code-Exec licensing
  differs from the root Apache license; no restricted source was copied.

## Verification boundary

A source pin is not proof that a capability is installed/enabled, appropriate
to current editor state or live-qualified. Missing adapters stay unavailable,
without provider fallback.

The target began with LICENSE only. This is an original selection foundation,
not deletion of pre-existing backend implementations. Static tests are not a
native build, complete equivalence proof or exhaustive upstream pruning.

## Immutable source evidence

[EW]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/src/tools/catalog/capabilities/generated/canonical-registry.generated.json
[UE]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/tools.ts
[UAP]: https://github.com/ImagineTheGames/UnrealAgentPlayer/blob/4ab7a62eb78612c2ec110f683b6e11f5dea62e95/mcp-server/src/unreal_agent_player/registry.py
[CL]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/ClaireonServer.cpp
[HAY]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/legacy-commands/sidecar.json
[IV]: https://github.com/IvanMurzak/Unreal-MCP/blob/1fb60e84bf8bea8f3e5bf6c27737e79fd7940d07/UnrealMCP/Source/UnrealMcpEditor/Private/Tools/UnrealMcpBlueprintTools.cpp
