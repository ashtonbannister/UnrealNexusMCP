# Disposable native acceptance harness: design only

Status: **not built, not run, not native-qualified**. This is preparation for [ENV-04](../QUALIFICATION_PLAN.md#env-04), not a result or a replacement for the [acceptance matrix](../INTEGRATION_ACCEPTANCE.md). Project, engine, profile, loaded builds and endpoints remain to be selected and recorded under ENV-01–03. No native artifacts or project changes are asserted here.

## Fixture and execution design

1. An operator supplies a disposable copy of a revisioned test project. Record its source revision, copied location and hashes before writes. Create fixture data outside Nexus as needed and disclose setup; this is not a Nexus capability. Keep credentials and personally identifying paths out of shared evidence. Save the reset procedure and exact artifact identities privately.
2. Include two actors with the same label but distinct exact paths, a second map, explicit PIE worlds/clients, writable and read-only packages, a PCG graph with known node/pin identities and an existing edge, and an actor with two PCG components. Record stable IDs after creation; fixture roles below are not invented canonical inputs.
3. Include valid, broken and warning-producing Blueprints; a material instance with existing scalar/vector/texture parameters and mismatched-type controls; a gameplay actor that logs Enhanced Input action/player/value; and known passing, failing and missing automation tests. Configure incomplete/cancelled runs only in the disposable project.
4. Configure a known trace workload with named scopes and game/render frames; preserve a trace with absent optional channels and an unterminated frame if reproducible. Otherwise mark that native case blocked rather than manufacturing evidence.
5. Before each case, bind the exact enabled profile and provider build to the selected editor PID/start epoch and project. Record source pin, patch and live markers separately from loaded module/server hashes. Capture baseline state and package/file hashes. Verify discovery and planning start no provider. Use the actual MCP front door and preserve the unmodified receipt, structured content, image blocks and metadata.
6. Run one case at a time in one owned editor. For multiple-client cases use separately identified clients against the same runtime. Document direct-client interference without claiming a global queue lock. Inject disconnect/timeout only with a reproducible method that establishes whether native work started. Record one dispatch and never automatically replay an uncertain mutation.
7. Save exact inputs, identities, preconditions, receipts, state readback, hashes/artifact links, outcome and cleanup. Apply the common matrix in the qualification plan to each row and mark each case applicable, not applicable with reason, blocked or not run. Mutation evidence separates memory/disk and includes reload when persistence is claimed.
8. Release owned resources through explicit supported operations while unfenced. If fenced or uncertain, retain the receipt, externally reconcile editor/session/hold/run/capture, and deliberately restart only after the operator records the result. Never reset or blindly replay. Preserve unresolved ownership; restore the disposable project using its recorded operator-controlled reset procedure, not an inferred inverse.

## Operation cases

Each row specifies minimum distinct setup and positive/negative evidence in addition to the common matrix. Use actual canonical argument names and values from the current `catalog/operations.json`, recording exact inputs and actual fixture identities. Cleanup shorthand: **R** = read-only/no resource owned; **P** = reconcile and restore disposable packages/map from baseline; **S** = explicitly release owned resource and record confirmation or unresolved state; **F** = retain fresh file/trace and reconcile its lifecycle. None authorizes deletion outside the disposable project; a read can still need recovery after response loss.

| Canonical operation | Setup and positive observation | Distinct failure/recovery cases | Cleanup |
| --- | --- | --- | --- |
| `pie.start.viewport` | No PIE; independently observe playing and owned session. | Queued start, post-send loss and retained grant; no second start. | S |
| `pie.stop` | Owned running PIE; observe NotPlaying and teardown. | Unowned stop, queued teardown, uncertain release. | S |
| `pie.status` | Known editor/PIE phases; compare RC/native identity. | Wrong editor, malformed RC, restart epoch. | R |
| `screenshot.viewport.current` | Visible marker; inspect actual MCP pixels, dimensions, view and shader wait. | Missing image, view mismatch, headless intent. | R |
| `screenshot.pie` | Known client and fresh output path; verify PNG, dimensions, exact client. | Wrong instance, stale output, failed write; path alone is not pixels. | F |
| `actor.inspect.editor` | Duplicate labels with exact paths/properties in editor world; verify identity/truncation. | Ambiguous label, wrong path, stale epoch. | R |
| `actor.inspect.pie` | Matching actor in explicit PIE instance; compare world and identity. | Missing/wrong instance, editor-world substitution. | R |
| `level.save.current` | Dirty current map/external packages; inspect per-package receipt and reload. | PIE refusal, wrong map, partial/read-only save. | P |
| `asset.save.exact` | Multiple dirty assets, select subset; verify selected files/reload and untouched others. | Empty/invalid scope, missing/read-only, partial or malformed receipt. | P |
| `pcg.graph.connect.persisted` | Exact graph/node/pins; verify edge and reload. | Existing edge no-op, stale/wrong pin, save failure; do not invert no-op. | P |
| `pcg.generation.execute` | Actor with known first component; verify returned component/run and start. | Multi-component intent mismatch, failure after start, loss without replay. | S |
| `pcg.generation.wait` | Returned generation run; verify generated state and matching lastRun. | Cancelled, idle, not_started, stale, timed-out. | S |
| `input.action.once` | Instrumented action in explicit world/player; compare input log and effect. | Missing action, wrong player/world, nonfinite value. | R |
| `input.action.hold.start` | Instrumented action; observe sustained effect and owned ID. | Foreign/conflicting hold, loss after start. | S |
| `input.action.hold.update` | Owned hold; verify changed effect for same ID. | Foreign/stale ID, invalid values. | S |
| `input.action.hold.stop` | Owned hold; confirm stop receipt and no residual effect. | Loss/timeout is not release proof. | S |
| `blueprint.compile.memory.asset` | Valid/broken/warning assets and unrelated dirty package; capture diagnostics and disk hashes. | Truncation, both autosave sites, Save-on-Compile. | P |
| `blueprint.compile.memory.session` | Explicit session and known asset; compile with no unintended save. | Foreign/stale session, close persistence semantics. | S, P |
| `automation.tests.run` | Exact known set and skip reasons; observe owned ID, not a pass. | Missing tests, disallowed skip, second run, uncertain start. | S |
| `automation.tests.poll` | Owned run; pace polls and retain once-only terminal verdict/counts. | Unowned, cancelled, unfinished, consumed terminal. | S |
| `insights.capture.start` | PIE, known workload, fresh basename/channels; observe recording/settings. | Existing capture, wrong state, interrupted start. | S, F |
| `insights.capture.stop` | Owned capture; verify exact finalized path and restored settings. | Foreign/mismatched path, not_recording, uncertain stop. | S, F |
| `insights.trace.open` | Fresh real trace and hash; observe exact file and owned reader. | Invalid trace, absent providers, ambiguous/spilled result. | S, F |
| `insights.trace.scopes` | Owned reader and known interval; verify bounded rows and channel/timing metadata. | Foreign handle, inverted range, absent GPU, truncation. | S |
| `insights.trace.frames` | Owned reader and known range; verify bounded page and null open frames. | Foreign handle, unterminated frames, unsupported timing claims. | S |
| `insights.trace.close` | Owned reader; observe exact handle close. | Foreign/lost handle; reader close does not stop capture. | S |
| `material.parameter.scalar.persisted` | Existing scalar; verify typed value, save and reload. | Missing/wrong type, overflow, readback/save failure. | P |
| `material.parameter.vector.persisted` | Existing vector; verify RGB/RGBA and persisted reload. | Short/invalid vector, wrong type, partial save. | P |
| `material.parameter.texture.persisted` | Existing parameter and loaded texture; verify asset and persisted reload. | Invalid texture, wrong type, read-only, failed save. | P |

## Secret-free evidence template

This schema illustration is not a completed record. Use null for unknowns and explicit outcomes. Keep original receipts and sensitive paths in access-controlled artifacts; publish redacted copies and artifact digests without credentials. The private record must retain facts required to reproduce identity, dispatch, persistence and ownership.

```json
{
  "schema_version": 1, "run_id": "operator-assigned", "status": "not-run",
  "nexus_commit": null, "lockfile_sha256": null,
  "platform": {"os": null, "architecture": null, "engine_build": null, "compiler_sdk": null, "node": null, "python": null},
  "project": {"revision": null, "disposable_copy_id": null, "baseline_manifest_sha256": null},
  "profile": {"enabled_operations": [], "transport": null, "providers": []},
  "target": {"project_identity": null, "editor_pid": null, "editor_start_epoch": null},
  "cases": [{
    "operation": null, "case": null, "case_kind": null, "applicability": null, "outcome": "not-run",
    "provider": null,
    "provider_pin": null, "patch_sha256": null, "live_marker": null, "loaded_artifact_sha256": null,
    "preconditions": [], "canonical_arguments_redacted": null, "target_identity": null,
    "dispatch_count": null, "receipt_artifact": null, "receipt_sha256": null,
    "before_artifacts": [], "after_artifacts": [], "reload_evidence": null,
    "owned_resources": [], "cleanup_actions": [], "unresolved": [], "reason": null
  }],
  "reviewer": null, "qualification_scope": null
}
```

For compatibility-dependent passing cases, `patch_sha256` and `live_marker` declare the reviewed patch digest and compatibility-marker object. They are assertions; the offline validator does not query the editor or verify a loaded binary.

Each artifact reference identifies its storage and digest. Preserve original image bytes and record dimensions and MIME type. For each provider distinguish source/patch, live marker, actual loaded artifact, listener and process identity. Record each common-matrix case separately so omission cannot appear as a pass. This design supplies no run results or project assets.

For each case, `case_kind` distinguishes `positive` observations from `negative` refusal/recovery checks; `provider` identifies the selected provider. An overall passing profile needs a dispatched positive case per enabled operation; applicable negative cases may refuse before dispatch.

The offline `node scripts/qualification-evidence.mjs <manifest.json>` command checks the record structure and required provenance. It does not inspect artifact bytes, prove case coverage, or establish native qualification.
