# CAP-18A direct-byte compatibility patch plan

Status: **historical plan; direct image delivery is now routed in the candidate**. See [current evidence](qualification/UE_DIRECT_PIE_CAPTURE_WIP_20261112.md). This plan is source review and implementation sequencing for [CAP-18A](CAPABILITY_BACKLOG.md#cap-18a). The former `screenshot.pie` file route was replaced by direct image delivery. The local [direct-frame fixture](CAP18A_DIRECT_BYTE_FIXTURE.md) is a candidate parser only; its flat schema is not the pinned bridge's actual envelope, and its numeric ceilings are not approved production budgets.

## What the exact pin establishes

At UE-MCP `62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d`:

- The [registered native screenshot handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Editor/EditorHandlers.cpp#L427-L435) requires a filename and is explicitly a file-writing operation. A direct response must be a separate, fixed, versioned method rather than silently altering it.
- Its [PIE selection and capture](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Editor/EditorHandlers.cpp#L2811-L2931) accepts a world name or path, chooses the first matching capturable context, then calls `FSlateApplication::TakeScreenshot` into a `TArray<FColor>` before the returned `CaptureSize` is available. The reviewed caller does not enforce a pixel/byte cap before that allocation. A post-capture check alone cannot provide the required preallocation bound; a guessed widget or viewport size is not proof that Slate renders the same extent after scaling or concurrent changes.
- The [Node WebSocket bridge](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/bridge/bridge.ts#L688-L700) uses one connection for operations and creates `new WebSocket(url)` without an application `maxPayload` option. Its [message callback](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/bridge/bridge.ts#L1017-L1062) converts and parses the entire response before pending-ID lookup. A parser invoked later cannot bound the earlier frame allocation. Lowering a single socket-wide limit changes the behavior of every operation using it, not only screenshots.
- [BridgeServer](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/BridgeServer.cpp#L410-L430) wraps native data as a response result, and [server dispatch](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/dispatch/server-dispatch.ts#L386-L420) returns serialized tool data as MCP text. The flat fixture parser does not claim to parse or authenticate these envelopes.

Epic's [FSlateApplication API reference](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Slate/FSlateApplication) documents screenshot overloads with output arrays and an inner-area variant, but does not by itself establish the selected engine's capture allocation behavior or prove a requested area corresponds to the full composited PIE viewport. Engine version, source and actual rendered behavior remain unselected. The pinned [`ws` 8.22.0 reference](https://github.com/websockets/ws/blob/8.22.0/doc/ws.md) documents `maxPayload` and compression options; the [transport evidence](CAP18A_TRANSPORT_DECISION_EVIDENCE.md) distinguishes those from an end-to-end application limit.

## Installed UE 5.8.4 source findings

The installed editor source supplies an actionable capture primitive for a
version-specific implementation. In `Engine/Source/Runtime/Slate/Private/
Framework/Application/SlateApplication.cpp`, `TakeScreenshot` accepts a
nonempty inner widget rectangle, computes its window offset and queues that
specific rectangle. In `SlateRHIRenderer/Private/SlateRHIRenderer.cpp`, the
renderer clamps its maximum to the output extent before `ReadSurfaceData`.
An explicit, checked rectangle can therefore bound the requested pixel
readback independently of the widget's later size. This finding does not
establish that the image is the complete correctly positioned viewport:
`OnPreScreenshot` runs between geometry calculation and drawing, the window
can change, and a clamped capture may be partial. A production handler must
check positive dimensions and multiplication before capture, reject nonexact
readback, correlate the exact unique PIE context and revalidate the viewport
geometry and lifetime; a mismatch must not be delivered as a full frame.

The existing upstream handler already has a persistent Slate sink and cleanup
for a skipped draw. Its file-writing helper cannot be reused unchanged because
it writes before returning and uses the unbounded full-widget overload.
The current Nexus UE outcome inspector also caps text at 2 MiB, while its
stdio client accepts up to 64 MiB: a native JSON/base64 image larger than
the former would be treated as an uncertain response even if received. A new
fixed image path must account for both boundaries and preserve normal outcome
inspection; raising a global limit alone does not bound websocket reassembly,
PNG encoding or memory copies. Version 5.8.4 engine source findings are not
proof for another engine version or a loaded build.

## Patch slices and acceptance prerequisites

1. **Bounded capture primitive:** for the selected engine version, identify and inspect a native capture API whose allocation can be bounded *before* capture and still produces the full specified viewport with its intended Slate/UMG layer. Establish resize, scale, client teardown and race behavior. If no such primitive exists, use a separately reviewed bounded native rendering/readback implementation or refuse; do not call the current unbounded overload and treat a later length check as allocation protection.
2. **Fixed unique target:** require an integer PIE instance and exact full `UWorld` path; scan contexts without first-match fallback, refuse zero or multiple matching contexts and invalid/missing viewport. Bind a host-generated one-shot nonce to the call, return actual world path and instance, and recheck host project/editor process epoch across the dispatch. An echoed epoch/nonce is correlation, not independent native identity proof or an authenticated principal. Crossed or stale receipts must fence; no other world or current-view fallback.
3. **Native response and marker:** register a new explicit versioned handler with a reviewed fixed public schema and no filename or arbitrary file/Python mechanism. Capture once, limit dimensions, pixels, encoded PNG and JSON envelope with checked arithmetic and bounded concurrency, then encode bytes directly. Preserve warnings, error and partial context. Add a capability marker whose live behavior is independently checked against exact source/patch and loaded module evidence. There is no safe source-derived production size cap yet.
4. **Receive and MCP boundary:** choose whether one scoped connection can enforce a screenshot-specific `ws` maxPayload without changing unrelated enabled operations, or measure and document a safe socket-wide bound for all selected operations. Disable or explicitly bound negotiated compression. Check every earlier reassembly/decompression/UTF-8/JSON allocation, the native response wrapper, base64 expansion (`4 * ceil(n / 3)`), adapter decode, PNG validation and complete MCP output. Preserve the original native receipt and bounded warnings while delivering exactly one image block. The fixture copies parsed base64 into both receipt and image and does not retain raw JSON; real memory and receipt ownership must be designed explicitly.
5. **Qualification and migration:** add exact compatibility manifests, capability probes, strict input/output validation, guidance, tests for source patch application, native schema and generated assets, and rollback/reconciliation instructions. Exercise connection loss, duplicate keys/frames, stale or crossed nonce, duplicate world, concurrent clients and decompression limits without automatic retry. Build and run against the selected editor and verify real pixel output, actual loaded artifact, safety markers, world identity and failure cleanup under LIVE-03. Only then consider lifting or replacing the existing file-route hold under an explicitly reviewed migration; never silently fall back to that file route.

## Why no production route is claimed yet

Direct bytes remove the file-ownership problem, but they do not by themselves bound capture allocation, select a unique PIE world, or bound the upstream socket before JSON parsing. An experimental UE 5.8.4 native implementation now uses the bounded rectangle and returned a PNG in a disposable PIE session; see [the live note](qualification/UE_DIRECT_PIE_CAPTURE_WIP_20261112.md). The remaining transport, real-world visual fidelity, production pixel/frame/concurrency budgets and socket isolation are not established. An apply-clean, uncompiled patch written with guessed capture sizing or guessed engine APIs would not satisfy the requested safe contract and could weaken other operations. The fixture parser demonstrates bounded parsing *after* receipt only; it is neither a wire-compatible native/server patch nor evidence of native execution. These are concrete engineering gates, not a claim that a direct-byte implementation is impossible.
