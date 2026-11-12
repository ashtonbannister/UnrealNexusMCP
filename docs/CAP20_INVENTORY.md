# CAP-20 source inventory — initial lifecycle slice

Status: **partial source review**, not a complete capability-coverage ledger or a runtime allowlist. The accompanying [machine-readable snapshot](../catalog/capability-coverage.json) enumerates these four subsets; unreviewed records are not accepted semantic dispositions. No new route or winner is selected here. This note records a missing family and a reproducible source checkpoint for the CAP-20 curator; remaining records and dynamic surfaces still need disposition. The canonical operations and decisions remain authoritative in `catalog/`.

## Provenance and scope

On 2026-10-27, read these exact public source snapshots without importing or executing upstream modules. Their SHA-256 values matched `catalog/inventory-summary.json`:

| Provider and source | SHA-256 | Static subset and limit |
| --- | --- | --- |
| [EngineWire registry](https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/src/tools/catalog/capabilities/generated/canonical-registry.generated.json) | `5f01e136e9dc85745c7f811ec6fdb4ddf9ea16d4c4a435fc7fe35aab1615091b` | 427 records; aliases and folded selectors are not separate proven semantics. |
| [UE-MCP handler snapshot](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/tests/golden/handler-specs.json) | `58f34a96e98e500b024b90c16ff5528be34e251c9411581b7ea2b24fb21174e1` | 1,206 recorded handlers; runtime registration and other surfaces may differ. |
| [UAP registry](https://github.com/ImagineTheGames/UnrealAgentPlayer/blob/4ab7a62eb78612c2ec110f683b6e11f5dea62e95/mcp-server/src/unreal_agent_player/registry.py) | `2e1c39b44485434758006588bb0f7176ffb52bd322ecbcfd40c57c7d991776a1` | Existing literal descriptor inventory is static and does not prove live availability. |
| [Hayba legacy sidecar](https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/legacy-commands/sidecar.json) | `012a0b1e0188468f3d7c2fa956f1fb41ad5a97264cf6a6fa366b5c8e49e45a19` | 160 legacy sidecar entries, not the complete dynamically loaded public surface. |

JSON records were inspected as data. Source files were matched against the existing pinned hashes, not executed. The machine-readable ledger also includes separately scoped Claireon and Ivan source slices; remaining Claireon internals, Ivan system/extensions, UE extensions, and live or dynamic registrations are not covered. The existing [inventory report](audit/inventory.md) records other measured subsets and limitations. Neither the counts nor the rows below establish equivalent implementations.

## EngineWire discovery index

`catalog/enginewire-search-index.json` contains search-only summaries and topics extracted from the pinned EngineWire registry. `nexus.search` uses them to find source records by intent; they neither select a provider nor make a command callable. Some summaries are truncated and are marked accordingly. The generator verifies the input registry SHA-256 and pin metadata, checks the record count, and does not execute upstream code. The MIT notice is retained in `third_party/licenses/EngineWire-MIT.txt`.

To reproduce, run `node scripts/build-enginewire-search-index.mjs <pinned-enginewire-root> <new-output.json>` with Node 22 or newer, then compare the output to the committed index. The command refuses to replace an existing output. The source hash is an extraction check, not loaded-editor or live capability evidence.

## Recorded Epic toolset boundary

The separate [recorded Epic catalog](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/tests/golden/epic-catalog.json) contains 830 tool rows in 52 toolsets under a recorded `5.8` engine association. The [recorder](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/scripts/record-epic-catalog.mjs#L1-L20) obtains names and schemas from a live editor, while the [generator](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/scripts/generate-epic-actions.mjs#L3-L24) combines that snapshot with upstream effect annotations to make wrappers. For example, [generated asset actions](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/tools/epic/asset.generated.ts#L137-L158) map several distinct AssetTools names to `epic_call_tool`; those declarations are not the underlying Epic implementations. The [native bridge](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Epic/EpicHandlers.cpp#L14-L28) reflects a separately loaded ToolsetRegistry. This pinned repository does not itself establish the implementation of those 830 recorded tool rows, live registration, loaded artifact identity or runtime behavior. Each remains unreviewed until matched engine/plugin source and applicable evidence are obtained; do not derive semantic dispositions from schemas, generated labels or effects annotations alone.

The separately enumerated `epic_call_tool` raw handler is blocked as a canonical operation: it accepts a caller-selected toolset, tool and JSON and [dispatches before checking asynchronous completion](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Epic/EpicHandlers.cpp#L348-L411). An incomplete result is an error, not proof the dispatched operation had no effect. This wrapper disposition does not decide the safety or equivalence of any individual Epic tool.

## Candidate family: project and level lifecycle

The existing CAP-01–20 register does not assign a project/level lifecycle family. The following entries warrant a new owner task and individual contract comparison; none is implemented merely by listing it. Descriptions below are the pinned source records' stated behavior, not live qualification.

| Source record | Stated behavior and key distinction | Disposition / remaining review |
| --- | --- | --- |
| EngineWire `control_editor.open_level` | Opens a path and replaces the open level, stopping PIE and closing asset editors; refuses dirty packages, then waits for settling. | Planned family candidate; review target identity, state loss, modal behavior and late failure. |
| EngineWire `manage_level.create_level` | Creates, saves and opens a level; an existing destination is opened, and optional dirty-package saving has a different scope. | Distinct create/open contract candidate; do not treat as equivalent to an exclusive create. |
| UE-MCP `save_level` | Saves the current level; external actors default to included, while `commitDeletes` defaults false. | Selected route slice `level.save.current` fixes those two options. Examine exact-world binding, partial results and deleted external packages; native qualification remains pending. |
| UE-MCP `list_project_modules` | Cursor/limit-based module listing, with stated maximum 2,000 rows. | Candidate read prerequisite; establish stable pagination and bounds from implementation. |
| UE-MCP `generate_project_files` | Runs project-file generation. | Build/system mutation candidate; review subprocess authority, completion and artifact scope. |
| EngineWire `system_control.get_project_settings` | Reads settings, optionally section/category/key. | Bounded settings-read candidate; inspect private or machine-specific information exposure. |
| EngineWire `system_control.set_project_setting` | Changes a setting and persists to the setting class's project or user config file. | Distinct persistent configuration mutation; exact file/scope and reload semantics require review. |
| EngineWire `system_control.package_project` | Starts an asynchronous package job and returns a job ID. | Separate build/package job lifecycle; require ownership, poll, cancellation and artifact review. |
| Hayba `project_get_info`, `project_get_settings`, `project_list_plugins` | Sidecar entries marked agent-callable, without TS wrappers. | Comparison candidates only; inspect schemas, native handler and dynamic routing before judging equivalence. |
| Hayba `project_set_settings`, `build_project` | Sidecar entries marked agent-callable, without TS wrappers. | Mutation/build candidates only; review persistence, execution and safety boundaries. |

A family assignment is still required in the canonical task register. In particular, create/open/save/package/configuration are not interchangeable operations; project setup or plugin installation should not be inferred as authorized by the presence of a source entry. The `save_level` source states a default that can include external actor packages, and the EngineWire create operation can open an existing map or save dirty packages: none should be generalized into exact-scope behavior without source and native verification.

## Remaining CAP-20 work

- Complete `catalog/capability-coverage.json`: four static subsets are enumerated and source-hash checked; their unreviewed records need semantic dispositions and the remaining sources need extraction. Deduplicate only after checking exact semantics and selectors. The complete UE Epic snapshot, UAP descriptors, Claireon internal catalog, Hayba dynamic packs and Ivan standard/system/extension surfaces need their own measured boundary.
- Assign each in-scope semantic function to a stable task and candidate/review state; cross-check the ten unexposed decisions already mapped in the backlog. Record deliberate exclusions, preserved variants and unresolved dynamic registrations.
- Review licensing at the component boundary before reuse. Current notices identify MIT roots for EngineWire, UE-MCP, UAP and Hayba, with Hayba bundled asset notices; Claireon bundled model notices and Ivan's distinct PolyForm Shield components also need attention. See [third-party boundaries](../THIRD_PARTY_NOTICES.md). This inventory copies no upstream component code.
- Compare real source implementations and schemas before proposing routes. Source descriptors and a source pin do not prove a deployed native build, editor identity, execution safety, listener boundary or capability availability.
