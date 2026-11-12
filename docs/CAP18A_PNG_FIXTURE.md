# CAP-18A bounded PNG fixture component

Status: **source/fixture only; not wired to an operation or qualified against Unreal**. The existing screenshot route still returns a filename. No native patch, compatibility marker, capability route, host-file reader, provider selection or allowlist change is supplied here. The unresolved file-ownership and framing requirements in [the image delivery design](CAP18A_IMAGE_CONTRACT.md) remain gates.

## Interface and limits

`validateCap18Png(buffer, {width, height, maxBytes, maxPixels, maxDimension})` in `src/cap18-png.mjs` checks a received Node `Buffer` against dimensions from an independently correlated receipt and explicitly supplied positive integer budgets. It accepts only non-interlaced, 8-bit RGB and RGBA PNGs; other valid PNG variants are refused. It checks the signature, basic chunk framing/order, chunk checksums, the receipt dimensions, scanline size, bounded zlib inflation, no compressed trailing bytes and valid filter-byte ranges. The returned dimensions are not native identity evidence.

A separate fixture-only `validateCap18MetadataFreePng` policy applies the same bounded validation and rejects every optional or ancillary PNG chunk. This is a conservative candidate, not a claim that native captures use that subset.

This component neither reconstructs pixels nor validates the full semantics of every ancillary chunk. It is not a complete PNG decoder or proof that an image is fresh or represents the requested client. Ancillary content can affect interpretation. A shipping adapter must either add a reviewed bounded decoder and strict ancillary policy or narrow its accepted format and validate all interpretation-relevant metadata; this fixture primitive alone is not sufficient for exposure. Upstream bytes must already be acquired from a secure, correlated and owned source with byte/frame limits applied before decoding.

## Pinned source and next work

At UE-MCP `62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d`, [the screenshot handler](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Editor/EditorHandlers.cpp#L2796-L2964) captures and encodes a PNG, then separately checks file existence and writes a path. It does not prove exclusive artifact ownership. The [native bridge framing](https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/BridgeWebSocket.h#L44-L62) limits inbound WebSocket messages to 64 MiB; that does not establish an end-to-end response budget. No broad conclusion about encoded response limits follows.

The `test/cap18-png.test.mjs` fixtures cover a supported image, receipt mismatch, limits, corruption, invalid framing, unsupported animation, oversized inflation, invalid scanline filters and trailing compressed bytes. They use generated local test data and do not exercise a live Unreal editor. Before implementation can proceed, choose and review an artifact transport, enforce native preallocation/capture budgets and exact target identity, establish framing and lifecycle limits, implement safe source-pinned native behavior and validate actual build/marker and live pixels. No route should be admitted merely because these fixtures pass.
