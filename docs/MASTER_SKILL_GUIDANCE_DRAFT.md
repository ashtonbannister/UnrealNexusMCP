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
For UE-MCP, an absent, contradictory or uninterpretable completion envelope
fences subsequent work; retain the receipt and reconcile externally before restart.
Failed backend cleanup is separately reported as unconfirmed; do not infer that
a process or connection has stopped.
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

**Use:** MCP `tools/list`, `nexus.status`, `nexus.search`, `nexus.describe_source`, `nexus.describe`, `nexus.plan`, the four
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

**Observe:** `play.worlds.list` returns currently materialized PIE and Game world contexts, including world paths and instance identifiers. An empty list does not prove a queued start is absent or establish session ownership.

**Use:** `pie.status` reports a queue-aware native phase. `pie.start.viewport`
starts a session owned by this backend; `pie.stop` stops only that session.
The v4 UAP patch, native method checks and a unique machine grant are required.
Record the returned editor epoch and session ID. Status is a point-in-time
observation, not ownership or a guarantee against a later start. A timeout,
foreign replacement or unconfirmed release requires external reconciliation;
Nexus does not automatically retry or release an uncertain grant.

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
| Exact PIE client including UMG | `screenshot.pie` | Matching world/instance, actual dimensions and an MCP image block |

- Current-viewport capture can bring the level-editor tab to the foreground
  when another tab covers it; it is not a focus-neutral observation.
- Viewport resolution is a downscale bounding box, not a rerender resolution.
  After MCP receipt, Nexus checks static PNG framing and scanline integrity
  with conservative limits of 4,194,304 pixels, 40 MiB of inflated scanlines
  and 4096 chunks. These limits and the static-only policy can reject valid
  images. This is not full pixel decoding, editor attestation or a preallocation
  limit.
- EngineWire editor_viewport mode can show PIE. Inspect the view receipt; require
  reconciled NotPlaying for strict editor-world-only intent. Preserve shaderWait:
  its cap can expire before compilation drains.
- For `screenshot.pie`, use `play.worlds.list` and pass the exact
  `worldPath` and `pieInstance`. The direct-byte compatibility patch returns
  one PNG image without writing a screenshot file. The bounded capture may
  refuse hidden, clipped, resized, or oversized viewports. Nexus correlates the
  image to a host nonce and rechecks the editor identity after capture.
- A file path or base64 inside JSON text is not automatically an MCP image.
  Do not say “I inspected the screenshot” unless the image was actually received.
- Full Slate window, arbitrary scene camera, isolated actor render and live
  gameplay UI are separate capabilities. Do not swap them as duplicates.
- Null-RHI/headless commandlet mode does not promise a rendered screenshot.

**Output:** captured target, actual dimensions, image/file type and limitations.

## 4. Exact actor inspection — UE-MCP

`actor.transform.editor` sets location, rotation and/or scale by actor path in the current editor world, dirties its package and does not save. The native transform receipt precedes editor move callbacks; inspect actual state afterward.

`actor.list.editor` requires the reviewed UE-MCP pagination compatibility patch and its live native marker. It discovers matching actors and returns paths and pages in the current editor world. The native handler gathers rows before paging; pagination is not a frozen snapshot, and streaming proxies are excluded by default. Revalidate selected targets before later actions.

`actor.place.editor` creates one actor in the current editor world without saving. Supply a unique label, class and finite location; optional mesh and material assignments are not verified by the native placement receipt. The receipt does not report the resolved world, actor path or transform: inspect the created actor and world separately. An uncertain dispatch requires reconciliation, not retry.

**Trigger:** read a level actor before editing or verify a gameplay actor.

**Use:** `actor.inspect.editor` or `actor.inspect.pie`.

