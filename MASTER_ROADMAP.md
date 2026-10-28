# Unreal Nexus MCP — master roadmap

Planning baseline: `c543959ef3c3c245e49248e7a5e5bbcfa40088c6`. Roadmap established: **2026-10-27**.

This is the authoritative work plan for the unified gateway. It defines sequencing, scope, dependencies and completion evidence. The companion [capability backlog](docs/CAPABILITY_BACKLOG.md) and [qualification plan](docs/QUALIFICATION_PLAN.md) are its detailed task registers. Creating this roadmap changes documentation only; it does not complete any planned code fix or native qualification.

## 1. Product goal

Give an agent one coherent Unreal tool set with the strongest reviewed implementation for each precise function. The agent works with canonical operations; Nexus handles the selected provider, validation, target identity, transport and native receipt. Enable only the capabilities the project needs, start only their required backend connections, and keep specialist domains optional.

The intended result is an agent that can discover and inspect a project, create/import and edit content, build gameplay/graphs/UI, persist exact changes, run and observe gameplay, test and profile it, and explain the observed result. The current 29 operations are the implemented foundation. Broader authoring and specialized coverage remains explicit work below.

A winner is selected per semantic contract, not per whole MCP repository. Exact world/client, persistence, completion, algorithm and failure semantics define whether two implementations are duplicates. Retain distinct useful variants. A backend becomes unnecessary for a profile only when no enabled operation or required internal dependency uses it.

“Best latest” means the best eligible implementation among inspected revisions, recorded at an immutable pin. Newer code is a candidate for review. Recency never overrides correctness or silently changes the running route.

## 2. Authority and current baseline

[AGENTS.md](AGENTS.md) requirements remain in force. This roadmap governs future work and status; [operations.json](catalog/operations.json) remains the executable allowlist, [decisions.json](catalog/decisions.json) records source-backed selections, [upstreams.lock.json](catalog/upstreams.lock.json) owns revisions, and the [master guidance draft](docs/MASTER_SKILL_GUIDANCE_DRAFT.md) owns task workflows. A planned task or proposed name is not a callable capability.

Current implementation evidence:

