# CAP-20 procedural world: bounded source dispositions

Status: **source-review slices only**, not complete records, a runtime allowlist, provider selection or native qualification. Exact provider/entry keys below occur in `catalog/capability-coverage.json`; other selectors and providers remain unreviewed. Owning CAP tasks and detailed gates remain in the [backlog](CAPABILITY_BACKLOG.md) and [procedural-world source review](CAP14_17_SOURCE_REVIEW.md).

## CAP-14: foliage

- **`ue-mcp / add_foliage_instances`**: retain explicit-transform placement and seeded-disc sampling as distinct candidates. The pinned [placement handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Foliage/FoliageHandlers_Placement.cpp#L383-L590) records placed/skipped results and can register a foliage actor before all candidates are rejected. Zero added therefore does not establish absence of side effects. World Partition rehoming can make stored instance indices stale.
- **`ue-mcp / remove_foliage_instances`**: hold exact inverse claims. The [pinned remove handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Foliage/FoliageHandlers_Placement.cpp#L596-L780) extracts locations from transform selectors and matches by distance; it does not use rotation and scale to identify a single exact instance, and may select multiple nearby instances. A capped transform-based inverse is not proof of exact removal, attachment restoration or rollback.
- **`ue-mcp / get_foliage_instances`**: retain as a read candidate with bounds and identity gaps. Its [pinned traversal](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Foliage/FoliageHandlers_Placement.cpp#L786-L893) limits emitted instances but not necessarily full candidate enumeration/sorting or type summaries. Offset/index identity is not a stable snapshot across edits.

Test deterministic seeds, all-skipped side effects, nearby matching instances, stale indices and placement/removal interruption. Live evidence must inspect exact transforms, cell ownership, unrelated nearby foliage, partial results and save/reload.

## CAP-15: landscape

- **`ue-mcp / sculpt_landscape`**: preserve as a UE smoothstep/centre-height candidate, distinct from linear-falloff and supplied-height variants. The [pinned handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Landscape/LandscapeHandlers_Sculpt.cpp#L168-L485) has layer selection and capped rollback data. A missing or capped inverse is not proof of restoration.
- **`ue-mcp / paint_landscape_layer`**: retain as a distinct dirty in-memory layer-paint candidate. The [pinned implementation](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Landscape/LandscapeHandlers_Sculpt.cpp#L487-L665) writes the selected weight layer without an automatic renormalization guarantee for other layers and does not itself establish persistent reload. Validate layer identity, units, affected bounds, flush and persistence separately.

## CAP-16: geometry

- **`enginewire / manage_geometry.boolean_mesh`**: retain the DynamicMesh actor boolean selector slice, not an equivalent StaticMesh asset operation or automatic classification of the whole folded record. The [pinned boolean handler](https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/Geometry/Modeling/McpGeometryBooleans.cpp#L11-L160) mutates DynamicMesh state, supports tool retention and uses count/bounds heuristics for no-effect checks. With tool retention disabled it can destroy the tool actor on reported success. Topology, collision, material and persistence are separate observations.

A reviewed child contract needs exact actor/representation identity, tool authority, effect and failure semantics, bounded workload and native topology/collision/material readback. None of these source slices changes the executable catalog or proves a real editor outcome.
