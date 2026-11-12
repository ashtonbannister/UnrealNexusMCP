# Windows viewport observation — 2026-11-11

Scope: one live, read-only current-viewport capture through an isolated Nexus coordinator at commit `174f4a2`; this is not profile or release qualification. The existing coordinator and editor were left running. The separate coordinator does not share a queue with other clients.

- Environment: Windows, Node 24.8.0, Unreal Editor from an engine installation whose Build.version reports 5.8.4, Henday Heat project, observed editor PID 39912. The project command line and EngineWire listener ownership were checked for that process before testing. Loaded plugin binary identity was not independently established.
- Request: `screenshot.viewport.current` with `resolution: "640x360"`. This is a downscale bounding box, not an exact rerender size. The gateway returned `isError: false` and one `image/png` block after its receipt and image checks.
- Inspected artifact: 640 x 347 PNG, 280030 bytes, SHA-256 `f746ae4173f00de12966b257baf0b140be5c1bdbc80c4563071158e32f65f90c`. Visual inspection showed the editor viewport with terrain, sky and a checkerboard surface. The image is retained outside the repository in the task's local artifact folder.
- Limits: this does not establish exact PIE-client selection, gameplay correctness, other operations, persistence, concurrency safety, loaded-artifact provenance or full native qualification. The operation can foreground the viewport. Independent clients and the running installation remain outside the test coordinator's queue.

The preceding attempts identified two pre-dispatch EngineWire compatibility mismatches, corrected in `d31514b` and `174f4a2`: the native identity receipt envelope and the params-only screenshot descriptor. The live capture above used those fixes; it does not qualify untested failure and recovery cases.

## Module paths and disk snapshot

A separate read-only Windows process-module enumeration for editor PID 39912 showed the following project-plugin module names loaded. SHA-256 values below are hashes of the files found at the reported module paths on disk during inspection. They do **not** hash process memory, prove the loaded image matches a later file read, or tie a binary to a particular source revision and patch.

| Module | On-disk SHA-256 |
| --- | --- |
| UnrealEditor-UE_MCP_BridgeStatus.dll | `b3d68cbe7b3571ce3ffb582fab7449a7ef78253c87f8af3b18e10130b1562dc3` |
| UnrealEditor-Claireon.dll | `a87d4b224718f6653004f6b32b2bd7f333ea136a49967834f3ce7cd23905c87c` |
| UnrealEditor-EngineWire.dll | `952f25423b480939cbb2a9e5c16b98f24387fbdac8b4a1c8d772e4727826b190` |
| UnrealEditor-EngineWireFab.dll | `70bedebe9901da43a693cd89fe0f44dd05de2838d0fadcfc412d8ce0fed3b35a` |
| UnrealEditor-UE_MCP_BridgeRuntime.dll | `988f8d8199811b8c14ef6565b57024ff2578d6760bb30e40ecfefb9824e2c070` |
| UnrealEditor-UE_MCP_Bridge.dll | `d955c691eda089fce23f90321ce3feb23c859265ba8a0370e6b6220fb4b7422b` |
| UnrealEditor-HaybaMCPToolkit.dll | `655cb6ff68b58332168b7dca002ed7a63704d59c59bd222f100f3af1421d248c` |
| UnrealEditor-UnrealAgentPlayerRuntime.dll | `8c05ad1c88c5de5042461e5f4e834b7a5bbfd020c9209cad3133bd111764d194` |
| UnrealEditor-UnrealAgentPlayer.dll | `74a34eb062c60fc899e1c91b21221525cd2714e17f385367703df5e7850f025d` |
