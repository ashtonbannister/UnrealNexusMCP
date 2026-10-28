# Implementation selection

Review date: 2026-10-26. This is a bounded source comparison, not an exhaustive
runtime certification of every function in six large projects.

The target repository began with only `LICENSE` at commit
`d57d7137020e2ef33a2aaf9abdb9f9fe5d9e3ba2`. There were no integrated implementation
bodies to delete. This change creates an **allowlisted, duplicate-excluding
canonical catalogue and routing core**. It does not claim that native source
files were removed from existing integrations.

## Architecture decision

One canonical capability has one selected implementation. Configuration enables
capabilities individually or in packs. A backend factory starts only when an
enabled capability assigned to it is executed. Listing, describing and planning
do not start anything. Unused specialists impose no startup dependency.

The catalogue now has 29 executable routing contracts in 13 selected groups.
Thirteen optional specialist routes extend the original 16 core routes, with
explicit reviewed compatibility requirements. Other choices remain conditional,
preserved variants or holds. The 25 excluded
default candidates are **not 25 deleted native functions**: some entries name a
family or a behavior that must not be imported as Nexus's default.

| Responsibility | Source-preferred implementation | State |
|---|---|---|
| Confirmed viewport PIE lifecycle | UnrealAgentPlayer | Selected, restricted schema; no-replay/target-binding patch required |
| Current viewport image (editor or PIE) | EngineWire | Selected |
| Exact PIE client capture with UMG | UE-MCP | Selected; host file output |
| Exact actor/world inspection | UE-MCP | Selected |
| Current level and exact package saves | UE-MCP | Selected; no broad-save selector |
| Persisted PCG connection and run-aware generation | UE-MCP | Selected |
| Explicit-world Enhanced Input and named holds | UE-MCP | Selected |
| Blueprint compile without saving | Claireon | Optional fixed adapter; no-autosave patch required |
| Strict material parameter readback/save | Hayba | Optional typed adapter; no-retry patch required |
| Strict asynchronous engine automation | Claireon | Optional fixed adapter; no-autosave patch required |
| Real Insights timing/frame analysis | Claireon | Optional fixed adapter; no-autosave patch required |

“Selected” means best-supported **for the stated contract at the inspected
revision**. It does not mean bug-free or proven in the user's engine/project.
For example, UAP has better queued-start cancellation and transition waiting,
but its Remote Control getters can default missing fields. That limitation must
be covered during live acceptance.

## How duplicate decisions are made

Compare actual target resolution, world/client scope, parameter validation,
mutation ordering, completion semantics, persistence scope, real readback,
partial failure reporting and recovery. Do not rank by README tool counts,
stars or a shared function name.

A memory-only edit is not a persisted edit. A scene render is not a live UI
screenshot. A queued request is not completed work. Metadata about a trace file
is not timing analysis. Semantically different implementations remain separate.

Only competing Nexus defaults are excluded. Native safety helpers, transaction
logic, sessions, game-thread scheduling, locks and unique operations stay with
their external backends. There is no universal “best backend.”

## Latest reviewed, not floating latest

`catalog/upstreams.lock.json` pins six source revisions.
`catalog/decisions.json` records each winner, exclusion, qualification and
commit-pinned implementation evidence. `catalog/operations.json` is the sole
executable allowlist. A decision without an operation entry cannot be executed.

An upstream release becomes a **candidate** for the affected functions. Diff
its schema and implementation; rerun refusal, no-op, partial-write, save-failure,
world-selection and completion tests. Change a winner and pin only after that
review. Do not automatically route to a new HEAD or silently fail over after a
failed mutation. Deprecate a canonical ID only if its contract itself changes.

## Optional packs and scope

`authoring-core` and `editor-observation` are the suggested base selection,
but all packs are off by default. `playtesting` adds UAP lifecycle and UE
gameplay observations/input. Specialist packs for compile, strict materials,
automation and Insights are implemented and opt-in. Source patches and live
markers are required before the affected routes can execute.

Ivan's backend is not required by the 29 selected routes. This is not a finding
that every Ivan capability is redundant: isolated/camera rendering and queries
are distinct. Component licensing must be assessed before incorporating its
PolyForm Shield RQL/Code-Exec components. No such source is copied here.

## Runtime boundary

The routing core now has a runnable MCP host, stdio/Streamable HTTP/explicit SSE
backend transports, provider identity probes and fixed specialist adapters.
The public server supports stdio and authenticated loopback HTTP. Its production
runtime verifies source checkout/patch evidence, OS process identity, independent
native/listener targeting and live capability availability. See
[runtime setup](RUNTIME_SETUP.md) and [compatibility patches](../patches/README.md).

This is not a merged native plugin or a remotely deployed connector. Source
checkout hashes do not independently establish loaded native binary provenance,
and per-call identity checks are not an atomic native editor-epoch lock.

A public meta tool existing does not establish that an inner action is enabled.
The core requires `supports(operation)` confirmation before dispatch, and keeps
all native checks. The host adapter must derive it from the actual editor, not
from a static documentation union across editors.

Writes are off by default. No generic backend, console or Python escape hatch is
present. All execution is serialized in this process. A transport failure,
malformed result or deadline fences subsequent execution; there is no automatic
retry, provider fallback or model-callable reset. The queue cannot police other
processes, direct clients or native engine events.

Pre-dispatch startup, attestation and capability refusals retain their actual
error and do not fence unrelated providers: no operation was dispatched.
Preparation and dispatched work each have a bounded deadline. A late preparation
result cannot execute the operation. Native queued-start or incomplete-stop
receipts fence subsequent work while preserving the original result. Recovery is
external and explicit; even pie.stop cannot bypass a fenced queue.

Known ordinary native refusals remain results, not automatic retries. A received result
does not prove that all intended changes reached disk. Preserve and inspect
warnings, per-package receipts, task IDs, images and partial-state diagnostics.

## Qualification and evidence

- Six provider/domain reports: [audit index](audit/inventory.md).
- Actionable workflow draft: [master skill guidance](MASTER_SKILL_GUIDANCE_DRAFT.md).
- Machine-readable routing: `catalog/operations.json`.
- Decisions and rejected defaults: `catalog/decisions.json`.
- Local test command: `npm ci --ignore-scripts` then `npm run check` on Node 22+.

Gateway tests include real protocol clients/processes/HTTP listeners backed by
fixtures, source-derived schemas and isolated patched-method checks. No native
Unreal plugin was compiled or run here. Engine-version compatibility,
multi-plugin coexistence and complete end-to-end workflows remain live acceptance
tasks. Nothing was installed in or changed in an Unreal project.
