# Validation record

Date: 2026-10-26.

## Executed

- Source/default-branch HEAD recheck for all six upstream repositories:
  all six reviewed pins still matched the current default-branch HEAD.
- Source-evidence check: all 65 decision-register evidence entries and 114 unique
  immutable source links across the catalogue/reports resolved to paths and valid
  line ranges in the pinned local checkouts. Seven inventory file hashes matched.
- All Markdown relative file links resolved within the intended commit tree.
- Catalogue validation: 16 canonical operations, 23 decision groups, nine selected
  groups, 25 excluded competing-default entries, six immutable source pins.
- Node.js v24.22.1 execution of the repository's unit-test sources using simulated
  backend factories: **47 tests passed, zero failed or skipped**.
- Offline CLI smoke: exact-asset-save plan produced the fixed UE micro envelope
  with dispatched=false and no backend startup.

## Execution method

The workspace denied file writes. The final source/catalogue/test contents were
therefore loaded directly into Node's module system in memory, without replacing
the implementation modules with mocks. The backend transports were intentional
test doubles. No dependency installation was required.

This was not a successful filesystem invocation of `npm run check` in a completed
checkout. The committed test command is `npm run check` and is intended to run on
a normal writable checkout with Node 22+. The in-memory run exercised the same
module and test source contents; it did not test Git checkout/file packaging.

## Coverage

- One selected source route per canonical contract; no duplicate route aliases.
- Unsupported/raw/Python/adapter-required operations are not callable.
- Strict input subset, nonfinite values, fixed-selector overrides and extra fields.
- Exact save scope; explicit world/player/run identities.
- All-off defaults, per-pack selection and lazy per-provider startup/reuse.
- Disabled capabilities, write gates and missing editor identity refuse before load.
- Source-pin/editor/capability mismatches refuse before tool dispatch.
- Preserved image blocks, warnings, structured fields and metadata.
- UAP JSON errors, confirmed lifecycle conditions and PCG exact generated-run state.
- Serialized work, queue admission limit, uncertain timeout/transport fences.
- No automatic retry or alternate-provider fallback.
- Request argument snapshotting and owned-backend closure.

## Not executed / not established

No native plugin was compiled. No real Unreal editor, remote MCP server, Windows
UI automation, rendering pipeline or live asset was exercised. No actual backend
transport adapter is shipped in this change. Multi-plugin coexistence, native
locks, engine compatibility, real source-install attestation, end-to-end undo,
persistent files and gameplay behavior remain unqualified.

This record does not turn source-preferred candidates into production guarantees.
Follow `INTEGRATION_ACCEPTANCE.md` before enabling real writes.

## Independent regression review

A second reviewer reproduced three defects in the intermediate core: pre-dispatch
refusals incorrectly fenced the editor, native queued PIE timeouts did not fence
it, and cloning arguments could invoke accessors before validation. All three
were corrected and covered by the final passing tests. Preparation and dispatch
are distinct phases; outstanding native lifecycle work preserves its result and
fences subsequent calls; original inputs and array descriptors are validated
before cloning.

Source inspection also showed that EngineWire's editor_viewport mode can select
PIE. The canonical operation was renamed screenshot.viewport.current and its
guidance preserves the actual view/shader-wait receipt.

Final test run: 47 passed, 0 failed, 0 skipped. Catalogue validation: 16 routes,
23 decision groups, 9 selected groups, 25 competing-default exclusions and 6
source pins. CLI plan smoke test passed without loading or dispatching a backend.

The independent reviewer reran focused probes on the corrected core and confirmed
all three original findings fixed, including the late-preparation race. No new
blocking regression was found within that focused review; this is not a claim of
exhaustive correctness.