Require a full object path; the PIE route also requires a world instance.
Compare the returned actor path with the requested path and independently
corroborate the actual editor/PIE world and instance before acting on properties.
Nexus requires exact string matches for both returned path fields; Unreal's
case-insensitive path fallback and whitespace trimming may therefore be
conservatively fenced.
At the reviewed UE pin, the native actor-detail receipt does not report its
resolved world or PIE instance. The requested selector and the gateway's editor
attestation are not a world/instance readback; do not claim the receipt verifies
them. A compatible native context receipt and live evidence remain needed to
satisfy that postcondition. Respect truncation flags, count limits and
large-container omissions. Never substitute an editor actor for its PIE duplicate
or resolve a repeated label by picking the first one.

Actor movement, general property mutation and deletion are **not approved by
these read routes**. Their world/identity and partial-mutation issues remain
separate decisions.

## 5. Scoped persistence — UE-MCP

**Trigger:** persist explicitly authorized changes.

**Use:** `asset.save.exact`, `level.current.inspect`, `level.save.current`.

- Prefer a nonempty explicit assetPaths list for known loaded packages. The
  native save reports one row per resolved package, so multiple requested object
  paths can collapse to one row. Without an explicit per-input mapping, Nexus
  conservatively fences a shorter receipt as outcome-unknown; reconcile before
  further work rather than retrying or assuming an input was omitted.
- Decide force intentionally: unmarked-dirty edits may need force=true, but
  ordinary save should not silently resave unrelated clean assets.
- Inspect the current editing level with `level.current.inspect` and pass its
  exact `levelPackage` as `expectedLevelPackage` to `level.save.current`.
  The UE-MCP guarded-save v2 patch checks that package before mutation and
  refuses dirty empty external packages rather than deleting them. Loaded
  external packages are included; an uncertain receipt requires reconciliation.
  The separate legacy deletion grant does not control this guarded route.
- commitDeletes is fixed false; its true form can sweep every dirty map/content
  package and is not an interchangeable save variant.
- Inspect each saved/notDirty/failed/skipped/deleted package and disk receipt.
  Some saved plus some failed is partial work, not total success.

**Failures:** fix the named persistence problem; do not rerun the original
mutation just because saving failed. Preserve dirty in-memory state and receipts.

## 6. Persisted PCG graph connection — UE-MCP

Use `pcg.graph.inspect` to read the candidate graph node names, pin labels and edges before wiring. Its path is echoed, not independently resolved; its output has no snapshot revision or pagination.


**Trigger:** connect one graph edge and persist it.

**Use:** `pcg.graph.connect.persisted`.

Read current graph identities through an independently available read workflow.
Supply exact node IDs/names and both pin labels; Nexus deliberately removes the
upstream first-pin defaults. Validate schema compatibility and returned edge/save
outcomes: the persisted contract requires both `edgeVerified=true` and
`saved=true`, and exact returned asset/node/pin strings matching the request.
The native provider renders pin labels as FNames, so differing case may be
conservatively refused even when Unreal would match it. An uncorrelated success
receipt fences execution. Generic native errors can also follow a partial
connection attempt and are fenced unless their pre-mutation or correlated
save-failure shape is established. The pinned already-existing-edge branch returns before saving, so
its no-op receipt does not establish persistence and must not be treated as a
newly created edge for undo. Do not automatically repeat the connection or save;
separately authorize any exact-asset persistence and verify its result. Do not
translate old numeric node indices into current graph identities.

Claireon's session edits and EngineWire's optional-save connections stay
separate, not weaker duplicates of this exact persisted contract.

## 7. PCG generation lifecycle — UE-MCP

**Trigger:** regenerate procedural content and verify that run finished.

**Use:** `pcg.generation.execute`, then `pcg.generation.wait`.

1. Verify the actor's first PCG component is the intended target; execute has no
   componentName input selector.
2. Trigger once. Save returned actorPath, componentName and runId.
3. Wait with those exact identifiers and a bounded deadline.
4. Require state=generated, the requested component name, and matching run
   identity. The pinned waiter echoes the requested run ID and drops the native
   actorPath, so its receipt alone cannot independently prove the actor; verify
   it separately. Native success=true may also mean idle, cancelled, cleaned or
   not_started; those are not generation.
