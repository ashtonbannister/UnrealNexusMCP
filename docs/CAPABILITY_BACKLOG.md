# Capability expansion backlog

Part of the [master roadmap](../MASTER_ROADMAP.md). Baseline: `c543959`. All entries are **planned work**; no new canonical ID or winner is established by this document.

This register contains 20 capability families. CAP-18 is deliberately split into independently tracked CAP-18A (existing PIE image delivery) and CAP-18B (additional observation/input modes), so the essential image workflow does not wait for optional modes.

## Contract and completion rules

Priority and task states follow the master roadmap. Hard dependencies below govern integration; source investigation can proceed in parallel. An unavailable native environment blocks native evidence, not unrelated source/fixture work.

Every implementation child contract must record: canonical ID proposal, precise target/world/client, effect and save scope, public native surface, candidate comparisons, immutable pin, schema/fixed selectors, completion/readback, failures/partial state, ownership/recovery, applicable patch/license, fixture tests, native cases and workflow guidance. Exact route selection remains in [operations.json](../catalog/operations.json); avoid creating a second executable catalog here.

For implementation tasks, “done” includes source review, fixtures, applicable native evidence and updated guidance for the admitted contracts. If only implementation/fixtures are complete, record that evidence while native qualification remains pending. CAP-19 and CAP-20 explicitly deliver discovery/planning artifacts and may finish without claiming their domains are implemented.

A preserved variant is not automatically inferior. Keep memory-only versus persisted, editor versus PIE, explicit client versus current view, different algorithms and partial versus proven atomic operations separate. Update the family's child-contract ledger as variants are admitted, rejected or deferred; one successful demo does not close a family.

## Current unexposed decision coverage

