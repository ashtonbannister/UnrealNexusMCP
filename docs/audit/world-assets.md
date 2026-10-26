# World and asset selection audit

Review date: 2026-10-26. Static source review, not Unreal runtime validation.
The target initially contained only LICENSE. Exclusions concern competing Nexus
defaults, not upstream safety internals.

## Selected defaults

- Actor inspect: UE-MCP level/get_actor_details, canonical paths and explicit
  world/pieInstance [S1]. UAP accepts world arguments but inspects editor-world
  actors [S2]; exclude the equivalent default, preserve distinct regex search.
- Current-level save: UE-MCP level/save, fixing commitDeletes=false and
  includeExternalActors=true; force defaults false. It rejects PIE, flushes
  landscape work, handles external packages and reports failures [S3].
  Prefer it over EngineWire's narrower current-save path [S4]; preserve save-as.
- Exact asset save: UE-MCP asset/save, requiring nonempty assetPaths:string[].
  Preflight targets, use actual loaded packages and retain saved/not-dirty/failed
  receipts [S5]. Reject omitted scope, assetPath=all and mixed singular/plural
  selectors. Claireon's load/reserialize operation, which dirties clean packages,
  is a separate intent [S6].

## Conditional candidates, not callable initially

EngineWire control_actor.set_transform compares requested and actual transforms
and reports per-item failures [S7]. Its resolver can choose the first exact
label/name and prefers PIE [S8]. Require full-path/explicit-world preflight.
Preserve UE's exact PIE-instance movement variant [S9].

UE asset/import_file is preferred for generic imports with filePath/packagePath,
replaceExisting=false, save=true and automated=true. Checked saves cover
produced objects and propagate persistence failures [S10]. Native replacement
defaults true: restrict factories and paths and do not assume third-party
factories honor collision flags.

Preserve specialized import contracts. EngineWire has source-boundary checks
and Interchange handling but may return success with saved=false [S11].
Hayba's restricted Windows import uses pinned handles, ancestor leases,
registry/memory/disk collision checks and identity readback [S12]. These are
not interchangeable implementations.

## No safe general deletion winner

UE actor deletion ignores the destroy return before counting success [S13].
EngineWire checks it [S14], but inherits ambiguous exact-match targeting [S8].
A full-path, editor-only adapter still requires qualification.

UE asset deletion has reference/PIE guards but can miss registry-orphan files
[S15]. EngineWire checks disk/registry but may return aggregate success after
partial deletion [S16]. Hayba force-delete is not a reference-safe default
[S12]. Preserve partial/unknown outcomes; do not promote them to full success.

## Foliage and landscape boundary

This world/assets review alone establishes no whole-family winner. The
[specialized audit](specialized.md) separately identifies scoped source-preferred
candidates; neither foliage nor landscape authoring is in the initial executable
catalogue. Their distinct algorithms are not generic actor operations.

Preserve landscape flushing during save [S3]. Claireon placement may add an ISM
instance and return an index [S17]: this is neither a standalone actor nor a
lossless substitute for foliage painting.

## Master guidance and acceptance

1. Discover revision and world; resolve canonical actor paths immediately before
   mutation. Do not choose the first repeated label.
2. Keep editor worlds, PIE instances, ISM instances, foliage and unloaded World
   Partition content distinct.
3. Require explicit save scope and inspect every package receipt; memory edits
   are not persistence.
4. Preserve native transactions, game-thread guards, warnings and partial results.
5. Reconcile uncertain work before further mutation. No replay or provider
   fallback after timeout; timeout is not cancellation.
6. Promote conditional routes only after real-editor tests for repeated labels,
   multi-PIE targets, external packages, failed saves, import collisions and
   partial deletion.

## Immutable source evidence

[S1]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Level/LevelHandlers.cpp#L1355-L1478
[S2]: https://github.com/ImagineTheGames/UnrealAgentPlayer/blob/4ab7a62eb78612c2ec110f683b6e11f5dea62e95/mcp-server/src/unreal_agent_player/tools/actor.py#L8-L132
[S3]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Level/LevelHandlers_Save.cpp#L259-L383
[S4]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/Level/Lifecycle/McpLevelSaveCurrent.cpp#L13-L113
[S5]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Asset/AssetHandlers.cpp#L3700-L3895
[S6]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_AssetResave.cpp#L60-L159
[S7]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/ControlActor/McpActorTransform.cpp#L7-L182
[S8]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/ControlActor/McpActorLookup.cpp#L5-L117
[S9]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Level/LevelHandlers.cpp#L2000-L2099
[S10]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Asset/AssetHandlers_Import.cpp#L880-L1025
[S11]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/AssetWorkflow/Operations/McpAssetImportDuplicate.cpp#L20-L345
[S12]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/unreal/HaybaMCPToolkit/Source/HaybaMCPToolkit/Private/handlers/HaybaMCPAssetHandler.cpp#L1205-L1565
[S13]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Level/LevelHandlers.cpp#L1268-L1353
[S14]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/ControlActor/McpActorLifecycle.cpp#L5-L101
[S15]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Asset/AssetHandlers.cpp#L2942-L3020
[S16]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/AssetWorkflow/Operations/McpAssetAssetMutation.cpp#L138-L310
[S17]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_PlaceActor.cpp#L240-L315
