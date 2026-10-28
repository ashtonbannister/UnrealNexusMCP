# Master skill guidance — draft

Status: workflow-authoring draft, not an installed skill. Review date: 2026-10-26.
The implementation comparisons are source-backed; live Unreal qualification is
pending. “Selected” is a scoped winning candidate, not a universal guarantee.

Development priorities and planned capabilities are tracked in the
[master roadmap](../MASTER_ROADMAP.md). A planned operation is not callable unless
it is present in the canonical catalogue and enabled by host configuration.

## 0. Governing contract

**Trigger:** any request to inspect, create, change, test or profile an Unreal
project through Nexus.

**Before doing work:**

1. Resolve the intended project/worktree and exact editor process instance.
   PID alone is not an epoch; include start identity and invalidate stale handles.
2. Select enabled canonical capabilities. Only their selected backends may load.
   Merely searching, describing or planning must not start plugins/servers.
3. Inspect the capability's parameter schema, target scope, source pin, save
   behavior, side effects, postconditions and live availability.
4. Acquire required native session, asset lease, machine/display ownership or
   input ownership. These are different lock classes, not interchangeable.
5. Obtain task-appropriate authority for writes, deletions, saves and session
   lifecycle. A global write flag is not authorization for arbitrary work.

**Always:** distinguish requested, accepted, completed, verified and persisted.
Preserve images, warnings, diagnostics, per-item failures and partial changes.
Use stable full paths/GUIDs and explicit world/player selectors.

**Never:** bypass a refusal with another provider/Python/console; turn a scoped
save into save-all; retry an uncertain mutation; infer rollback from timeout,
cancellation, Transaction.Cancel or an inverse-operation descriptor.

The canonical catalogue is `catalog/operations.json`. Only enabled entries are
callable. The master document is served at `unreal-nexus://guidance/master`, its
enabled subset at `unreal-nexus://guidance/enabled`, and the applicable workflow
through prompt `nexus_workflow`. Source evidence and scope boundaries are in
`catalog/decisions.json` and the six audit reports.

## 1. Discovery, enablement and planning — implemented MCP gateway

**Trigger:** choose a tool for a new task or an unfamiliar project.

**Use:** MCP `tools/list`, `nexus.status`, `nexus.describe`, `nexus.plan`, the four
read-only resources and `nexus_workflow`. The library also exports `Gateway`;
offline `npm run catalog -- list`, `describe` and `plan` inspect the complete
catalogue without contacting a backend.

- Enable a small set of capabilities or packs in trusted host configuration.
- Default enablement is empty. Suggested base: authoring-core and editor-observation.
- Playtesting and compile/material/test/trace packs are optional. Their fixed
  adapters exist, but affected routes refuse stock backends without the exact
  reviewed compatibility patches and corresponding live markers.
- Before execution, the factory verifies the configured source revision, exact editor target
  and live inner capability availability. Do not treat a meta-tool's existence
  or a multi-editor discovery union as sufficient.
- Source verification covers the checkout and reviewed patch; ignored build
  products and the loaded native binary still require deployment acceptance.
- Pin the chosen winner. New upstream code is a review candidate, not automatic
  replacement or a backup to try after failure.

**Output:** canonical ID, exact target, fixed provider route, effects, required
postconditions and whether dispatch actually happened.

## 2. Confirmed PIE lifecycle — UnrealAgentPlayer

**Trigger:** start or stop a workflow-owned viewport play session.

**Use:** `pie.status`, `pie.start.viewport`, `pie.stop`.

**Preconditions:** intended editor attested; machine lock available; previous
session ownership known; required packages saved only with user-authorized scope.
The reviewed UAP compatibility patch disables replay at every Python dispatch
layer and binds the MCP server to the configured project, editor PID and RC
port. Require the live `bridge_status` marker to match that binding.

1. Read current phase. Do not stop another workflow's session.
2. Start the viewport route; mode and wait are fixed. Record phase and result.
3. Require parsed ok=true, playing=true and a live phase, not a queued ack.
4. On completion or failure, explicitly stop the owned session. Require
   stopped=true and NotPlaying before treating the editor as free.

