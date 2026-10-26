# Validation record

Date: 2026-10-26. Current implementation: Nexus 0.2.0, on
`codex/implementation-curation`.

## Current gateway result

**`npm run check`: 154 passed, 0 failed, 0 cancelled, 0 skipped.**

Executed from the completed writable checkout using Node.js v24.22.1 on Linux,
with the official pinned SDK dependencies installed. The final full run took
approximately 6.1 seconds of Node test time. This was a real filesystem/package
run, including fixture child processes and loopback HTTP servers.

The environment's ordinary sandbox blocked child-process/loopback operations;
those protocol tests were rerun with the approved local process/network
permissions. No Unreal editor or external production backend was contacted.

Catalogue validation also passed:

| Item | Result |
|---|---:|
| Canonical operations | 29 |
| Decision groups | 23 |
| Selected groups | 13 |
| Competing-default exclusions | 25 |
| Immutable upstream pins | 6 |
| Current decision evidence entries with verified paths/line ranges | 72 |

The CLI help and offline exact-asset-save plan passed; planning reported
`dispatched: false`. Markdown relative links in the updated runtime/setup,
master guidance, selection, acceptance and patch documents resolved. `git diff
--check` passed.

## What the tests establish

### Real MCP transport and public server fixtures

- **14 transport tests:** actual stdio handshake/tool pagination, explicit child
  environment inheritance, Streamable HTTP and explicit legacy SSE, multimodal
  result preservation, startup/call/close bounds, cancellation and no request
  replay after 401/500, redirects, timeout or dropped streams.
- **13 front-door tests:** actual SDK clients access canonical tools, all guidance
  resources and the workflow prompt over stdio/HTTP. Tests cover lazy loading,
  read/write gates, bearer/Host/Origin/path/body checks, one shared queue across
  separate HTTP clients, and a fence that survives subsequent HTTP requests.
- The production `src/main.mjs` entrypoint was launched with the all-off example,
  not just a fixture server factory. It advertised exactly three controls,
  returned the master draft, loaded no providers and closed its actual child
  process on stdin EOF.
- Modern HTTP cancellation and original legacy POST disconnection reached the
  backend signal and fenced dispatched work. A standalone legacy cancellation
  notification is **not** claimed to cancel another stateless request instance.
- A normal MCP error result containing UE's native `MACHINE_ERROR` timeout tail
  preserved its original content and fenced another client's operation.

### Routing, configuration, identity and outcomes

- Exactly one selected route per contract, explicit optional packs and all-off
  defaults; no raw backend/Python/console tool in the public manifest.
- Strict input subsets, immutable selectors, original-argument validation before
  cloning, bounds and finite numbers, exact world/player/run/asset selectors.
- Lazy per-provider startup, cached startup failure, source/target/capability
  refusal before canonical dispatch and no alternate-provider fallback.
- Configuration validation and source-proof checks, including untracked additions
  and assume-unchanged/skip-worktree flags that can hide tracked edits.
- The UAP launch bindings are derived from the attested target and explicit RC
  endpoint, overriding stale environment values. Its module search path is fixed
  to the verified source checkout.
- **27 provider-probe tests:** source-derived schemas for all 12 UE routes, actual
  selected EngineWire descriptor shape, UAP two-channel proof and required native
  dependency/reflection checks, direct Claireon listener proof without Python,
  and fixed read-only Hayba identity with listener corroboration.
- A real Linux self-process start identity was observed. Windows process/listener
  code is source-reviewed and fixture-covered; it was **not executed on Windows**.
- **10 native outcome tests:** exact reviewed timeout/connection-loss and contained
  fault/quarantine envelopes, bounded parsing, no recursive actor-data scanning,
  preserved images and no assumption that an ordinary error proves rollback.
- Queue admission, serialized preparation/dispatch, cancellation before dispatch,
  late preparation, cancellation after dispatch, unknown-outcome fences and native
  queued lifecycle receipts.

### Optional specialists and source patches

- **25 specialist tests:** fixed recipes, safe argument encoding, nonce framing,
  missing/ambiguous/spilled/truncated output, live schema drift, compiler
  diagnostics/status, strict owned automation runs, capture/trace ownership,
  bounded profiling pages, typed material readback/persistence, no generic
  fallback and no implicit native cleanup on shutdown.
- A generated fixed Python wrapper was actually parsed/executed by CPython with
  injection-looking text supplied as data; it invoked one fake allowed callable.
- All three compatibility patches pass `git apply --check` against pristine pins.
  Exact patched temporary clones for Claireon, Hayba and UAP passed the actual
  `verifySourceSnapshot` implementation. The corresponding missing-patch states
  were rejected. Original upstream checkouts were not edited.
- UAP's patch was applied in memory to exact source files and selected patched
  methods were compiled into isolated Python namespaces with fake sockets/clients.
  Tests demonstrated one send after timeout, EOF, foreign reply or send failure;
  pre-send connection attempts remain allowed. They also checked exact project/PID
  selectors, actual `success` boolean handling, live binding markers and retention
  of the machine grant on uncertain Python failure.

For reproducing the complete run, provide `python3` and a pristine UAP checkout
via `NEXUS_UAP_SOURCE_ROOT` or the documented sibling location. Without that
snapshot the UAP isolated-method test skips explicitly; the recorded run had the
snapshot and no skipped tests. No full upstream Python modules were imported.

## Explicitly not established

No Unreal native plugin was compiled or run. No production Hayba TypeScript build,
real project asset, screenshot/rendering pipeline, gameplay run, Windows GUI,
complete native automation run or actual Insights capture was exercised.

A clean source checkout plus exact patch does not independently prove which
compiled DLL/ignored build product is loaded. Live marker checks do not replace
that deployment proof. Multi-plugin coexistence, engine-version compatibility,
physical input, native locks under real contention, complete workflow behavior,
disk persistence and undo remain live acceptance tasks.

The one-process queue is not a cross-process mutex or native editor epoch lock.
The reviewed UE micro path sends once after dispatch, but it can reconnect before
sending or in the background through a new project lockfile port. There remains
a race between per-call identity attestation and native execution. No universal
exactly-once, atomic targeting or rollback guarantee is claimed.

See `INTEGRATION_ACCEPTANCE.md` before describing these workflows as qualified in
an actual editor/project.

## Earlier source-curation baseline

The preceding commit `9db3b105956902b08606c4b6a8e1d9e45bf9e367` contained the
16-operation routing core and master draft. Its 47 tests were executed through
an in-memory loader while that session's filesystem was read-only; no transport
adapter was shipped then. The current implementation supersedes that execution
method and adds the real protocol tests described above.

That baseline rechecked all six reviewed pins against their default-branch HEADs
and verified 65 decision evidence entries, 114 immutable source links and seven
inventory hashes. This wiring change retains those pins and adds the reviewed
compatibility deltas; it does not silently update to a newer upstream revision.
