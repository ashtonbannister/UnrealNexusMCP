# UE-MCP update candidate — 2026-11-11

Scope: initial source and isolated-build assessment of UE-MCP `da2c0fb5b49b3ef0dc3aba2c761155e40e8fcce8` against Nexus's pin `62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d`. The pin and installed editor plugin have not been changed. This is not a promotion or native qualification.

- The candidate is 903 commits ahead. `git diff --no-renames --name-only` lists 1,024 changed paths, including both sides of renames. The snapshot's recorded handler count rises from 1,206 to 1,384: 178 added, none removed by name. These counts are source records, not proven unique capabilities.
- The recorded 5.8 Epic catalogue moved from `tests/golden/epic-catalog.json` to `tests/golden/epic-catalog/5.8.json` without a content change; a separate 5.9 snapshot was added. Inventory paths and supported-version claims must be updated deliberately.
- The reviewed native-handler snapshots for current Nexus routes retain the same parameter names and basic types, except input-hold start adds optional `control_rotation` and `duration_seconds`, and input-hold update adds optional `control_rotation`. This is a schema comparison, not proof that handlers or helpers behave identically.
- `place_actor` now calls `FinishEditorSpawn`, which invalidates the lighting cache for an actor in an editor world after properties are applied. PCG connection now checks pin labels and emits structured edge-refusal details. Review these changed effects and receipts before changing Nexus's pin or result policies.
- Candidate package version is `1.4.14-beta.1`. In a temporary Linux checkout, `npm ci --ignore-scripts` and the TypeScript server compilation succeeded under Node 24.11.1. The upstream unit suite reported 4,492 passing, five skipped and one failing test. The failure matched `/root` in the ordinary text `parameters/root parameters`; the affected seven-test file passed on rerun with a temporary non-root HOME. This focused rerun explains the original failure but is not a clean rerun of the whole suite.
- GitHub's comparison returns at most 300 changed file entries; the local Git diff was used for complete path enumeration. A no-renames manifest is necessary to retain both old and new paths in impact analysis.

Next: compare transport and the remaining selected handler implementations and dependencies, refresh the source inventory and decision evidence against this exact revision, adapt affected Nexus contracts and fixtures, then qualify the candidate's actual built and loaded editor plugin. The currently running editor has unsaved user-requested test objects; do not stop it or replace its plugin during this source-only assessment. Preserve the old pin and artifacts for explicit rollback, and do not replay uncertain mutations.

## Candidate server contract check

The candidate TypeScript server was launched in micro mode in a temporary Linux environment with **no Unreal project argument**. Its actual `tools` descriptions were passed through Nexus's existing UE capability checks for all 15 currently catalogued UE-MCP operations; all 15 descriptions were accepted. The process and project identity responses were synthetic test inputs, not evidence of a live editor or source attestation. This confirms the candidate server's advertised parameter contracts fit the current Nexus probes; it does not validate changed native implementation semantics, loaded artifacts, held routes, or a candidate plugin build.

Nexus's `verifySourceSnapshot` also accepted the temporary candidate checkout when given the exact candidate commit: tracked source was clean and no unignored additions were found. That check intentionally excludes ignored build products and does not establish loaded binary provenance.

## Reproducible evidence-span mapping

`node scripts/map-candidate-evidence.mjs ue-mcp <absolute-upstream-checkout> da2c0fb5b49b3ef0dc3aba2c761155e40e8fcce8` reads the pinned and candidate Git objects without running upstream code. For this candidate it reports 24 existing UE decision-evidence spans: 15 unchanged and uniquely located, and nine changed. A matching span is only a review pointer: shared helpers, interfaces, side effects and live registration may still differ. The script never updates the pin or declares a route compatible.

With `--include-inventory`, the same comparison includes source-evidence spans from the current local capability inventory, including the pre-existing uncommitted Sequencer records. It mapped 70 spans total: 54 unchanged and uniquely located, 16 changed, covering 34 UE inventory records. This identifies review work; it does not automatically carry a disposition to the new revision or modify the existing inventory.

## Coordinator candidate checkpoint

An isolated coordinator candidate based on `a0353f8af2e7067d2ddb0dd3616fd5f6c212c7b8` now points its UE source metadata at the new commit, carries all 1,384 recorded handlers, updates the 5.8 Epic snapshot path, and preserves 34 earlier blocked-source reviews as historical rather than asserting they were reviewed at the new revision. Fifteen byte-identical decision-evidence spans were remapped; actor placement and discovery were separately updated with their changed source references. Seven changed decision references and the re-review of historical inventory remain outstanding. The 5.9 Epic snapshot has not yet been incorporated. This incomplete candidate is not ready to run or merge.

A recoverable WIP patch was retained outside the repository in the task artifact folder as `ue-mcp-upgrade-candidate-a0353f8.patch`, SHA-256 `1b51c7ef610020876d95fc479a97b770497dd4b0719e523197b24172e0a03bf1`. It is based on `a0353f8af2e7067d2ddb0dd3616fd5f6c212c7b8` and was checked against the isolated candidate. It is a checkpoint, not a release artifact or approval to deploy.

## Coordinator candidate v2

The isolated candidate now maps all 24 existing UE decision-evidence references to the candidate revision, preserving their earlier versions as historical evidence and recording the observed changed behavior. Its inventory validator also checks the 34 historical source reviews rather than presenting them as current-pin decisions. The 178 additional handler records are present as unreviewed source inventory; the separate 5.9 Epic snapshot is not yet incorporated.

