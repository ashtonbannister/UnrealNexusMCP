# Windows viewport observation — 2026-11-11

Scope: one live, read-only current-viewport capture through an isolated Nexus coordinator at commit `174f4a2`; this is not profile or release qualification. The existing coordinator and editor were left running. The separate coordinator does not share a queue with other clients.

- Environment: Windows, Node 24.8.0, Unreal Editor from an engine installation whose Build.version reports 5.8.4, Henday Heat project, observed editor PID 39912. The project command line and EngineWire listener ownership were checked for that process before testing. Loaded plugin binary identity was not independently established.
- Request: `screenshot.viewport.current` with `resolution: "640x360"`. This is a downscale bounding box, not an exact rerender size. The gateway returned `isError: false` and one `image/png` block after its receipt and image checks.
- Inspected artifact: 640 x 347 PNG, 280030 bytes, SHA-256 `f746ae4173f00de12966b257baf0b140be5c1bdbc80c4563071158e32f65f90c`. Visual inspection showed the editor viewport with terrain, sky and a checkerboard surface. The image is retained outside the repository in the task's local artifact folder.
- Limits: this does not establish exact PIE-client selection, gameplay correctness, other operations, persistence, concurrency safety, loaded-artifact provenance or full native qualification. The operation can foreground the viewport. Independent clients and the running installation remain outside the test coordinator's queue.

The preceding attempts identified two pre-dispatch EngineWire compatibility mismatches, corrected in `d31514b` and `174f4a2`: the native identity receipt envelope and the params-only screenshot descriptor. The live capture above used those fixes; it does not qualify untested failure and recovery cases.
