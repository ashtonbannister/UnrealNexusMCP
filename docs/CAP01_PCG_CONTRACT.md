# CAP-01: PCG graph inspection and stale-identity proposal

Status: **source investigation and proposed contract only**. No additional
canonical operation, provider winner, compatibility patch, or live capability is
admitted by this document. Nexus baseline `ac4640472d62ef40c5ef3b00a156603889f60e92`;
source evidence is pinned as linked below. See [CAP-01](CAPABILITY_BACKLOG.md#cap-01)
and [prerequisite research](CAP_PREREQUISITES_RESEARCH.md). FIX-01 and FIX-02
remain integration dependencies; native acceptance requires the selected editor,
project and deployed builds.

## Source comparison and scope decision

- UE-MCP's pinned [read graph handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/PCG/PCGHandlers.cpp#L940-L1038)
  loads the requested asset, returns ordinary node names/titles, special input/output
  node pins, and existing edges. It does not enumerate the ordinary nodes' pins,
  and the reviewed output has neither a graph revision nor pagination. This is not
  sufficient to find unconnected pins or detect a changed graph. The associated
  [public tool](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/tools/pcg.ts#L10-L19)
  advertises read and node-settings actions, not a revision-checked graph snapshot.
- The existing selected UE [connect handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/PCG/PCGHandlers.cpp#L1144-L1208)
  resolves names and optional pin labels against the graph at execution time.
  The Nexus schema requires pin labels, but the pinned native handler has no
  snapshot precondition. A fresh read followed by this call therefore cannot
  alone prevent a direct client or editor change from replacing the intended node
  between calls. Existing `pcg.graph.connect.persisted` is unchanged here;
  its name-based source evidence is not a guarantee of stale-identity refusal.
- Pinned Hayba's [native graph exporter](https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/unreal/HaybaMCPToolkit/Source/HaybaMCPToolkit/Private/handlers/HaybaMCPLegacyHandler.cpp#L471-L590)
  labels ordinary nodes using their current array index (`node_###`), serializes
  editable properties, and maps edges through those ordinary nodes. Such IDs are
  not stable across graph reconstruction and the map does not establish coverage
  of implicit graph I/O nodes. Its pinned [Python node resolver](https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/tools/pcg/pcg-primitives.ts#L6-L48)
  accepts indexes and selects the first exact label match, so duplicate labels
  cannot satisfy this contract. Neither comparison establishes a native runtime
  result or an exhaustive survey of every upstream surface.

A fixed Nexus wrapper around either reviewed stock read would preserve an
observation but would not fulfill the backlog's complete pin discovery,
boundedness and stale-identity requirements. Do not advertise it as the CAP-01
prerequisite. Compare other pinned public surfaces before selecting a provider.

## Candidate native contract for implementation review

The following is a proposed interface, not a claim that an engine version exposes
all needed IDs or that a provider already implements it.

1. A fixed native read accepts one exact PCGGraph object path and explicit bounded
   output limits. It returns the resolved object/package identity, editor epoch,
   schema version and a snapshot token. It describes ordinary and implicit I/O
   nodes, each exposed node identity, and every input/output pin's identity,
   label, direction and supported type information needed by a later connection.
   Include edges, and report measured node/pin/edge counts and explicit completeness.
   Duplicate or missing identities must refuse rather than silently select a first
   match. Loading an asset is a native side effect even though graph editing is not
   performed; retain the existing target and source attestation gates.
2. Define the snapshot token from a deterministic, versioned encoding of the
   resolved graph identity and all relevant node identities, pin identities/types,
   and edges. Use only identity APIs verified for each supported Unreal version;
   if stable IDs cannot be established, the contract must refuse rather than turn
   a name or position into a durable identity. Bind tokens to the editor epoch and
   schema version, and invalidate on restart or identity ambiguity. A hash is a
   stale-state check, not authentication or an editor-wide lock.
3. Count and enforce limits during native traversal and serialization; abort with
   an explicit incomplete/oversize result before exceeding a reviewed bound. If a
   complete graph cannot be returned, do not issue a token that authorizes a
   mutation based on that partial result. Cursor pagination, if later needed,
   requires an immutable snapshot or revalidation per page; it must not combine
   pages from different graph states.
4. A separate native conditional connect accepts the token and exact source and
   target node/pin identities. In one game-thread operation, resolve the same
   graph, recompute and compare the complete token, validate uniqueness, direction,
   compatibility and write authority, then perform the mutation without yielding
   between check and use. Review re-entrant editor callbacks and competing native
   clients rather than assuming a process-local gateway queue provides isolation.
   A changed graph or unsupported token refuses before mutation. Do not retrofit a
   fake precondition into an adapter that calls the unmodified connect handler.
5. Preserve existing-edge versus newly-created distinction, verified edge and
   checked save receipts, warnings and partial failures. A failed verification or
   save must not be represented as rollback. Post-dispatch loss or timeout remains
   an unknown outcome and fences further work; no automatic retry or alternate
   provider. Maintain versioned source hash/patch and live marker checks and keep
   loaded binary provenance separate from source proof.

## Required evidence before admission

- Compare the relevant pinned candidates, licenses, public schemas and supported
  engine APIs, including ordinary/implicit nodes and all pin types. Record why a
  reviewed winner is appropriate; check any source patch as an exact compatibility
  artifact rather than changing the lock silently.
- Fixture-test exact target and pin direction, duplicate labels/identities, empty
  graphs, implicit pins and unconnected pins. Exercise bounds, malformed or
  incomplete results, snapshot version/epoch mismatch and token tampering.
- Demonstrate on the native game thread that removal/recreation or replacement of
  a node, pin changes, graph reordering, edits by another client, editor restart and
  changes between read and write lead to either correct identity-preserving behavior
  or a refusal before mutation. Test no-op existing edge, verification failure,
  save failure and uncertain transport without claiming rollback.
- Supply exact engine/build/project/patch markers, fixture code, observed receipts,
  persisted readback and ownership/cleanup evidence. Until native evidence exists,
  this proposal remains unqualified and cannot close CAP-01.