**Failures:** a start timeout can leave a queued start. Do not repeat start or
assume idle. The core fences subsequent calls even for a native queued-timeout
response. Reconcile outstanding work and explicitly stop the owned session using
the operator/host recovery path before restarting Nexus; the fenced queue does
not expose a model-callable reset or permit pie.stop to bypass the gate. Upstream RC
getters default missing fields, so malformed-response behavior remains a live
acceptance test.

Do not promise separate-window behavior, map changes, game pause or toolbar
pause through this restricted lifecycle route.

## 3. Visual observation — EngineWire and UE-MCP

**Trigger:** inspect the editor or verify gameplay/UI visually.

| Intended view | Canonical route | Required evidence |
|---|---|---|
| Current viewport (editor or PIE) | `screenshot.viewport.current` | Actual MCP image block and output dimensions |
| Exact PIE client including UMG | `screenshot.pie` | Matching world/instance, actual dimensions, successful PNG write |

- Viewport resolution is a downscale bounding box, not a rerender resolution.
- EngineWire editor_viewport mode can show PIE. Inspect the view receipt; require
  reconciled NotPlaying for strict editor-world-only intent. Preserve shaderWait:
  its cap can expire before compilation drains.
- PIE capture requires an explicit instance and a fresh safe PNG basename.
  The upstream can overwrite an existing filename; this is not atomic no-clobber.
- A file path or base64 inside JSON text is not automatically an MCP image.
  Do not say “I inspected the screenshot” unless the image was actually received.
- Full Slate window, arbitrary scene camera, isolated actor render and live
  gameplay UI are separate capabilities. Do not swap them as duplicates.
- Null-RHI/headless commandlet mode does not promise a rendered screenshot.

**Output:** captured target, actual dimensions, image/file type and limitations.

## 4. Exact actor inspection — UE-MCP

**Trigger:** read a level actor before editing or verify a gameplay actor.

**Use:** `actor.inspect.editor` or `actor.inspect.pie`.

Require a full object path; the PIE route also requires a world instance.
Check returned identity and world before acting on properties. Respect truncation
flags, count limits and large-container omissions. Never substitute an editor
actor for its PIE duplicate or resolve a repeated label by picking the first one.

Actor movement, general property mutation and deletion are **not approved by
these read routes**. Their world/identity and partial-mutation issues remain
separate decisions.

## 5. Scoped persistence — UE-MCP

**Trigger:** persist explicitly authorized changes.

**Use:** `asset.save.exact`, `level.save.current`.

- Prefer a nonempty explicit assetPaths list for known loaded packages.
- Decide force intentionally: unmarked-dirty edits may need force=true, but
  ordinary save should not silently resave unrelated clean assets.
- Current-level save acts on the currently edited level, not a supplied map
  path. Verify that target first. Loaded external packages are included.
- commitDeletes is fixed false; its true form can sweep every dirty map/content
  package and is not an interchangeable save variant.
- Inspect each saved/notDirty/failed/skipped/deleted package and disk receipt.
  Some saved plus some failed is partial work, not total success.

**Failures:** fix the named persistence problem; do not rerun the original
mutation just because saving failed. Preserve dirty in-memory state and receipts.

## 6. Persisted PCG graph connection — UE-MCP

**Trigger:** connect one graph edge and persist it.

**Use:** `pcg.graph.connect.persisted`.

Read current graph identities through an independently available read workflow.
Supply exact node IDs/names and both pin labels; Nexus deliberately removes the
upstream first-pin defaults. Validate schema compatibility and returned edge/save
outcomes. An already-existing edge must not be treated as newly created for undo.
Do not translate old numeric node indices into current graph identities.

Claireon's session edits and EngineWire's optional-save connections stay
separate, not weaker duplicates of this exact persisted contract.

## 7. PCG generation lifecycle — UE-MCP

**Trigger:** regenerate procedural content and verify that run finished.

**Use:** `pcg.generation.execute`, then `pcg.generation.wait`.

1. Verify the actor's first PCG component is the intended target; execute has no
   componentName input selector.
2. Trigger once. Save returned actorPath, componentName and runId.
3. Wait with those exact identifiers and a bounded deadline.
4. Require state=generated and matching run identity. Native success=true may
   also mean idle, cancelled, cleaned or not_started; those are not generation.
5. Inspect the generated content appropriate to the graph. Nonzero ISM count
   alone is not a universal completion or correctness test.

