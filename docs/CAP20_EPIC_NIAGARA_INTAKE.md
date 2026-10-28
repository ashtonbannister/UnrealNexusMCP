# CAP-20 recorded Epic snapshot: Niagara intake slice

Status: partial source inventory and contract intake; no selection, executable route, native availability or qualification. The source is UE-MCP's recorded [`tests/golden/epic-catalog.json`](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/tests/golden/epic-catalog.json) at the locked revision. Its SHA-256 is `3cdc25ececd56fdcaa34874408a8cfe964827f47fc37b937ce237805252e63d1`, matching `catalog/inventory-summary.json`. It records an `engineAssociation` of `5.8`; this is snapshot metadata, not an assertion that an installed editor has that version or supports any entry.

The authoritative `catalog/capability-coverage.json` enumerates 52 groups and 830 distinct fully qualified descriptors, retaining the recorded required input names and whether a structured output schema exists. Counts agree with the snapshot itself. Extraction parsed JSON only; no upstream modules were loaded. All entries remain **unreviewed** and require semantic disposition. These are tool descriptors from one recorded catalog layer: they may overlap the 1,206 UE bridge-handler records or other providers, but names do not establish equivalence, actual dispatch, implementation semantics, runtime registration, licensing, authority or completeness. Do not add counts as public-tool totals.

## Candidate intake for CAP-19 effects

The snapshot records 56 descriptors under five Niagara groups: Assets (3), Blueprint (2), Component (4), Info (1), and System (46). Their exact identifiers and required input names are in the companion artifact. CAP-19 remains the relevant effects intake task. These groups represent different candidate contracts and should not be collapsed into one "Niagara" operation:

| Recorded descriptor | Recorded inputs and distinction | Required source and native review before admission |
| --- | --- | --- |
| `NiagaraToolsets.NiagaraToolset_Assets.FindNiagaraScripts` | Seven required filters, including folder, usage and recursion; descriptor says registry-tag search. | Bounds, pagination and registry completeness; filter behavior and loaded editor identity. An empty folder allows broad search and must not silently imply a bounded response. |
| `NiagaraToolsets.NiagaraToolset_Assets.GetNiagaraScriptDigest` | Exact `objectPath`; descriptor describes registry metadata. | Exact object identity, missing/stale asset handling, output bounds and whether metadata reflects unsaved edits. |
| `NiagaraToolsets.NiagaraToolset_Blueprint.ConstructNiagaraBPWrapperFromComponent` | `newAssetPath`, `component`, `parentClass`; intended to preserve component overrides. | Exact target/world, output asset collisions, copied override coverage, compile and save effects, partial failure and reload. |
| `NiagaraToolsets.NiagaraToolset_Blueprint.ConstructNiagaraBPWrapperFromSystem` | `newAssetPath`, `system`, `parentClass`; source is a system, not a configured component. | Different source identity and preservation semantics; collision, compile/save and reload checks. Do not infer it is equivalent to the component variant. |
| `NiagaraToolsets.NiagaraToolset_Component.GetUserVariables` / `GetVariable` | Component `refPath`; specific read also requires `var`. Both record output schemas. | Explicit editor versus PIE instance and component identity, type coverage, output bounds and failure when a variable is absent. |
| `NiagaraToolsets.NiagaraToolset_Component.SetSystem` | `niagaraComponent`, `system`, `bResetExistingOverrideParameters`; no output schema recorded. | The reset flag can affect existing overrides. Require explicit ownership, dirty/persistence scope, receipt and readback; absence of an output schema is not proof of failure or success. |
| `NiagaraToolsets.NiagaraToolset_Component.SetVariable` | `component` and typed `variable`; no output schema recorded. | Type validation, exact target and effect, partial mutation, preexisting value, dirty/save behavior and readback. |
| `NiagaraToolsets.NiagaraToolset_Info.UEnum_Info` | Exact `enum` reference and recorded output schema. | Authority, reference resolution, bounds and whether it duplicates a more general reflected-type contract. |

The 46 System descriptors still need per-operation review. Existing source inventories already contain UE bridge entries such as `get_niagara_info`, `compile_niagara_system`, and simulation-cache operations, as well as EngineWire `manage_effect.get_niagara_info`, `edit_niagara_system`, and `spawn_niagara`. These are comparison candidates only: inspect exact handler implementation, schema, target and persistence before deciding whether any overlap with the recorded Epic entries. A name similarity is not a reason to mark records as selected or rejected.

## Next evidence and limitations

1. Identify the corresponding installed-plugin/version requirements and actual public registration for each bounded candidate, without inferring availability from this snapshot.
2. Inspect source handlers and comparable pinned provider contracts, including compile/dirty/save semantics, explicit world and exact component identity, output limits, partial failures and readback.
3. Separate asset authoring and compilation from live effect/component changes, then assign independently owned child contracts and native cases. The existing CAP-19 task requires these distinctions.
4. Complete dispositions for all 830 descriptors and inspect dynamic or extension surfaces separately. This intake does not reduce the remaining unreviewed count or fulfill CAP-20.