| Item | Recorded state |
| --- | --- |
| Gateway | 29 canonical operations in 7 capability packs; all capabilities and writes off by default |
| Selection | 23 decision groups: 13 selected, 4 conditional, 4 preserved, 2 held; 25 competing-default exclusions |
| Execution | Lazy selected-provider startup; exact schemas and fixed routes; shared process-local queue; no raw provider/Python/console/reset escape |
| Guidance | Draft served through instructions, resources and workflow prompt; no personal skill installed |
| Validation | 154 passing tests, zero failures/cancellations/skips at baseline, reproduced during [PR #1](https://github.com/ashtonbannister/UnrealNexusMCP/pull/1) review on Linux Node 24.22.1 |
| Native state | No native Unreal build or real-editor qualification established |
| Open reliability findings | [FIX-01](#fix-01) and [FIX-02](#fix-02), both P2 findings in PR #1 |
| Review evidence qualification | Full-PR whitespace checks flag unified-diff context in the content-addressed patch files; do not generalize the historical local diff-check claim |

The 154-test result belongs to the implementation baseline. It is not a fresh test run of this documentation commit, a permanent expected test count, or native qualification. See [VALIDATION.md](docs/VALIDATION.md) for its environment and limits. Historical audit reports describe their source-review snapshot; current adapter availability comes from the executable catalog and current implementation documents.

### Source pins retained by this plan

| Provider | Immutable revision |
| --- | --- |
| ue-mcp | `62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d` |
| enginewire | `5a17d6d343ef9b40a509068cff73f1bfb4509815` |
| claireon | `89bee2f4c62d1df625cca71ae66e7c81a415a009` |
| unrealagentplayer | `4ab7a62eb78612c2ec110f683b6e11f5dea62e95` |
| hayba | `b69ed11011f89aed3c444a50bd2331b99551c777` |
| ivan-unreal-mcp | `1fb60e84bf8bea8f3e5bf6c27737e79fd7940d07` |

The first five providers serve selected routes. Ivan is not required by the current 29; its unique capabilities and component licensing remain review inputs, not a claim of universal redundancy. Preserve the [third-party notices](THIRD_PARTY_NOTICES.md).

## 3. Milestones and usable profiles

Milestones express outcomes, not dates. Source review, fixture work and independent native lanes may proceed in parallel. No elapsed-time estimate or integration percentage is asserted from incomparable upstream tool counts.

| Milestone | Required outcome | Principal work |
| --- | --- | --- |
| M0 — Reliable gateway baseline | Both known reliability gaps fixed with regression evidence and accurate documentation | FIX-01, FIX-02; OPS-02 CI preparation |
| M1 — Coverage and prerequisites | A scoped semantic coverage ledger plus canonical discovery/session/image-delivery contracts | CAP-20, CAP-01, CAP-02, CAP-18A |
| M2 — Reproducible native core | Exact native environment/builds/listeners established; selected core packs and their coexistence demonstrated | ENV-01–04, LIVE-01–03 as enabled, LIVE-08 |
| M3 — Everyday authoring | Complete create/import/edit/compile/save/reopen workflows through reviewed canonical routes | CAP-03–05, CAP-07–10, CAP-17; corresponding operation evidence |
| M4 — Optional specialist coverage | Existing compile/material/test/trace packs and selected animation/sequence/world-modeling domains qualified separately | LIVE-04–07; CAP-12–16; CAP-19 discovery |
| M5 — Precise advanced lifecycle | Deletion, partial batches, any proven atomic variants and additional observation/input modes have scoped contracts | CAP-06, CAP-11, CAP-18B |
| M6 — Repeatable agent use and maintenance | Reproducible setup, client workflows, scoped support matrix, regressions and candidate-promotion process | OPS-01–06 |

A core configuration does not wait for every optional specialist. Qualify these profiles independently:

- **Core profile:** authoring-core and editor-observation (8 existing operations); LIVE-01, LIVE-02 and LIVE-08 for that combination.
- **Playtesting profile:** core plus playtesting (16 existing operations); additionally LIVE-03 and another LIVE-08 run for that combination.
- **Specialist profiles:** add only the desired compile (2), material (3), automation (2) or Insights (6) operations, with that pack's native record and combined-profile check.
- **Expanded authoring profiles:** add individual CAP contracts only after their source/fixture/native evidence; no whole-family blanket enablement.

These are qualification targets, not presently supported native configurations. A profile may also enable an individual operation or standalone specialist without requiring the core providers. An installed Unreal plugin may remain resident even when Nexus has not started its backend connection; lazy MCP loading does not dynamically unload native plugins.

## 4. Task state, evidence and ownership

Priority is sequencing: **Now**, **Next**, **Later**. It is distinct from bug severity. Task registers use one authoritative entry per ID; update that entry instead of copying a second status table into an issue or PR.

| Task state | Meaning |
| --- | --- |
| ready | Hard task dependencies are satisfied; claim only if the required execution environment and assigned scope are available |
| in_progress | A named agent/workstream owns the task, branch/worktree and write scope |
| blocked | Record the exact missing dependency/environment and the next resolving action |
| in_review | Deliverables and evidence are available for independent review |
| done | The task's stated scope and completion conditions are met, with evidence links |
| deferred | Intentionally outside the current slice; retain rationale and reopening condition |

Track qualification separately for each operation and build/environment:

1. **Source-reviewed:** exact paths/revisions, contract, candidate comparison and constraints inspected.
2. **Fixture-verified:** named executable tests pass at an exact Nexus revision/lockfile/environment; failures and skips are counted.
3. **Native-qualified:** required cases pass against identified deployed artifacts, engine/platform/project and provider combination.

A documentation, discovery or fixture-only task may be done while native qualification remains pending, if that limited scope is explicit. A task promising a working native capability cannot be completed by source inspection or fixtures alone. Record rejected/deferred candidates; never mark them as implemented.

Logical owners below are roles, not current assignments. When starting, replace `unassigned` with the actual worker and record: task ID, commit/branch/worktree, files owned, scope, dependencies, expected evidence and any limits. On handoff record changes, tests actually run, results, unresolved cleanup and the exact qualification scope.

### How agents choose and integrate work

1. Read this roadmap, AGENTS.md, the relevant task register and current catalog/PR state. Check for work already completed on a newer commit.
2. Take the highest-priority ready task with satisfied prerequisites. Proceed within existing authorization; do not add approval round trips for ordinary reversible implementation or read-only investigation.
3. Parallel writers use separate worktrees or explicitly nonoverlapping file ownership. Multiple branches in one shared working directory are not isolation. One integration owner resolves shared-file edits and combines changes.
4. Source comparison, fixture design and CI scaffolding can proceed while a native lane is blocked. A native environment blocker does not halt independent tasks.
5. Respect native scheduling, sessions, machine/input ownership and direct-client boundaries. Do not run concurrent mutations in one editor merely because agent worktrees are separate.
6. Review an immutable diff, run the applicable checks, update current contracts/guidance/evidence together, then commit. Separate historical evidence from a new run.
7. Merge, native installation, external publication and skill installation occur only within the relevant assigned task scope. This roadmap-creation request performs none of those actions.

## 5. Immediate reliability work

Both findings are reproduced in [PR #1](https://github.com/ashtonbannister/UnrealNexusMCP/pull/1). Use source and regressions to resolve them; do not weaken a guarantee merely to make the test pass.

### FIX-01

**Fence uninterpretable UE completion receipts** — Priority: **Now**; state: **ready**; owner role: **Gateway maintainer**; assignee: **unassigned**.

**Dependencies:** None.

Resolve review finding R1 (review severity P2) in src/results.mjs and the gateway/queue path. A successful MCP transport with missing or ambiguous completion JSON after a dispatched UE operation must not leave subsequent work free to execute. Classify source-backed ordinary refusals separately.

**Done when:** Regressions cover unparseable text, multiple ambiguous envelopes, preservation of text/images/metadata, an uncertainty fence across a second HTTP client, and recognized ordinary refusals. Prove one native dispatch, no fallback/retry/reset, and that the returned receipt distinguishes failure from unknown completion. Run the repository checks and align the affected guarantees with observed behavior.

**Evidence:** PR #1 R1; exact commit, reproduction, regression names/results, and changed guidance.

### FIX-02

**Report unresolved cleanup after rejected startup** — Priority: **Now**; state: **ready**; owner role: **Runtime lifecycle maintainer**; assignee: **unassigned**.

**Dependencies:** None.

Resolve review finding R2 (review severity P2) in src/runtime.mjs and src/backends.mjs. Preserve the original discovery/identity/contract refusal while retaining a separately visible failure to close the opened connection. Include the pool's invalid-contract and closed-during-startup paths.

**Done when:** Regressions show successful cleanup, rejecting cleanup, bounded cleanup timeout, and repeated shutdown. Status and shutdown retain unresolved cleanup; the original preparation error remains identifiable. No canonical operation dispatches, startup is not retried, and a pre-dispatch refusal is not relabeled as an uncertain native mutation. Run the repository checks.

**Evidence:** PR #1 R2; exact commit, refusal/cleanup receipts, regression results and bounded shutdown evidence.


## 6. Capability and qualification work registers

- [CAP-01–20: capability expansion](docs/CAPABILITY_BACKLOG.md) covers prerequisites, all ten currently unexposed decision groups, common authoring, distinct specialist variants and remaining inventory.
- [ENV-01–04 and LIVE-01–08: native qualification](docs/QUALIFICATION_PLAN.md) defines the first platform lane, reproducible builds, network boundaries, all 29 operation rows and combined-profile evidence.
- [INTEGRATION_ACCEPTANCE.md](docs/INTEGRATION_ACCEPTANCE.md) retains the required failure/recovery matrix. The qualification plan turns it into execution tasks; it does not replace those checks.

A CAP family must be split into individually reviewable canonical contracts in its task branch before routing is added. Identify each child contract's provider candidate, fixed selectors, effect, persistence, diagnostics, tests and native evidence. Completing one example does not complete an entire family.

## 7. Operations and delivery work

### OPS-01

**Repeatable selected-profile setup and diagnosis** — Priority: **Next**; state: **blocked**; owner role: **Tooling maintainer**; assignee: **unassigned**.

**Dependencies:** [ENV-01](docs/QUALIFICATION_PLAN.md#env-01), [ENV-02](docs/QUALIFICATION_PLAN.md#env-02), [ENV-03](docs/QUALIFICATION_PLAN.md#env-03).

Turn the manual runtime setup into a reproducible profile-driven runbook and nonmutating diagnostic command. Report exact source/build/patch/target/endpoint requirements and credentials by variable name. Distinguish installed native plugins from lazily started backend connections.

**Done when:** A second operator can reproduce a qualified profile using recorded versions, paths and ports; all-off startup works without an editor. Missing dependencies and failed cleanup are actionable; unused providers impose no installation/startup requirement on that profile. Any install/apply/build steps are explicit and respect the assigned task's authority. A supported-profile claim also requires its LIVE-08 record.

**Evidence:** Setup commands, redacted diagnostics, clean-host reproduction, enabled/loaded-provider observations, recovery runbook.

### OPS-02

**Continuous fixture and contract validation** — Priority: **Now**; state: **blocked**; owner role: **CI maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](#fix-01), [FIX-02](#fix-02).

Add repeatable CI for catalog decisions, schemas, fixed routes, guidance mapping, source/patch verification and real fixture MCP transports. Supply Python and the exact pristine UAP snapshot in the complete lane. CI scaffolding may proceed while fixes are under review.

**Done when:** Required lanes run without unexplained skips and retain logs, commit, lockfile, OS/Node/Python versions and test counts. Exercise the declared Node/OS support or narrow the claim. Include both regression fixes, disabled-provider startup checks and public-surface exclusions. Keep fixture CI separate from native engine tests; do not freeze the suite at 154 tests.

**Evidence:** Committed workflow/configuration, successful run URLs and artifacts, documented required versus optional lanes.

### OPS-03

**Latest-candidate intake and winner promotion** — Priority: **Next**; state: **blocked**; owner role: **Capability curator**; assignee: **unassigned**.

**Dependencies:** [CAP-20](docs/CAPABILITY_BACKLOG.md#cap-20), [OPS-02](#ops-02).

Produce an on-demand upstream change report that maps source/schema/behavior/license changes to affected contracts. Compare newer revisions and competing providers under the selection rubric below; unchanged winners stay pinned. Split promotion by operation even when several operations share a backend.

**Done when:** A worked candidate update identifies affected routes, contract differences, accepted/rejected/retained variants, relevant fixture and native evidence, patch compatibility, notices and explicit rollback/reconciliation steps. Promotion updates the lock, decision, adapter/schema, guidance and qualification records together. No floating latest, auto-failover or automatic mutation retry. Scheduling or publication is outside this roadmap-creation task.

**Evidence:** Candidate comparison report and reviewable promotion example; unchanged or explicitly reviewed source pins.

### OPS-04

**Native regressions, support matrix and performance budgets** — Priority: **Next**; state: **blocked**; owner role: **Native validation maintainer**; assignee: **unassigned**.

**Dependencies:** [OPS-02](#ops-02), [LIVE-08](docs/QUALIFICATION_PLAN.md#live-08).

Maintain results per engine/platform/provider build/transport/profile. Define which tests run on an isolated interactive host and which require a recorded manual run. Measure cold/warm startup, discovery, representative call/queue latency, memory and image/trace limits before setting numeric budgets.

**Done when:** The claimed profile has reproducible regression runs and measured budgets with machine/project details. Engine, backend, compatibility patch, SDK or transport changes identify and rerun affected cases. Demonstrate dormant unused providers and bounded errors under load. Unsupported or unverified matrix cells remain explicit.

**Evidence:** Support matrix, native run manifests, retained artifacts, benchmark method and measured thresholds.

### OPS-05

**Client packaging and scoped delivery readiness** — Priority: **Next**; state: **blocked**; owner role: **Integration and documentation maintainer**; assignee: **unassigned**.

**Dependencies:** [OPS-01](#ops-01), [OPS-03](#ops-03), [OPS-04](#ops-04).

Prepare tested client configurations and versioned compatibility/profile manifests, installation and recovery instructions, notices and known limitations. Start with the implemented local stdio and authenticated loopback HTTP deployment. A hosted/public connector needs a separately reviewed authentication/deployment design.

**Done when:** A clean client discovers only enabled canonical tools and the correct draft workflows, completes the claimed qualified profile, reports unavailable dependencies clearly, and passes the relevant failure/recovery checks. Documentation lists precise supported combinations. Keep master guidance draft; installing a skill, publishing a connector/package/release or merging requires the applicable future task scope and is not performed by creating this roadmap.

**Evidence:** Client/version configuration examples, clean setup and workflow receipts, profile support statement and release-readiness checklist.

### OPS-06

**Agent-driven end-to-end workflow acceptance** — Priority: **Next**; state: **blocked**; owner role: **Workflow validation maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](docs/CAPABILITY_BACKLOG.md#cap-01), [CAP-18A](docs/CAPABILITY_BACKLOG.md#cap-18a), [LIVE-08](docs/QUALIFICATION_PLAN.md#live-08).

Demonstrate that an agent can discover, plan, execute, inspect and explain representative work through Nexus. Start with the qualified core profile; add creation/import, Blueprint, material, PCG and optional specialist scenarios only after their CAP and LIVE prerequisites pass.

**Done when:** Record agent/client version, task, enabled profile, tool transcript, actual editor artifacts, persistence and owned cleanup. The core case observes exact targets, performs a supported scoped change, verifies it and reports limits without raw-backend escapes. Each advanced scenario also requires its corresponding CAP task. Negative tasks refuse wrong targets, disabled capabilities and uncertain replay. Manual fixture setup is disclosed and is not counted as agent capability.

**Evidence:** Reproducible tasks, bounded tool-use expectations, transcripts, before/after artifacts and independent acceptance of the actual result.


## 8. Candidate selection and change gates

For every admitted function, record the compared implementations and assess these in order:

1. **Eligibility:** applicable component license, installed engine/plugin support, usable public surface and exact target/authority boundary.
2. **Contract fidelity:** full world/client/asset identity; input validation before mutation; explicit scope; correct completion and persistence semantics; honest partial results and recovery.
3. **Evidence:** native and fixture tests for the actual contract, including refusal, no-op, late failure, save failure, timeout, restart and competing clients.
4. **Operating cost:** measured latency/resources, required native dependencies, startup burden and maintainability.
5. **Maintenance and recency:** relevant upstream fixes and supported versions. Newer is useful evidence, not an automatic winner.

Compare equivalent contracts only. Preserve memory-only versus persisted edits, current versus exact-client capture, physical versus Enhanced Input, algorithm variants and partial versus proven atomic batches.

A promotion change must include the decision/evidence, canonical schema and route, adapter/probe/compatibility changes, fixtures, applicable native result, guidance/pack changes, notices and a rollback plan. A code change can be reviewed before native acceptance while explicitly unqualified; the supported-profile claim waits for native evidence. Pins and exact patch hashes change only in that reviewed promotion.

Rollback is an intentional operator action after outstanding work is reconciled, never an automatic retry or failover after uncertain mutation. Removing the last selected route for a provider must remove its startup requirement from affected profiles while preserving unique variants and native safety dependencies elsewhere.

## 9. Next execution queue

1. Claim FIX-01 and FIX-02 in separate worktrees; coordinate shared queue/runtime tests through one integrator.
2. In parallel, run CAP-20 inventory reconciliation, ENV-01 host discovery when a native host is available, and OPS-02 CI design.
3. After the reliability fixes, implement CAP-01 and CAP-18A; then session ownership under CAP-02.
4. Prepare ENV-02–04 and qualify the chosen core profile. Keep source/fixture expansion moving when native work is unavailable.
5. Expand common authoring under CAP-03–05, CAP-07–10 and CAP-17. Qualify optional existing packs independently.
6. Advance later specialist/held contracts only within their defined scope; finish profile setup, maintenance and agent-workflow evidence.

No task is assigned or implemented merely by appearing here. Status changes require the task's actual output and evidence. Dates and scope may be revised with a reason and dependency impact; preserve stable task IDs and completed evidence.

## 10. Change record

- **2026-10-27:** Established the master roadmap, 20-family capability backlog and per-operation native qualification plan against c543959. Documented the two open review findings and the previously missing discovery/session/image prerequisites. Kept source pins, executable routes and draft guidance classification unchanged.
