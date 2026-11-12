# Experimental direct PIE capture: 2026-11-12

Status: the first section records the native experiment; the later coordinator section records the direct route and its live baseline.

A fixed experimental UE-MCP handler requires an exact PIE world path and
instance plus a nonce. It selects one matching context, bounds its explicit
Slate rectangle to 4,194,304 pixels and 4,096 per axis before readback, rejects
clipped windows and incomplete or changed viewports, and returns a PNG in
memory. The 8 MiB encoded cap and other candidate limits are not yet a
complete end-to-end service budget.

The UE 5.8.4 disposable build succeeded. Its candidate bridge DLL SHA-256 was
`22644c394f1100f0e0414ea9a3c25984eb699abf89fca2256011e4abe0595a44`.
In an offscreen disposable editor, an owned viewport PIE session identified
`/Game/NexusGuardFixture/UEDPIE_0_TestMap.TestMap` (instance 0). The native
handler returned a nonce- and target-matching 1013 x 550 PNG of 11,366 bytes
(SHA-256 `ea0e971aee9e557c7262cb44b0158d3cb284f5c48e088a2418f6a909f1df171d`).
The probe checked the PNG signature, dimensions, length and canonical
base64. It did not visually inspect pixels, prove UI fidelity or exercise the
Nexus coordinator. PIE stop confirmed the same owned session ended and the
disposable editor then accepted a clean shutdown. No user project was saved.

An earlier offscreen attempt was refused before capture because the viewport
resource precheck did not account for `-RenderOffScreen`. The candidate was
corrected to match the upstream offscreen precheck, rebuilt and then produced
the image above. A separate initial probe failed before sending capture due to
a Windows module URL and its owned PIE session was stopped.

The WIP source is in `/tmp/nexus-ue-direct-image-wip`; a combined patch
against the pinned UE-MCP source is preserved in the disposable build host as
`nexus-direct-pie-capture-wip.patch`, SHA-256
`490a3bb62b750395288612b1deb5a6644b31a8f2fbb8547cdb7faadd00bfa55e`.
It applies cleanly to the pinned source, but is not a registered compatibility
patch and does not yet include a screenshot-specific bounded server transport,
schema generation, coordinator routing or loaded-artifact attestation. The
live probe used a bounded test-only WebSocket directly and is not evidence
that image delivery through Nexus works. Do not deploy this WIP.


## Coordinator candidate

The combined `ue-mcp-nexus-direct-pie-v1` patch adds a dedicated WebSocket
with 12 MiB maximum receive payload, no negotiated compression and no
automatic replay, and returns the PNG as an MCP image block. The coordinator
injects a nonce and checks the exact target, dimensions and PNG scanlines.
The candidate patch was applied and source-hash checked against the pinned
upstream. The native plugin and TypeScript server were rebuilt.

Through the candidate coordinator, a disposable offscreen owned PIE session
started, `play.worlds.list` returned the exact test world, and
`screenshot.pie` returned one validated 1013 x 550 PNG image block of 11,366
bytes with SHA-256
`ea0e971aee9e557c7262cb44b0158d3cb284f5c48e088a2418f6a909f1df171d`.
The stop receipt matched the owned session. This is a functional baseline,
not visual verification, independent loaded-byte attestation or proof for other
engine versions. The source and staged plugin remain separate from the user's
installed project. No screenshot file or user project content was saved.


After adding the post-capture editor identity recheck, the coordinator
repeated the same isolated workflow successfully. The final check returned
an 11,350-byte PNG (SHA-256
`b50174fa7e486899de5cfb76f474c28412b56f1870de04c5a44d508dc0cb32a5`)
at 1013 x 550 and stopped the matching owned PIE session. The editor then
accepted a clean shutdown. Source and live feature markers do not independently
attest the exact loaded DLL or the ignored server build output.

The staged plugin at
`D:/NexusTools/staging/ue-mcp-direct-pie-v1-wip/UE_MCP_Bridge` matched
582 non-build plugin source files against the build host. Its bridge DLL
SHA-256 is
`9d27063723006afca846b9394ef1597f5a492591d91f43b28711e3935f4366fd`.
The staged server checkout is
`D:/NexusTools/upstreams/ue-mcp-direct-pie-v1-wip` and links its existing
dependency directory. These artifacts are staged, not installed into the
user's Unreal project.
