# Native qualification plan

Part of the [master roadmap](../MASTER_ROADMAP.md); baseline `c543959`. The [integration acceptance checklist](INTEGRATION_ACCEPTANCE.md) remains the required behavior matrix. This document supplies execution tasks and evidence rows. **All native rows below are not-run.** No installed engine, native build or live result is claimed.

## Environment and profile policy

The first native target is **Windows x64, interactive desktop**, reflecting the pinned UAP platform constraint. ENV-01 discovers the exact installed Unreal patch/build and toolchain before native work. Do not guess UE support from the Epic catalog snapshot or silently upgrade an existing project.

Linux Node 24.22.1 has gateway fixture evidence. Windows inspection/execution, Node 22 compatibility, macOS and remote-host identity are not established by that evidence. Record the actual supported combinations; unsupported identity paths remain unavailable.

Environment/build/listener tasks and live evidence are scoped to an explicit enabled profile. A profile may contain individual operations or a standalone specialist. It must not acquire unrelated backend requirements merely to run the acceptance process. An installed native plugin and a started MCP connection are different states; record both.

Native execution in this plan is future work within an assigned integration task. Creating this roadmap does not install a plugin, modify a project, enable writes, run a live editor, install a skill or publish anything.

## Environment task register

### ENV-01

**Record the first native target** — Priority: **Now**; state: **blocked**; owner role: **Native integration maintainer**; assignee: **unassigned**.

**Dependencies:** Native host availability; no prior task.

Initial target lane: Windows x64 on an interactive desktop. A connected native host is the current blocker. Discover the actual Windows version, exact Unreal patch/build, compiler/SDK, Node/Python versions, project revision and .uproject. Do not infer an engine version from a catalog snapshot or upgrade the user's engine implicitly.

**Done when:** An environment manifest reconciles build/runtime requirements for the selected pinned providers and names the enabled operation profile. Record actual editor PID/start epoch per run. Incompatible combinations and missing tools have precise blockers. Linux Node 24.22.1 remains the fixture-tested baseline; Node 22 and Windows runtime support require their own evidence.

### ENV-02

**Reproduce selected builds and loaded provenance** — Priority: **Next**; state: **blocked**; owner role: **Native build maintainer**; assignee: **unassigned**.