5. Inspect the generated content appropriate to the graph. Nonzero ISM count
   alone is not a universal completion or correctness test.

**Failures:** a native wait timeout or generation-state read failure fences
subsequent gateway work because the existing generation may still be active.
Reconcile the run externally before restart; do not trigger another run or
interpret the timeout as cancellation.

## 8. Enhanced Input and owned holds — UE-MCP

**Trigger:** exercise gameplay at the InputAction layer.

**Use:** `input.action.once`, `input.action.hold.start`,
`input.action.hold.update`, and `input.action.hold.stop`.

For holds, obtain the exact `world_path` and `pie_instance` from
`play.worlds.list`, choose the local `client_id` and a unique
`injection_id`, and supply the InputAction's exact object path. The host
creates and retains a private native owner token; only that gateway process
can update or stop its hold. The real-time lease defaults to 300 seconds and
can be set from 1 to 3600 seconds. Expiry is checked while the editor ticks.
Stop deliberately and inspect the receipt; one frame already queued may still
execute. A timeout is not proof of release.

The owned hold uses one-frame injections and does not overwrite or stop the
shared continuous-input slot. Input from different sources can still combine
in gameplay. PIE end clears native holds; a process restart does not recover
the gateway's private ownership map. Reconcile any uncertain or legacy holds
externally. The token is a routing ownership guard, not a security boundary
against arbitrary code running inside Unreal.

Require an explicit PIE world and local-player index. These are not the remote
client relay index or Slate user index. Keep input values finite/in engine-float
range. The one-shot receipt identifies the requested action and value type but
does not independently report the resolved world or local player; corroborate
target and gameplay effect independently. Injection has no automatic rollback.

This bypasses physical input and is not a complete end-to-end keyboard/UI/
hardware test. Raw keys, Slate analog input, UMG clicks and synthetic XR poses
need separate contracts.

## 9. Blueprint compile without save — optional Claireon adapter

**Trigger:** diagnose a Blueprint while preserving an explicit no-save boundary.

**Use:** `blueprint.compile.memory.loaded` for an already-loaded exact
Blueprint. It uses a fixed session-free, single-asset batch form with
`SkipSave`, bounded diagnostics and an editor-wide lock that refuses rather
than cleaning up expired sessions. The asset must already be loaded; no
implicit load or folder expansion is performed. The operation can change
in-memory compiled state and uses Unreal's batch compile mode, which suppresses
the usual compiled broadcasts.

The broader `blueprint.compile.memory.asset` and
`blueprint.compile.memory.session` variants both delegate to the fixed bp_compile function via public python_execute, but
both are held before dispatch. The native session form does not verify session
ownership; the asset form can reuse another client's same-tool session and
clean up expired sessions without ownership. Do not implicitly close or alter
existing sessions; reconcile them externally until a reviewed native ownership
contract is available.

Use exactly one asset_path or session_id; preserve the diagnostics and truncation
information that the selected form provides. The loaded form reports bounded
error and warning text, not structured node GUIDs. Require actual compile status,
not Python wrapper success. Do not auto-close sessions without checking whether
close saves.

**Required compatibility:** the loaded-compile v2 patch for the loaded
variant, plus the live exact-form schema and `nexus_skip_auto_save` parameter. Nexus supplies true on every fixed wrapper,
including read-only schema probes. The unmodified outer Python runner can save
before the inner compile begins; `SkipSave` alone does not establish no-save.

Arguments are JSON/base64 encoded and outputs nonce-framed. Missing, ambiguous,
truncated or spilled output leaves an unknown outcome. No model-supplied Python.
Compile-and-save, batch/folder compile and helpers that reset the undo buffer
remain distinct.

## 10. Strict material parameter persistence - optional Hayba adapter

**Trigger:** change one existing global material-instance parameter and save it.

**Use:** `material.parameter.scalar.persisted`,
`material.parameter.vector.persisted`, `material.parameter.texture.persisted`.
The reviewed v2 Hayba patch and fixed read-only native identity marker are required.
Use exact canonical object paths for both the instance and any texture. Native
preflight verifies target, parameter type and read-only state before mutation.

