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
