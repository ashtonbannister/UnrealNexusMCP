# Owned input holds: 2026-11-12

The UE-MCP owned-hold v1 patch adds a fixed local PIE hold with an exact world
path, PIE instance and local-player index. Nexus maps the caller's hold ID to
a random native ID and private owner token kept only in that gateway process.
The native handler injects one frame at a time and never takes over or stops
Unreal's shared continuous-injection slot. Other input sources on the same
action can still combine. The lease defaults to 300 seconds, accepts 1 to 3600
seconds, and expires while the editor is ticking. A frame already queued may
still execute after stop. PIE end clears native hold entries. Gateway restart
does not recover its private hold map; uncertain outcomes require external
reconciliation.

UE 5.8.4 built the patched native plugin and the TypeScript server passed its
schema and type checks. In a disposable project, a copied engine-template
InputAction was used in an owned PIE session. A direct native test established
an existing upstream continuous hold, started the new independent hold on the
same action, rejected a foreign owner token, updated and stopped the new hold,
then updated and stopped the original hold successfully. This coexistence
observation was made before the final player-input and expiry-receipt fixes.

After those fixes, the full Nexus coordinator started, updated and stopped one
owned hold in the exact disposable PIE world. The update and stop reported
737 and 1358 queued frames respectively; they do not prove that a gameplay
binding consumed or acted on those frames. The same owned PIE session stopped
and the editor accepted a clean shutdown. Lease expiry is supported by source
and fixture evidence but was not separately live-tested. No user project was
saved.

The staged server is
`D:/NexusTools/upstreams/ue-mcp-owned-hold-v1-wip`; the separately staged
plugin is `D:/NexusTools/staging/ue-mcp-owned-hold-v1-wip/UE_MCP_Bridge`.
The plugin source matched 582 non-build files in the build host. Its bridge
DLL SHA-256 is
`df7267c066cce8184aba702b0a13902c8d037c63d6e1d7a8986e29db44cc094b`.
The server uses an existing dependency junction. These are staged artifacts,
not an installation into Henday Heat; source hashes and live markers do not
independently attest loaded DLL or ignored server build bytes.

Observed coordinator identity and capability checks added seconds around each
operation in this run. That latency makes short-duration interactive input
impractical and remains a performance issue for the release goal.

On the same Windows host, three process-inspection samples took 2,016, 1,825,
and 1,789 ms with the former two-PowerShell/two-CIM implementation. The
single-CIM implementation bracketed by two Windows creation-time reads took
1,253, 1,069, and 1,113 ms in three samples. In a later disposable PIE run,
owned-hold start, update and stop through Nexus took 6,317, 6,593 and 6,259 ms
respectively; the same owned PIE session stopped cleanly. These are small
local samples, not a performance guarantee. Identity checking still dominates
short interactive operations and remains an open performance issue.

A reusable, fixed-purpose Windows inspection worker retains the same
creation-time checks around each CIM read and avoids a new PowerShell process
for each observation. In five local process-inspection samples, startup took
854 ms and subsequent checks took 423, 389, 474 and 387 ms. A disposable
coordinator run then measured hold start, update and stop at 3,381, 3,366 and
3,367 ms. The owned PIE session stopped and the inspector process was absent
after coordinator shutdown. These are local samples, not a latency guarantee;
the remaining delay still limits responsive control. The worker does not retry
failed inspections and its shutdown is reported if it cannot be confirmed.

The runtime now reuses the same fixed-purpose worker for the existing
all-listener ownership check. Three standalone listener samples were 1,492,
1,216 and 1,157 ms using separate PowerShell processes; the reusable worker
took 975 ms on its first listener check and 211 and 208 ms when warm. UE
action discovery and UAP reflection are each enclosed in fresh process and
listener brackets rather than repeating a redundant observation.

In a disposable PIE run with both changes, hold start, update and stop took
2,575, 2,542 and 2,832 ms; PIE start and stop took 10,635 and 3,749 ms.
The owned hold and PIE session stopped successfully and the inspection worker
was absent after coordinator shutdown. These individual timings include
different startup and discovery work and are not a benchmark guarantee.