Scalar and vector values are checked as binary32 bits; three-component vectors
use alpha 1. Texture readback checks the resolved requested object and pointer.
A result is reported persisted only when readback is verified, save succeeds and
the package is clean. Preserve native receipts, warnings and partial results.
If save or readback fails, memory may already have changed; do not repeat the
mutation automatically.

Layer-associated parameters, static switches and unsaved sessions remain
distinct. The host preconfigures Hayba's material pack; Nexus does not invoke
a generic routing tool or dynamically load a pack to evade a refusal.

## 11. Strict engine automation — optional Claireon adapter

**Trigger:** run Unreal's actual automation tests.

**Use:** `automation.tests.run` and `automation.tests.poll`; fixed native
test_run/test_poll wrappers with the same no-autosave compatibility requirement.

Automation start is held before dispatch: the pinned native start can replace
an independently active run. Do not assume gateway-local ownership coordinates
direct clients. Reconcile existing runs externally; no implicit cancellation is
performed. When a reviewed native atomic ownership guard exists, use a narrow
nonempty filter, strict=true, expected test set and reasoned allowed skips. Keep normal timeouts. Record run_id, then poll through a terminal result
with editor frames between requests. Save that terminal evidence: it is emitted
once. Polling is required to release the gate; there is no autonomous expiry.

Missing/not-run/unfinished/timed-out tests and unauthorized skips are not passes.
Cancellation or timeout can release the native gate before workers have stopped;
a cancellation receipt is not cleanup confirmation. The adapter fences and
retains ownership for external reconciliation. It refuses an unowned run ID and
retains terminal strict evidence. Do not replace this with
caller-recorded assertions, manual double-ticking or a synchronous game-thread
runner that cannot service frame-dependent latent commands.

## 12. Real Insights profiling — optional Claireon adapter

**Trigger:** explain observed hitches or CPU/GPU timing from captured evidence.

**Use:** `insights.capture.start/stop`, `insights.trace.open/scopes/frames/close`.
These are fixed wrappers for pie_trace_start/stop, trace_open,
trace_get_top_scopes, trace_get_frame_stats and trace_close, with the same
no-autosave compatibility requirement.

Trace capture start and stop are held before dispatch: the pinned path write does
not prove output ownership or physical target, and global stop can affect an
independently replaced capture. Reconcile existing captures and named-event
state externally; Nexus performs no implicit stop. A fresh basename does not
establish physical file ownership. After a reviewed native ownership guard,
capture with needed channels and restore prior settings on stop. Trace reader
open is also held: after preliminary path checks, the pinned native session
manager stops and removes all expired readers, including independently owned
readers, before its own file and extension validation.
Nexus does not implicitly close readers. After an ownership-aware native fix,
open the returned real trace, retain the analysis session ID,
query bounded pages, and close the session afterward.
The adapter owns the capture and reader handles it creates; it refuses to stop,
query or close unowned state. Shutdown closes transport connections but does not
silently stop recording, cancel tests, save assets or close native sessions.

Disclose absent channels, sample range and truncation. Frame stats summarize the
returned page, not necessarily the full capture. The average is checked for an
page with no finite frames or one finite frame; multi-frame average consistency is not
independently verified. This implementation's game_thread_ms is frame duration,
not separately measured CPU GameThread work.
Do not invent p95/p99 or GPU time from missing data. File metadata and null timing
fields are not trace analysis. Repeated matched benchmark runs require a separate
acceptance protocol.

## 13. Graphs, Blueprints and widgets — preserve variants / hold atomicity

**Trigger:** edit topology, variables, components or UI structure.

Use `blueprint.create` to create one Blueprint at a package path, and
`blueprint.variable.add` to add and save a variable on an exact object path.
Both refuse an existing name. Creation compiles and may save according to the
editor's Save on Compile setting; its receipt does not say whether it saved.
Variable addition compiles and saves, and a failed save can leave an in-memory
change. Read back the Blueprint or disk state when it matters.

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
