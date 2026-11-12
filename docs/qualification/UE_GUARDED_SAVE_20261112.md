# Guarded current-level save: 2026-11-12

The UE-MCP guarded-save v2 patch extends the pinned da2c0fb source and includes
the pagination guard. Nexus requires exact patched source and both live feature
markers. The current-level read reports the editor level package; the save
requires that exact package and rejects dirty empty external packages before
mutation. The guarded route does not call the external-package deletion helper.
Results are checked for the guard, target and coherent package receipts.

In a disposable UE 5.8.4 build host, Nexus inspected
`/Game/NexusGuardFixture/TestMap`, refused a different expected package with
`mutationStarted=false`, and the test map hash remained unchanged. A single
forced save of the correct test map returned one saved package and zero
deletions. That build emitted an incorrect unread-parameter warning; the
parameter tracking was corrected and rebuilt. A subsequent non-forced call on
the clean disposable map reported one skipped package, no deletions and no
unread-parameter warning. The force-save observation precedes that tracking
correction. The user's Henday Heat project was not used or saved.

Dirty external-package refusal, world-partition behavior and partial failures
have source and fixture evidence only, not individual live qualification.
Source hashes and live markers are not independent attestation of loaded DLL
bytes; deployment still needs loaded-artifact provenance. An uncertain
post-dispatch result requires external reconciliation, not a retry.

The final staged source and the isolated build host matched across 582 plugin
files after excluding generated build directories. The separately staged
`UnrealEditor-UE_MCP_Bridge.dll` has SHA-256
`c0120fac134bbe74404e7c0505e5d065941ac2bdb5cf38b3d26d2b62faf303c9`.
The staged plugin is at
`D:/NexusTools/staging/ue-mcp-guarded-save-v2-wip/UE_MCP_Bridge`; it has
not been installed into the user's project. Source equality and the built DLL
hash do not by themselves prove which bytes an editor loaded.