**Failures:** do not trigger another run because waiting timed out. Inspect the
existing run/state first; generation may still be active.

## 8. Enhanced Input and owned holds — UE-MCP

**Trigger:** exercise gameplay at the InputAction layer.

**Use:** `input.action.once`, `input.action.hold.start`,
`input.action.hold.update`, `input.action.hold.stop`.

Require an explicit PIE world and local-player index. These are not the remote
client relay index or Slate user index. Keep input values finite/in engine-float
range. Assign a unique workflow-owned hold ID, track it, update intentionally,
and release in cleanup. Confirm stopped/already-stopped rather than guessing.

Observe gameplay as well as dispatch. This bypasses physical input and is not
a complete end-to-end keyboard/UI/hardware test. Remote relay is omitted until
completion correlation is available. Raw keys, Slate analog input, UMG clicks
and synthetic XR poses need separate contracts.

## 9. Blueprint compile without save — optional Claireon adapter

**Trigger:** diagnose a Blueprint while preserving an explicit no-save boundary.

**Use:** `blueprint.compile.memory.asset` or `blueprint.compile.memory.session`.
Both delegate to the fixed bp_compile function via public python_execute.

Use exactly one asset_path or session_id; preserve bounded diagnostics, severity,
node GUIDs and truncation. Require actual compile status, not Python wrapper
success. Do not auto-close sessions without checking whether close saves.

**Required compatibility:** the reviewed no-autosave patch and live
`nexus_skip_auto_save` parameter. Nexus supplies true on every fixed wrapper,
including read-only schema probes. The unmodified outer Python runner can save
before the inner compile begins; `SkipSave` alone does not establish no-save.

Arguments are JSON/base64 encoded and outputs nonce-framed. Missing, ambiguous,
truncated or spilled output leaves an unknown outcome. No model-supplied Python.
Compile-and-save, batch/folder compile and helpers that reset the undo buffer
remain distinct.

## 10. Strict material parameter persistence — optional Hayba adapter

**Trigger:** change one existing global material-instance parameter and save it.

**Use:** `material.parameter.scalar.persisted`,
`material.parameter.vector.persisted`, `material.parameter.texture.persisted`.
These use only the direct typed material_set_param tool.

Validate instance, declared parameter, type and read-only state before mutation.
Allow scalar, 3/4-element finite vector or nonempty texture path; enforce float32
range. Require actual value readback, verified=true and saved=true. If save fails,
memory may already have changed: retry persistence, not the entire mutation.

Layer-associated parameters, undeclared override staging, static switches and
unsaved sessions remain separate. The inspected public schema does not expose
the native boolean branch. Verify the typed route exists; via=ts alone does not
prevent Hayba's legacy fallback. The reviewed compatibility patch adds a required
`nexus_retry_policy: "never"` marker and removes material mutation from the
transport-retry path. The host also pins `UE_TCP_PORT`; a private fixed read-only
identity probe corroborates the editor before each call. Direct material and
python tools must be preloaded by host settings; Nexus never loads a pack or
falls back to hayba_invoke on demand.

## 11. Strict engine automation — optional Claireon adapter

**Trigger:** run Unreal's actual automation tests.

**Use:** `automation.tests.run` and `automation.tests.poll`; fixed native
test_run/test_poll wrappers with the same no-autosave compatibility requirement.

Use a narrow nonempty filter, strict=true, expected test set and reasoned allowed
skips. Keep normal timeouts. Record run_id, then poll through a terminal result
with editor frames between requests. Save that terminal evidence: it is emitted
once. Polling is required to release the gate; there is no autonomous expiry.

Missing/not-run/unfinished/timed-out tests and unauthorized skips are not passes.
Cancel an owned run explicitly with `automation.tests.poll(cancel=true)` if
abandoning, then confirm release. The adapter refuses an unowned run ID and
retains the terminal strict evidence. Do not replace this with
caller-recorded assertions, manual double-ticking or a synchronous game-thread
runner that cannot service frame-dependent latent commands.

## 12. Real Insights profiling — optional Claireon adapter

**Trigger:** explain observed hitches or CPU/GPU timing from captured evidence.

**Use:** `insights.capture.start/stop`, `insights.trace.open/scopes/frames/close`.
These are fixed wrappers for pie_trace_start/stop, trace_open,
trace_get_top_scopes, trace_get_frame_stats and trace_close, with the same
no-autosave compatibility requirement.

