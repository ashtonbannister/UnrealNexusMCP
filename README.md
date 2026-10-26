# Unreal Nexus MCP

**One canonical capability set. One reviewed winning implementation per function.
Only the backends needed by enabled capabilities. Optional specialists.**

This first implementation is a **source-curated catalogue, lazy routing core and
offline planning CLI**. It is not yet a network-facing MCP server, a merged native
Unreal plugin, or a live-tested integration. No Unreal project is modified by
installing or inspecting this repository.

## What is included

- 16 narrowly defined canonical operations, with exactly one selected route each.
- 23 evidence-backed decision groups covering six pinned upstream projects.
- 25 competing-default exclusion entries; useful semantic variants are preserved.
- Per-capability/per-pack enablement and lazy, cached backend factories.
- Fixed public call envelopes for UE-MCP micro mode, EngineWire and UAP.
- Disabled-by-default writes; explicit target/source/capability attestation by
  host adapters; no generic backend/Python/console escape hatch.
- One-process execution queue; no blind retry/failover after uncertain outcomes.
- Native images, diagnostics, warnings and partial-result fields preserved.
- A [master skill guidance draft](docs/MASTER_SKILL_GUIDANCE_DRAFT.md) with triggers,
  preconditions, verification and failure handling.

**Important scope:** the repository initially contained only LICENSE. There were
no existing integrated native functions to delete. The weaker duplicates are
excluded from the new Nexus allowlist, not removed from upstream plugin source.

## Inspect and test

Node 22+ is required. There are no external dependencies or install scripts.

```sh
npm run check
npm run catalog -- list
npm run catalog -- describe asset.save.exact
npm run catalog -- plan asset.save.exact '{"assetPaths":["/Game/Blueprints/BP_Demo"],"force":true}'
```

The CLI only lists/describes/plans; it never connects to Unreal or executes a
mutation. A plan includes the fixed provider route and postconditions, and says
`dispatched: false`.

## Backend composition

| Pack | Selected backend(s) | Default |
|---|---|---|
| authoring-core | UE-MCP | Off; suggested base |
| editor-observation | EngineWire | Off; suggested base |
| playtesting | UnrealAgentPlayer + UE-MCP | Optional, off |
| blueprint-compile | Claireon | Adapter required, cannot enable |
| material-strict | Hayba | Adapter required, cannot enable |
| automation-tests | Claireon | Adapter required, cannot enable |
| insights-analysis | Claireon | Adapter required, cannot enable |

Individual capability IDs can be enabled instead of a pack. Enabling a pack does
not immediately load its backends. The first execution of an enabled capability
loads its chosen provider; later calls reuse it. A provider that is never used is
never started. A disabled function cannot trigger a loader.

Ivan's backend is not required by this first executable set. Its distinct
capabilities are documented rather than falsely classified as redundant.

## Host integration contract

The exported `Gateway` is a transport-independent library. `toolDefinitions()`
returns only enabled canonical MCP names/schemas/annotations, without loading a
backend; a host server can register those and dispatch through `execute(id,args)`.
A host must provide
a factory for each enabled provider it intends to use. Factories receive
`{provider, source, target}` and return:

```js
{
  tools: new Set(/* actually advertised public MCP tool names */),
  sourceCommit: "...",        // verified installed revision matching source lock
  target: { projectRoot: "...", editorInstanceId: "..." },
  identityVerified: true,     // determined by the host adapter, never guessed
  supports: async (operation) => true, // query actual editor capability/schema
  call: async (request, timeoutMs) => { /* full MCP CallToolResult */ },
  close: async () => { /* close owned connection/process */ }
}
```

This is an interface sketch, **not an implemented connector**. Never hardcode
`supports=true` or `identityVerified=true` in a real adapter without verification.
The core checks the attested values; it cannot independently establish them.
Installed revision verification may need local installation metadata in addition
to the MCP handshake.

Trusted host configuration provides `enabledPacks`, `enabledCapabilities`,
`backendFactories`, `target`, `allowWrites` and `timeoutMs`.
See [the example configuration](examples/config.example.json) for enablement;
it intentionally has no target and cannot dispatch until configured.

Native guards, authorization, leases and lifecycle ownership remain mandatory.
Top-level tool discovery does not prove an inner capability exists. Callers must
not access uncurated backends directly to bypass a refusal.

## Selection and update policy

“Best” is assessed per semantic contract: target identity, validation,
verification, save scope, completion, failure behavior and recovery. A memory
edit is not a persisted edit; a file path is not an inspected image; a queued job
is not finished work.

Current reviewed source revisions are pinned in
[catalog/upstreams.lock.json](catalog/upstreams.lock.json). New releases are
replacement candidates, not automatic winners. Review and test the affected
function before changing its route. Never silently fail over after a mutation.

- [Implementation selections and limitations](docs/IMPLEMENTATION_SELECTION.md)
- [Machine-readable decisions and exclusions](catalog/decisions.json)
- [Canonical operations and schemas](catalog/operations.json)
- [Full audit inventory](docs/audit/inventory.md)
- [Integration acceptance checklist](docs/INTEGRATION_ACCEPTANCE.md)
- [Validation record](docs/VALIDATION.md)
- [Third-party boundaries](THIRD_PARTY_NOTICES.md)

## Safety and maturity

Timeout, disconnect and malformed transport output fence further execution in
that gateway instance. There is no model-callable reset. Reconcile editor state
externally before deliberately restarting. Some native error replies can still
describe partial changes; read the result and do not blindly rerun the mutation.

The queue coordinates **only this process**. It is not a native game-thread lock,
cross-process mutex, undo guarantee or cancellation mechanism.

Tests use simulated backends. Native compilation, actual MCP transport wiring,
live editor identity, engine-version compatibility and plugin coexistence remain
unqualified. See the acceptance checklist before enabling real writes.

### Execution outcomes

Backend startup and read-only attestation run inside the serialized preparation
stage. Refusals preserve their actual error codes and do not imply a dispatched
editor edit. Preparation and dispatch each have a separate bounded deadline;
late preparation completion cannot dispatch the operation. Factories and
`supports` checks must not perform the requested mutation.

After dispatch, timeout/disconnect/malformed transport output fences the queue.
A normal UAP response reporting an outstanding queued start or incomplete stop
also fences it and retains the original receipt. All further calls, including
`pie.stop`, require external operator/host reconciliation before a new gateway
instance is started. There is no automatic retry, fallback or reset tool.