**Dependencies:** [ENV-01](#env-01).

Build only providers required by the selected profile, from locked revisions plus exact reviewed compatibility deltas. Preserve LF bytes and notices. Record dependency/build commands, source/patch hashes, logs, artifact hashes, installation locations and which module/server output is actually loaded.

**Done when:** A clean repeat build/deployment is attributable to reviewed source and the target engine. Source proof, marker checks and loaded-artifact evidence are separately recorded. A missing optional provider does not block a profile that does not use it. New build fixes require a reviewed patch/manifest change; do not silently alter a locked checkout.

### ENV-03

**Verify native transport and authority boundaries** — Priority: **Next**; state: **blocked**; owner role: **Native integration maintainer**; assignee: **unassigned**.

**Dependencies:** [ENV-02](#env-02).

Inventory enabled native and Nexus listeners: owning process, bind address, endpoint, authentication/consent, reachability and target proof. Include UAP discovery and Python callback sockets, which bind 0.0.0.0 at the pinned revision, independently of Nexus bearer protection.

**Done when:** Intended local traffic works, wrong editor/proxy endpoints refuse, and unintended reachability/peer trust is explicitly bounded for the chosen profile. Record actual isolation controls without claiming gateway auth covers native ports. Any native-source adjustment is a separately reviewed compatibility change. One shared HTTP authority is disclosed; no per-client identity is invented.

### ENV-04

**Build the disposable project and acceptance harness** — Priority: **Now**; state: **blocked**; owner role: **Native test maintainer**; assignee: **unassigned**.

**Dependencies:** [ENV-01](#env-01).

Prepare a reproducible test project with duplicate actor labels, editor/PIE identities, valid/broken Blueprints, material types, PCG graph/run cases, save failures, input holds, automation outcomes and trace capture. Harness/source design may start before host access; executable native fixture verification needs ENV-01.

**Done when:** Each of the 29 rows below has setup, exact inputs, expected effects/state, applicable failure cases, cleanup and artifact requirements. Known setup dependencies are explicit. Tests can establish native fixture state outside Nexus, but that setup is not counted as a gateway capability. Secret-free evidence templates and a repeatable project revision exist.


## Evidence contract

Use a future run directory such as `docs/qualification/<environment-id>/<run-id>/` with `manifest.json`, `results.json` and a readable findings/recovery record. These locations are proposals, not existing evidence. Retain large screenshots/logs/traces/test assets separately with durable references and hashes.

Each run records:

- Exact Nexus commit and dependency lock, canonical ID, selected provider pin, compatibility patch and loaded artifact identity.
- OS/architecture, engine patch/build, compiler/SDK, Node/Python, project revision, enabled operations, transport and environment manifest.
- Exact preconditions and target project/editor epoch/world/client/asset/session/run identifiers; inputs and whether dispatch occurred.
- Original MCP receipt, errors/warnings/partial items, metadata, images and relevant observed state.
- Persistence evidence where claimed: relevant files/packages, before/after hashes or other suitable receipts and reload/readback.
- Case outcome: **pass**, **fail**, **blocked**, or **not-run**, with reason and links. Missing/skipped/unsupported cases do not become passes.
- Owned native work and cleanup/recovery actually performed, including unresolved sessions, holds, automation, traces or machine grants.
- Reviewer and acceptance scope. Native qualification applies only to this operation/build/environment combination.

Do not commit credential-bearing configs or tokens. Public artifacts may redact personal paths while retaining stable target identifiers and privately reproducible manifests.

The harness may establish recorded fixture state outside Nexus (e.g. a PIE world, graph or native session), which avoids a circular prerequisite between pack tests. That setup is never counted as an implemented gateway function. LIVE-08 and OPS-06 separately prove workflows through enabled canonical operations. CAP-01, CAP-02 and CAP-18A close discovery, session and image-delivery gaps.

## Pack qualification tasks

All native calls require the relevant environment and reliability prerequisites. Source review, fixtures and harness preparation may proceed earlier. A task covers all operations in its named pack; a narrower profile can be qualified for explicitly tested operation rows without claiming the whole pack passed.

### LIVE-01

**Authoring core** (`authoring-core`) — Priority: **Next**; state: **blocked**; owner role: **Editor integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Qualify editor/PIE inspection, current-level and exact-asset persistence, persisted PCG edge, generation trigger and exact-run wait. Verify world/object identity, per-package disk receipts, existing-edge no-op behavior and generated state for the returned run. Cover ambiguous targets, multi-component PCG intent, invalid/partial saves and stale runs.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-02

**Current viewport observation** (`editor-observation`) — Priority: **Next**; state: **blocked**; owner role: **Rendering integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Receive actual MCP image bytes, actual dimensions and source-view receipt in editor and PIE states. Verify downscale/shader-wait limits and missing-image failures. Do not claim exact PIE-client, full-window, arbitrary-camera or headless rendering from this route.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-03

**PIE lifecycle, capture and input** (`playtesting`) — Priority: **Next**; state: **blocked**; owner role: **Gameplay integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Verify actual start/status/stop transitions, selected PIE client/player, fresh PNG write and observable Enhanced Input effects. Track every owned hold through update/release. Test queued starts, teardown races, post-send loss, retained machine grants and external recovery without replay. Enhanced Input does not qualify physical keyboard/UI behavior.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-04

**Memory-only Blueprint compile** (`blueprint-compile`) — Priority: **Later**; state: **blocked**; owner role: **Blueprint integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Compile valid and intentionally broken assets and sessions; preserve status/diagnostics/truncation. Prove both patched outer autosave sites are suppressed, with before/after disk evidence including unrelated dirty packages and Save-on-Compile. Record external session setup or CAP-02-created ownership; do not hide session-close save effects.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-05

**Strict material persistence** (`material-strict`) — Priority: **Later**; state: **blocked**; owner role: **Material integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Verify scalar/vector/texture parameter types, finite bounds, actual observed values and saved state. Exercise missing/wrong-type parameters, invalid vectors/textures, read-only and save/readback failure, and post-send loss. Observe exactly one typed mutation and distinguish dirty memory from persisted disk.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-06

**Strict automation** (`automation-tests`) — Priority: **Later**; state: **blocked**; owner role: **Automation integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Run known passing/failing/missing/unfinished tests and reasoned allowed skips. Verify owned run IDs, paced polling, terminal once-only evidence, cancellation and release of the native gate. Unowned poll/cancel refuses. An accepted run or wrapper success is not a test pass.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-07

**Insights capture and analysis** (`insights-analysis`) — Priority: **Later**; state: **blocked**; owner role: **Profiling integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Use a real trace with known workload. Verify capture start/stop, owned reader open/query/close, settings restoration, bounded pages and missing-channel/truncation disclosures. Test interruption and foreign handles; preserve real timing meanings and do not invent percentiles/GPU data.

**Done when:** Every operation in this pack has recorded happy-path and applicable refusal/no-op/partial/timeout/restart/recovery evidence in the chosen environment, with actual state/persistence and ownership cleanup. Failed or blocked cells remain visible; qualification is limited to the tested operation/build/environment.

### LIVE-08

**Selected-profile coexistence and recovery** — Priority: **Next**; state: **blocked**; owner role: **Cross-provider integration maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02), [ENV-02](#env-02), [ENV-03](#env-03), [ENV-04](#env-04).

Run the chosen enabled profile together after its operation rows and applicable LIVE-01–07 cases pass. This is a conditional dependency on selected operations, not a requirement to install every provider or pass unused packs. Begin with one editor/gateway; then test multiple HTTP clients, restart, direct-client interference and representative cross-provider workflows.

**Done when:** Actual loaded/started provider sets match the chosen profile; discovery/planning starts none. Shared HTTP queue/fence behavior, editor identity changes, unknown outcomes and external recovery are demonstrated. Native scheduling/locks remain intact. Record which outside-client races cannot be prevented; do not claim a process-local queue is a global mutex or atomic editor-epoch lock.


## Current operation coverage matrix

This is the exact current allowlist, not proposed capability names. Every row also receives the applicable common failure matrix below.

| Canonical operation | Selected provider | Required positive evidence | Required edge/failure evidence | Native result |
| --- | --- | --- | --- | --- |
| `pie.start.viewport` | unrealagentplayer | Confirmed playing phase and owned session | Queued start, timeout/loss after send, retained grant | not-run |
| `pie.stop` | unrealagentplayer | Owned session stopped and phase NotPlaying | Queued teardown, unowned session, uncertain release | not-run |
| `pie.status` | unrealagentplayer | Actual current phase and reflected/native identity | Missing/malformed RC fields, wrong process | not-run |
| `screenshot.viewport.current` | enginewire | Real MCP image, dimensions, view and shaderWait | Missing image, view mismatch, unsupported headless intent | not-run |
| `screenshot.pie` | ue-mcp | Exact client, dimensions and fresh successful PNG write | Existing/stale file, wrong instance, failed write; path is not viewed pixels | not-run |
| `actor.inspect.editor` | ue-mcp | Exact editor actor identity/properties; disclosed truncation | Repeated labels, wrong path and stale epoch | not-run |
| `actor.inspect.pie` | ue-mcp | Requested PIE world/instance actor identity | Editor duplicate, unavailable/ambiguous instance | not-run |
| `level.save.current` | ue-mcp | Intended current map/external packages and per-package disk receipts | PIE refusal, wrong current map preflight, partial/read-only save | not-run |
| `asset.save.exact` | ue-mcp | Only explicit loaded asset set, actual files and reload | Empty/invalid scope, missing/read-only/partial save; malformed receipt | not-run |
| `pcg.graph.connect.persisted` | ue-mcp | Actual named edge and checked save; existing edge no-op | Wrong/stale node or pin, failed save, no destructive inverse on no-op | not-run |
| `pcg.generation.execute` | ue-mcp | Intended first component; returned actor/component/run | Multiple-component intent mismatch, failure after start, no replay | not-run |
| `pcg.generation.wait` | ue-mcp | Generated for exact requested run and matching lastRun | Cancelled/idle/not_started/stale/timed-out state is not success | not-run |
| `input.action.once` | ue-mcp | Explicit action/world/local-player and observed gameplay effect | Missing action, wrong player/world, nonfinite input | not-run |
| `input.action.hold.start` | ue-mcp | Unique owned ID and sustained observed effect | Foreign/conflicting hold, timeout after native start | not-run |
| `input.action.hold.update` | ue-mcp | Same owned hold and changed observed effect | Foreign/stale hold and invalid values | not-run |
| `input.action.hold.stop` | ue-mcp | Stopped/already-stopped receipt and no owned residual hold | Timeout/loss is not confirmed release | not-run |
| `blueprint.compile.memory.asset` | claireon | Actual compiler status/diagnostics and unchanged disk | Broken/warning/truncated diagnostics; both autosave sites | not-run |
| `blueprint.compile.memory.session` | claireon | Exact session compile and no unintended save | Foreign/stale session; explicit setup and close semantics | not-run |
| `automation.tests.run` | claireon | Accepted exact expected set with owned run identity | Missing tests, disallowed skips, second active run, uncertain start | not-run |
| `automation.tests.poll` | claireon | Owned terminal verdict/counts retained; gate released | Unowned/cancelled/incomplete run; consumed terminal receipt | not-run |
| `insights.capture.start` | claireon | Owned recording, exact channels/path and named events | Existing capture, wrong state, interrupted start | not-run |
| `insights.capture.stop` | claireon | Owned path finalized and previous settings restored | Foreign/mismatched path, not_recording, uncertain stop | not-run |
| `insights.trace.open` | claireon | Real trace reader, exact path and owned handle | Invalid trace, missing providers, spilled/ambiguous output | not-run |
| `insights.trace.scopes` | claireon | Actual bounded scope rows and timing/channel metadata | Foreign handle, inverted range, absent GPU and truncation | not-run |
| `insights.trace.frames` | claireon | Actual bounded frames with disclosed page statistics | Foreign handle, null/unterminated frames, false CPU/percentile claims | not-run |
| `insights.trace.close` | claireon | Exact owned reader closed | Foreign/already-lost handle; reader close does not stop capture | not-run |
| `material.parameter.scalar.persisted` | hayba | Declared scalar, exact readback and checked save | Wrong/missing parameter, float overflow, save/readback failure | not-run |
| `material.parameter.vector.persisted` | hayba | Declared RGB/RGBA, actual value and save | 1/2-element or invalid vector, wrong type, partial persistence | not-run |
| `material.parameter.texture.persisted` | hayba | Loaded intended texture, observed value and save | Invalid texture, wrong type, read-only or failed save | not-run |

## Common failure and recovery matrix

For each operation, explicitly mark applicability rather than silently omitting cases:

| Case | Required observation |
| --- | --- |
| Invalid/schema/disabled input | Refusal before canonical dispatch; no raw or alternate-provider escape |
| Wrong/ambiguous target | Exact identity/world refusal; no first-label or editor-for-PIE substitution |
| No-op/existing state | Accurate no-change receipt; no destructive inverse for a change that did not occur |
| Partial/native refusal | Original diagnostics and completed/failed items retained; persistence distinguished from memory |
| Missing/ambiguous completion | Correct failure versus uncertainty classification and queue fence; FIX-01 regression reflected live where feasible |
| Startup/cleanup refusal | Original preparation reason and separate unresolved cleanup retained; FIX-02 scope |
| Timeout/disconnect/cancellation after send | One dispatched operation; no replay/failover; eventual native state and external recovery recorded |
| Editor restart | Old epochs/handles invalidated; no automatic uncertain re-execution |
| Multiple clients/direct interference | Shared runtime behavior demonstrated; native locks and remaining outside-client limits accurately described |
| Persistence/undo claim | Actual files/reload or prior-state restoration checked, not inferred from a transaction or acknowledgment |
| Ownership and cleanup | Every owned PIE session/hold/run/capture/reader is released, retained intentionally, or explicitly unresolved |

A fenced gateway does not expose a reset and cannot use a canonical stop call to bypass its fence. Use the documented operator/editor recovery path, reconcile outstanding work and deliberately restart. Test that behavior without describing cancellation as rollback.

## Completion and promotion

A LIVE task is complete only for its recorded operation/engine/platform/provider combination when required cases have acceptable evidence, failures are resolved or the unsupported scope is explicitly excluded, and cleanup is accounted for. A blocked row remains blocked; a checklist tick without artifacts is insufficient.

New CAP operations add rows and pack/profile requirements in the same behavior change. Re-run affected rows when engine, provider, patch, SDK, transport or ownership behavior changes. The support matrix and candidate-promotion procedure under OPS-03/04 control future claims. No global badge substitutes for per-profile evidence.