In the isolated candidate, a clean `npm ci --ignore-scripts` followed by `npm run check` passed 258 tests with zero failures or skips under Node 24.11.1 and the pristine pinned UAP fixture source. Catalog and inventory consistency checks also passed. These are source/fixture checks; the updated UE plugin has not been built or loaded in Unreal, and provider selection and native qualification are not complete.

The recoverable v2 patch is `ue-mcp-upgrade-candidate-a0353f8-v2.patch` in the task artifact folder, based on `a0353f8af2e7067d2ddb0dd3616fd5f6c212c7b8`, SHA-256 `3639d36db7a03071ebc13cfde5094d7c129fe8af8a7ac72373a9f3226da55ced`. It was checked against the isolated working candidate. The earlier checkpoint above remains historical.

## Coordinator candidate v3

The isolated candidate now also inventories the separately recorded UE 5.9 Epic catalogue: 109 recorded toolsets and 1,914 records on a distinct source surface. These records can overlap the 5.8 snapshot and do not establish that a UE 5.9 editor or those tools are installed. The inventory validator checks both snapshots separately. The existing 34 prior UE blocked-source reviews remain historical and require renewed review at the candidate pin.

The full isolated coordinator check passed 259 tests with zero failures or skips using Node 24.11.1 and the pinned UAP fixture source. The v3 WIP patch is `ue-mcp-upgrade-candidate-a0353f8-v3.patch` in the task artifact folder, based on `a0353f8af2e7067d2ddb0dd3616fd5f6c212c7b8`, SHA-256 `93cdbd5e169358d8ba968d38baf88acd5ab5808167829b166592817c25a22432`; it was checked against the isolated working candidate. This is not a native build, deployment, or release qualification. The earlier v1 and v2 checkpoints remain historical.

## Coordinator candidate v4: PCG graph inspection

The newer UE-MCP graph read reports ordinary node input/output pin labels as well as graph nodes and edges. The isolated coordinator candidate now routes `pcg.graph.inspect` to that fixed read, preserves the native response, and retains the earlier whole-record review as historical context. The native path is echoed rather than independently resolved, enumeration is not paginated, and the result has no immutable graph revision; inspect and revalidate before editing.

The candidate server advertised the expected `pcg.read_graph` to `read_pcg_graph` mapping and required string `assetPath` in a synthetic, no-editor description check. The full isolated coordinator suite passed 260 tests with zero failures or skips on Node 24.11.1. This route has not yet been exercised against the new native plugin in Unreal.

The recoverable v4 patch is `ue-mcp-upgrade-candidate-a0353f8-v4.patch` in the task artifact folder, based on `a0353f8af2e7067d2ddb0dd3616fd5f6c212c7b8`, SHA-256 `44bc2a5d21335cb73afd42106fc86be294b47a54a708ae2436c71a6653943663`; it was checked against the isolated working candidate. The earlier checkpoints remain historical. Candidate source and fixture evidence is not native deployment or release qualification.

## Isolated native plugin build

The UE-MCP `da2c0fb5b49b3ef0dc3aba2c761155e40e8fcce8` plugin was copied into a separate `NexusBuildHost` project and built on Windows against the installed UE 5.8.4 engine with `-plugin=<isolated copy> -WaitMutex -NoEngineChanges -NoHotReload`. UnrealBuildTool reported `Result: Succeeded` after 420 build actions. This compiled the candidate; it did not load it into the running Henday Heat editor or execute its native tests.

Before building, 582 copied source files matched the candidate checkout byte-for-byte; the same source files still matched afterward. The compiler emitted engine/template and deprecated-API warnings and identified Visual Studio toolchain 14.52.37029 as newer than its preferred version. The original build log is preserved locally alongside the isolated build host as `build-output-original.bin`, SHA-256 `32858ef12c458bfc5aae8abb2d1a4eca8aeb849ac7f585d97b36abbe74917c9f`; `build-output.log` is an LF-normalized reading copy.

| Isolated build output | SHA-256 |
| --- | --- |
| UnrealEditor-UE_MCP_Bridge.dll | `9e68cb0be61358931fc924d434ed05dfe25f3bcc5ff1fd4d81f5ad4c837d2f22` |
| UnrealEditor-UE_MCP_BridgeMVVM.dll | `89cc760a174a5d98fb1b2bec451f2300fcb3daa4218be6aa6d4029b8e81c826b` |
| UnrealEditor-UE_MCP_BridgeRuntime.dll | `91aed3eb376ec7b4caf554c0ee16dd3182ce01ee120593231d461cbaf68e53cf` |
| UnrealEditor-UE_MCP_BridgeStatus.dll | `d634ff39c56a537c2a30d8c6862af9cbc519e6561b27b66581deee9e069aee30` |

The initial project-target build was refused because the existing editor's Live Coding session held the shared editor-executable mutex. The owner authorized temporarily stopping Live Coding; disabling its preference did not terminate the already-started session. The successful build used UnrealBuildTool's foreign-plugin path, which scoped output to the separate plugin copy, while retaining `-NoEngineChanges`. The prior Live Coding preference was restored and the original editor and unsaved level remained open. Loading the new binary and proving its identity and behavior remain separate steps.
