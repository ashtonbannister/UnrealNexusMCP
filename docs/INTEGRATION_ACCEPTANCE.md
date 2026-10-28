# Integration acceptance checklist

The MCP host, transports and adapters are tested with fixtures, without a live
editor. The live checks below must precede claims that Nexus works end to end.
Use a disposable copy of a representative
project, a recorded source pin, an identified editor instance, and explicit
authority for every mutation.

## Adapter and identity gates

- [x] Implement stdio/Streamable HTTP adapters using a maintained MCP SDK;
      protocol fixture tests pass. Explicit legacy SSE is also covered.
- [ ] Use UE-MCP micro mode (`tools`), EngineWire `unreal`, and UAP's registered
      direct tools. Do not call internal functions as public MCP names.
- [ ] Verify installed source revisions, protocol/schema versions and licences.
- [ ] Attest project/worktree, editor PID/start epoch and intended instance.
- [ ] Query exact live capability/schema, not a static union or mere meta-tool.
- [ ] Confirm enabled capabilities only; disabled packs never start a provider.
- [ ] Authenticate remote transports; do not expose native endpoints publicly
      without their required authorization and transport controls.
- [ ] Preserve errors, image blocks, resource links, progress and full metadata.
- [ ] Forward native consent faithfully where needed; never fabricate a grant.
- [ ] Reject stale identities after reconnect; do not auto-replay uncertain work.

Implemented gates are covered in `VALIDATION.md`, but these unchecked items
require observation in the actual editor and project. Native binary provenance,
Windows listener/process inspection, loaded plugin coexistence and engine
behavior are not established by Linux protocol/fixture tests.

## Functional matrix

| Case | Required outcome |
|---|---|
| Happy path | Actual expected state and full native receipt |
| Invalid parameters | Rejected before mutation |
| Unknown/disabled inner action | No alternate backend or raw escape |
| Wrong/ambiguous world or actor | Explicit refusal; no first-match fallback |
| Existing/no-op graph edge | No new-change inverse |
| Save failure/read-only package | Per-package failure; memory/disk state distinguished |
| Batch partial write | Exact completed/failed items retained |
| Timeout after native start | No duplicate call; eventual state reconciled |
| Editor restart during call | Old handles invalidated; outcome not assumed cancelled |
| Multiple clients | Native safety/leases still effective; core queue not overclaimed |
| Screenshot | Correct viewport/client, actual pixels/dimensions, fresh file if needed |
| PIE start race/queued stop | No late orphan session; teardown confirmed |
| Malformed UAP RC response | Do not accept defaulted fields as independent proof |
| PCG cancelled/idle/not_started | Not classified as successful generation |
| Held input and cleanup | Every owned hold released or explicitly unresolved |
| Undo/rollback | Actual prior-state restoration checked, not inferred |
| Engine/plugin version change | Selection requalified before pin update |

## Specialist adapter acceptance

Claireon adapters are implemented: call fixed internal functions through python_execute, safely encode
arguments, frame exactly one JSON result and fail on missing/truncated/spilled
output. Do not inherit proxy automatic mutation retry. Test native errors inside
successful Python execution. Require the exact no-autosave compatibility patch
and live outer marker before even a schema probe. Test both outer autosave sites
in the rebuilt native plugin; a clean source patch application is insufficient.

Hayba: require the exact no-retry compatibility patch, fixed native TCP binding,
direct read-only identity tool, typed material route and full schema refinement. Do not allow
`hayba_invoke(via=ts)` to silently fall through to legacy dispatch. Require
3/4 finite float32-range vector elements and actual verified/saved outcomes.
Do not expose the native static-switch branch through a schema that lacks bool.

UAP: require exact project/PID/RC binding, the complete live dispatch marker and
the no-replay compatibility patch. Test dropped sockets after the actual editor
begins executing, not only before connection. Confirm no duplicate start/stop,
correct success-boolean handling and retained machine grant after uncertain
Python failure. Reconcile/release the grant through the operator recovery path.

Ivan: review component-level PolyForm Shield restrictions for RQL/Code-Exec before
incorporation; the root Apache licence does not relicense vendored components.
An external adapter is not a guarantee every intended competitive use is allowed.

## Promotion record

Record canonical ID, old/new winner, immutable source revisions, engine/project,
test inputs and observed state, diagnostic artifacts, persistence effects,
unresolved issues and rollback plan. Update the decision register and master
guidance in the same change. Never call a mock pass live Unreal qualification.