| Existing decision | State in decision register | Owning backlog entry |
| --- | --- | --- |
| actor-transform | conditional | [CAP-03](#cap-03) |
| asset-import | conditional | [CAP-04](#cap-04) |
| asset-rename | conditional | [CAP-05](#cap-05) |
| control-rig-create | conditional | [CAP-12](#cap-12) |
| blueprint-connections | preserve | [CAP-08](#cap-08) |
| sequencer | preserve | [CAP-13](#cap-13) |
| foliage-landscape-geometry | preserve | [CAP-14](#cap-14), [CAP-15](#cap-15), [CAP-16](#cap-16) |
| coordination | preserve | [CAP-02](#cap-02) |
| graph-widget-atomicity | hold | [CAP-11](#cap-11) |
| asset-deletion | hold | [CAP-06](#cap-06) |

## Execution priorities

First complete the gateway reliability fixes, while CAP-20 inventories the agreed scope. Then prioritize CAP-01 and CAP-18A, followed by CAP-02. Those close discovery, graph-read, session and image prerequisites missing from otherwise useful current workflows.

Common authoring follows under CAP-03–05 and CAP-07–10. PCG expansion under CAP-17 can progress independently once graph reads exist. Later domains remain optional. Source review of a held contract is allowed; exposing it still requires its exact qualification.

## Task register

### CAP-01

**Discovery and read prerequisites** — Priority: **Now**; state: **blocked**; owner role: **Catalog and read-adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02). Additional scope-specific prerequisites are stated below.

**Candidate state:** No new winner selected. Compare bounded asset search/list, editor/PIE world enumeration, graph/node/pin inspection and reflected property/type discovery at the pinned revisions.

Define explicit stable paths/GUIDs, world/client identity, pagination and truncation. Close the graph-read prerequisite currently obtained externally before pcg.graph.connect.persisted, and enable exact selection before later authoring.

**Done when:** An agent can discover an exact actor/asset and inspect PCG node/pin identities through fixed canonical reads. Ambiguous labels, stale identities and unsupported worlds refuse; large results stay bounded. Native read evidence and source comparison identify every admitted route.

**Source basis:** [world](audit/world-assets.md); [graphs](audit/graphs-materials-ui.md); [specialized](audit/specialized.md). Preserve the pinned upstream evidence in those records.

### CAP-02

**Native sessions and ownership** — Priority: **Next**; state: **blocked**; owner role: **Session adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** Existing coordination decision: preserve. Native scheduling, asset leases, Claireon edit sessions and UAP machine/input holds have different scopes.

Compare explicit session open/read/close contracts, ownership, epoch invalidation and whether close persists. Do not broaden shutdown into automatic native cleanup. Session consumers must identify whether an existing external session or a Nexus-created session is required.

**Done when:** A workflow creates an owned session, compiles memory-only, and closes or retains it under an explicit persistence contract. Foreign handles, two gateway clients, restart and interrupted cleanup are tested. Cooperative labels are not represented as authenticated principals or cross-process exclusion.

**Source basis:** [coordination](audit/coordination.md); [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-03

**Exact actor transforms, spawning and property edits** — Priority: **Next**; state: **blocked**; owner role: **World authoring maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** actor-transform is conditional: EngineWire is source-preferred for observed-value comparison; UE explicit-PIE movement remains a distinct variant. Spawn and general property writes have no selected family winner.

Start with exact-path, explicit-world transform and tolerance-based readback. Compare spawn and typed property mutation separately, including class/type validation, collision policy, dirty state and persistence.

**Done when:** Wrong/repeated labels, wrong worlds and unavailable PIE instances refuse before mutation. Verify actual transform/property values and spawned identity; retain partial outcomes and failures. A level edit is explicitly saved and reloaded. Each added contract has its own comparison; no PIE-first/first-label fallback.

**Source basis:** [world](audit/world-assets.md). Preserve the pinned upstream evidence in those records.

### CAP-04

**Scoped asset imports** — Priority: **Next**; state: **blocked**; owner role: **Asset workflow maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** asset-import is conditional: UE generic import is the scoped candidate. Hayba pinned-handle Windows import and skeletal/Interchange variants remain distinct.

Specify factory/asset class, trusted source and exact destination. Fix replacement policy, inspect every produced object and persistence result, and test collision behavior rather than trusting replaceExisting=false alone.

**Done when:** Existing destinations, changing source paths, invalid factories, read-only packages and partial imports yield accurate receipts. Verify actual asset identity, saved files and reload. Each specialized pipeline is independently accepted or explicitly deferred; no security-sandbox claim comes from a flag.

**Source basis:** [world](audit/world-assets.md). Preserve the pinned upstream evidence in those records.

### CAP-05

**Rename, move and duplication** — Priority: **Next**; state: **blocked**; owner role: **Asset lifecycle maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** asset-rename is conditional with EngineWire ordinary rename as candidate. World Partition migration, redirector cleanup and duplication require separate comparison.

Implement the ordinary rename contract first; separately inventory move, duplicate and cleanup effects. Preflight exact source/destination and conflicts. Preserve reference, external-package and persistence distinctions.

**Done when:** Registry, references, disk paths and reload show the intended rename/duplication only. Collision and partial failure cases retain exact outcomes. Unsupported World Partition or broad cleanup refuses instead of selecting a more expansive helper.

**Source basis:** [world](audit/world-assets.md); [decisions](../catalog/decisions.json). Preserve the pinned upstream evidence in those records.

### CAP-06

**Exact deletion and cleanup** — Priority: **Later**; state: **deferred**; owner role: **Asset lifecycle maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** asset-deletion is held; no universal winner. Actor deletion and reference-aware asset deletion are separate. Existing candidates have targeting, return-value or aggregate-result gaps.

Reopen after exact discovery and relevant persistence/recovery fixtures exist. Compare actor deletion, referenced assets, registry-orphan files, redirectors and cleanup independently. Broad/force deletion is not an ordinary substitute.

**Done when:** For each admitted contract, prove exact outcomes across memory, registry, references and disk, including successful item A followed by failed item B. Preserve partial/unknown states and source-backed guards. Unsupported contracts stay held with a reason; no broad safe-delete claim.

**Source basis:** [world](audit/world-assets.md). Preserve the pinned upstream evidence in those records.

### CAP-07

**Blueprint creation and structural authoring** — Priority: **Next**; state: **blocked**; owner role: **Blueprint adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** Compare Claireon, UE and EngineWire per operation. Variable/container/component types and conflict/persistence behavior are preserved pending narrower review.

Define asset creation, node creation/removal, variable/type/container, component/attachment and typed property contracts. Session contracts additionally require CAP-02. Surface reinstancing and undo-buffer resets.

**Done when:** Complete create/edit -> compile -> explicit save -> reopen/readback through canonical routes. Test inherited components, conflicts, unsupported types, reconstruction and failure after a prior edit. The family remains open until all admitted child contracts and deferred variants are accounted for.

**Source basis:** [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-08

**Blueprint connections by exact semantics** — Priority: **Next**; state: **blocked**; owner role: **Graph adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01), [CAP-07](#cap-07). Additional scope-specific prerequisites are stated below.

**Candidate state:** blueprint-connections is preserved: Claireon session K2, UE actual-schema persisted edits and EngineWire conversion-aware edits are complementary.

Split contracts by graph schema, pin direction/identity, break policy, conversion, compilation and save effects. Session variants require CAP-02. No single connect-pins route may silently switch semantics.

**Done when:** Test same-name input/output pins, ambiguous nodes, existing edges, reconstruction and failed conversion. Report inserted nodes and replaced links, read back the actual connection, and verify claimed persistence. Select a winner within each contract and preserve the others where useful.

**Source basis:** [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-09

**Material creation and graph authoring** — Priority: **Next**; state: **blocked**; owner role: **Material adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** Strict persisted instance parameters already exist. Master-material graphs, dynamic/layered parameters, parents, static switches and unsaved variants need separate comparison.

Define granular create/node/connect/value contracts and their compile/save effects. Session variants require CAP-02. Do not expose a native boolean branch through a mismatched public schema. Atomic batch claims require CAP-11.

**Done when:** Verify actual graph/value readback, compiler diagnostics, dirty state and requested persistence, including failed edits after earlier changes. Complete a material-authoring scenario with explicit save/reload. Keep existing strict parameter routes intact and newly admitted variants distinct.

**Source basis:** [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-10

**UMG inspection and granular authoring** — Priority: **Next**; state: **blocked**; owner role: **UI adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01), [CAP-07](#cap-07). Additional scope-specific prerequisites are stated below.

**Candidate state:** Claireon declarative widget paths are reviewed with partial-result and property/compile/save caveats; there is no qualified atomic default.

Separate widget asset/tree reads, subtree extraction, granular create/reparent/property edits and live-widget interaction. Session variants require CAP-02. Do not silently accept ignored slot/property writes.

**Done when:** Exact widget identity, failed properties and per-item effects survive. Test invalid types, slot/property errors and compile/save failure, then verify the intended tree and live appearance where claimed. Keep runtime interaction distinct from editing an asset; atomicity remains CAP-11.

**Source basis:** [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-11

**Declarative batches and atomicity evidence** — Priority: **Later**; state: **deferred**; owner role: **Graph failure-path reviewer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** graph-widget-atomicity is held. Transaction cancellation and cleanup of newly created objects do not establish restoration.

Reopen separately for a family once its granular contracts (CAP-07/08, CAP-09 or CAP-10 as relevant) are verified. Unrelated families are not prerequisites. Compare valid edit A followed by failed B after deletion/disconnection.

**Done when:** Compare graph/tree, registry, dirty flags, disk bytes and undo history after property, compile and save failures. Either prove restoration for the exact atomic claim or expose an honestly partial contract with completed/failed items and recovery. Record held/rejected claims; never relabel partial work atomic.

**Source basis:** [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-12

**Control Rig and animation** — Priority: **Later**; state: **blocked**; owner role: **Animation adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** control-rig-create is conditional: UE source-backed nonmodular persisted creation is candidate. Blank/modular/unsaved/older-engine variants are distinct. Broader animation/retargeting needs further review.

Start with exactly one mesh/skeleton source, no overwrite, checked relocation and save. Add animation edit, retarget, session and bake contracts only after separate comparison; session variants require CAP-02.

**Done when:** Verify skeleton, hierarchy, preview mesh, solve directions and an unchanged-animation round trip. Test source conflicts, failed relocation/save and reload. Do not replace version-gated animation workflows with raw bone keys or call asset creation validated animation.

**Source basis:** [specialized](audit/specialized.md). Preserve the pinned upstream evidence in those records.

### CAP-13

**Sequencer and channel editing** — Priority: **Later**; state: **blocked**; owner role: **Sequencer adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** sequencer is preserved. EngineWire is source-preferred for track/section creation; UE for exact existing-channel edits. Hayba convenience key insertion is excluded as the checked-write default.

Separate timeline/track creation from exact key writes, conversions and persistence. Preserve custom tangents, active ranges, unkeyed defaults and disclosed inverse limits.

**Done when:** Test fractional frame rates, same-frame replacement, range expansion, rotation/scale defaults and partial batches. Actual key readback and reload confirm claimed changes. No success from zero added keys, no inferred save from dirty state, and no lossless-undo claim for a lossy inverse.

**Source basis:** [specialized](audit/specialized.md). Preserve the pinned upstream evidence in those records.

### CAP-14

**Foliage and scatter algorithms** — Priority: **Later**; state: **blocked**; owner role: **Procedural world maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** foliage-landscape-geometry is preserved. UE native foliage-type placement is source-preferred for that scope; seeded disc/box/point/jittered-grid algorithms remain distinct.

Specify distribution, seed, projection, type rules and instance/cell identity. Compare alternatives only within the same algorithm and persistence contract.

**Done when:** Verify placed/skipped counts and reasons, transforms, World Partition rehoming, cross-cell persistence and bounded inverses. Test explicit no-ground/no-rules placement and existing instances. Preserve unique distributions rather than deleting them as same-name duplicates.

**Source basis:** [specialized](audit/specialized.md); [world](audit/world-assets.md). Preserve the pinned upstream evidence in those records.

### CAP-15

**Landscape authoring** — Priority: **Later**; state: **blocked**; owner role: **Landscape adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** foliage-landscape-geometry is preserved. UE named-edit-layer sculpt is source-preferred for that scope; EngineWire linear falloff, supplied-Z flatten and delayed flush differ.

Define landscape/layer, units, brush profile, flatten reference, affected region, flush and save behavior per contract.

**Done when:** Read height data and bounds before/after edit, save and reload. Test invalid layers, interrupted edits and save failure. Document the actual prior-height restoration limits and preserve distinct falloff/reference algorithms.

**Source basis:** [specialized](audit/specialized.md); [world](audit/world-assets.md). Preserve the pinned upstream evidence in those records.

### CAP-16

**Geometry and modelling** — Priority: **Later**; state: **blocked**; owner role: **Geometry adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** foliage-landscape-geometry is preserved. StaticMesh asset CSG, live DynamicMesh actor booleans and custom topology algorithms operate on different representations.

Compare each representation/algorithm, exact target and existing-object treatment separately. No generic modelling or reflection escape.

**Done when:** Verify topology, material/collision implications, dirty/save state and reload. Exercise degenerate inputs, partial failures and existing-object cases. Admit only independently reviewed contracts, retaining algorithm differences and actual inverse limits.

**Source basis:** [specialized](audit/specialized.md). Preserve the pinned upstream evidence in those records.

### CAP-17

**PCG authoring beyond edge and run operations** — Priority: **Next**; state: **blocked**; owner role: **PCG adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** Existing persisted edge and exact-run generation choices remain selected. Session and optionally unsaved edits are preserved; creation, nodes and parameters need scoped comparison.

Add graph/node/property/parameter contracts sufficient for agent-owned authoring. Session variants require CAP-02. Preserve parameter GUIDs, pin compatibility and reconstruction semantics.

**Done when:** Create/edit a graph, verify node/pin identity, persist intentionally, generate and verify the exact actor/component/run. Test multiple components, valid empty output, stale indices and existing edges. Do not treat an ISM-count heuristic as general generation completion.

**Source basis:** [specialized](audit/specialized.md); [graphs](audit/graphs-materials-ui.md). Preserve the pinned upstream evidence in those records.

### CAP-18A

**Deliver exact PIE capture as an inspectable image** — Priority: **Now**; state: **blocked**; owner role: **Observation adapter maintainer**; assignee: **unassigned**.

**Dependencies:** [FIX-01](../MASTER_ROADMAP.md#fix-01), [FIX-02](../MASTER_ROADMAP.md#fix-02). Additional scope-specific prerequisites are stated below.

**Candidate state:** screenshot.pie already selects UE-MCP and returns a host PNG path. A bounded, authorized image-delivery contract is additional work; do not replace it with EngineWire's different current-view semantics.

Define fresh-file-to-image delivery tied to the selected project/capture, safe basename/path, actual write receipt, dimensions and payload bounds. It may be an explicit resource or canonical follow-up after review; no arbitrary host-file reader.

**Done when:** The agent receives real image bytes for the requested PIE client and can inspect them. Test stale/pre-existing files, traversal, mismatched target, failed write and oversize payloads while preserving the original receipt. Native promotion requires LIVE-03. Source/fixture work can precede that live lane.

**Source basis:** [testing](audit/testing-observation.md). Preserve the pinned upstream evidence in those records.

### CAP-18B

**Additional observation and physical/UI input** — Priority: **Later**; state: **deferred**; owner role: **Observation and input curator**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** Full-window, camera/isolated rendering, raw keys, Slate/UMG interaction, relay and XR are distinct from current viewport capture and Enhanced Input. No universal new winner selected.

Reopen after the relevant native observation/input baseline is qualified. Compare each mode with explicit target, completion correlation, authority and owned cleanup; do not block CAP-18A on these modes.

**Done when:** Each admitted mode has real pixels or observable input effects, correlated completion and interruption recovery. Relay/XR/physical-input claims are independently tested; Enhanced Input alone does not qualify them. Unsupported modes stay explicitly deferred.

**Source basis:** [testing](audit/testing-observation.md); [coordination](audit/coordination.md). Preserve the pinned upstream evidence in those records.

### CAP-19

**Vehicle, audio and effects candidate discovery** — Priority: **Later**; state: **blocked**; owner role: **Specialist capability curator**; assignee: **unassigned**.

**Dependencies:** [CAP-01](#cap-01). Additional scope-specific prerequisites are stated below.

**Candidate state:** EngineWire vehicle configuration is only a conditional source candidate with reflective-write gaps. Audio distinctions are identified without a family winner. Niagara/effects authoring is unreviewed in the bounded audit.

This task delivers source-backed intake contracts and decisions, not implemented domain coverage. Separate vehicle setup/readback from calibrated simulation; audio acknowledgment from measured output; and effect asset authoring from actual runtime behavior.

**Done when:** For each domain produce exact candidate/API/schema evidence, target and persistence contract, plugin requirements, domain fixtures, priorities and separately owned implementation/qualification child tasks. Unknowns remain unknown. Vehicle proposals require property readback and PIE validation; audio distinguishes world/position/managed playback; effects require compile/runtime evidence before future promotion.

**Source basis:** [specialized](audit/specialized.md); [inventory](audit/inventory.md). Preserve the pinned upstream evidence in those records.

### CAP-20

**Reconcile the complete target capability inventory** — Priority: **Now**; state: **ready**; owner role: **Capability inventory curator**; assignee: **unassigned**.

**Dependencies:** None. Additional scope-specific prerequisites are stated below.

**Candidate state:** No winner implied for unreviewed families. Existing static inventories measure different layers and overlap; dynamic registration still needs live corroboration.

Produce catalog/capability-coverage.json (planned artifact) from auditable pinned-source extraction without importing upstream modules for enumeration. Map public wrappers, native operations and distinct semantics; include project/level lifecycle and any other discovered domains. Define intended project scope and record exclusions.

**Done when:** Every enumerated entry has a disposition: implemented canonical ID, planned contract/task, useful variant, rejected equivalent, blocked or deliberate defer with reason. Every in-scope semantic function has an owner task and candidate/review state. Residual dynamic/unknown coverage is explicit. Cross-check all ten unexposed decision groups below and identify missing families; never sum overlapping tool counts or claim exhaustive equivalence from names.

**Source basis:** [inventory](audit/inventory.md); [decisions](../catalog/decisions.json). Preserve the pinned upstream evidence in those records.


## Coverage discipline

CAP-20 is responsible for finding remaining in-scope families rather than assuming these twenty exhaust all six upstreams. New families receive stable task IDs and the same evidence gates. Record why a capability is out of scope, duplicated, preserved, blocked or intentionally deferred.

The old audit reports are historical source-review records. Their introductory snapshot notes explain references to adapters that have since been implemented. Use the current catalog/selection/guidance for availability, while retaining immutable upstream evidence for candidate comparisons.