Capture to a fresh path with needed channels; restore previous trace/named-event
settings on stop. Open the returned real trace, retain the analysis session ID,
query bounded pages, and close the session afterward.
The adapter owns the capture and reader handles it creates; it refuses to stop,
query or close unowned state. Shutdown closes transport connections but does not
silently stop recording, cancel tests, save assets or close native sessions.

Disclose absent channels, sample range and truncation. Frame stats summarize the
returned page, not necessarily the full capture. This implementation's
game_thread_ms is frame duration, not separately measured CPU GameThread work.
Do not invent p95/p99 or GPU time from missing data. File metadata and null timing
fields are not trace analysis. Repeated matched benchmark runs require a separate
acceptance protocol.

## 13. Graphs, Blueprints and widgets — preserve variants / hold atomicity

**Trigger:** edit topology, variables, components or UI structure.

Do not select one universal connect-pins implementation: K2 session semantics,
actual graph-schema persisted edits and automatic conversion nodes differ.
Require stable node/pin identity and account for pin direction and ambiguity.

Before calling a batch “atomic,” test an error after an earlier successful edit
and compare graph, disk and undo history. Transaction.Cancel and cleanup of newly
created nodes do not prove previous deletes/disconnections were reversed.
Record partial work. Preserve unique variable/container/component types.

## 14. Imports and asset lifecycle — conditional / hold

**Trigger:** import, duplicate, rename, move or delete assets.

Dispatch by asset type and intended persistence semantics. World Partition
external packages, Blueprint/ Niagara repairs, redirectors, pinned Windows import
handles and skeletal/Interchange pipelines are not interchangeable variants.

A generic import must set replaceExisting=false explicitly, but third-party
factories may not honor that request. Enforce authorized source/destination scope
and test collisions; never call it a security sandbox merely because a flag exists.
Deletion needs explicit exact-target/reference/disk checks; force/batch cleanup
is not a default. Ordinary rename does not subsume World Partition migration.

## 15. Specialized authoring — preserve scope

**Trigger:** Sequencer, Control Rig, foliage, landscape, geometry or vehicle setup.

- Separate track creation/time conversion from exact-channel readback edits.
  Preserve tangents, section ranges, save status and lossy inverse caveats.
- Source-backed persisted Control Rig is not blank/modular/unsaved rig creation.
- Native foliage placement rules, seeded scatter and grid/disc/brush distributions
  produce different results; preserve their declared algorithm.
- Landscape falloff, units, layer selection and flatten reference differ.
- Asset StaticMesh booleans and live DynamicMesh actor booleans are different.
- Vehicle reflection setters are experimental authoring, not calibrated physics.
  Require actual property readback and behavioral validation.

No generic “same name therefore duplicate” pruning in these categories.

## 16. Multi-agent safety, recovery and release qualification

**Trigger:** concurrent work, editor restart, timeout, native fault or a new winner.

Use stable owners and native asset/machine/session coordination. The Nexus queue
serializes one process only; other gateways/direct clients can still act.
Hayba lease owner labels are not authenticated per-agent principals. Claireon
tool-family sessions are not cross-agent ownership. UE optional fail-open locking
is not a sufficient master safety barrier.

After uncertain transport outcome or contained native fault, stop dispatch.
Keep logs/receipts, inspect actual editor state externally, reconcile outstanding
work, then deliberately restart. No automatic provider fallback or reset tool.
Cancellation before dispatch prevents the operation. Cancellation after dispatch
does not prove native work stopped. Modern HTTP cancellation and original-request
disconnect are propagated; a separate legacy cancellation notification cannot
cancel a different request in the stateless HTTP serving mode. The operation's
deadline and serialized queue still apply.

Before promoting a candidate, run a matrix in the target engine/project:
happy path; invalid input; ambiguous world/object; no-op; unavailable capability;
save failure; late timeout completion; partial mutation; undo; editor restart;
multi-client contention; and any licensing/engine-version gates. Report mock,
native unit and live integration evidence separately.

**Deliverable:** selected canonical IDs, source pins, enabled packs/backends,
changes actually observed, persistence receipts, remaining holds, cleanup state,
and explicit unverified conditions. This document is a draft for later skill
packaging; it installs nothing.
