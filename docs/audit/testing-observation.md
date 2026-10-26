# Testing and observation selection audit

**Snapshot scope:** This report records the initial upstream source-selection review. Current adapter/patch availability is recorded in [implementation selection](../IMPLEMENTATION_SELECTION.md), [runtime setup](../RUNTIME_SETUP.md) and [the master guidance](../MASTER_SKILL_GUIDANCE_DRAFT.md). References below to an adapter still being required describe that original review stage.

Reviewed 2026-10-26 from source. No native plugin was compiled or exercised in
Unreal. Simulated gateway tests do not establish engine compatibility. Exclusion
means Nexus callable/default selection, not deletion of upstream code.

| Operation | Selected candidate | Scope |
|---|---|---|
| PIE lifecycle | UnrealAgentPlayer | Viewport, confirmed start/stop |
| Current viewport observation | EngineWire | Inline image; editor or PIE |
| Selected PIE world with UMG | UE-MCP | Synchronous file capture |
| Enhanced Input pulse/hold/update/stop | UE-MCP | Explicit local world/player |
| Engine automation | Claireon | Adapter required |
| Trace analysis | Claireon | Adapter required |

## PIE lifecycle

Reviewed public envelopes:

```json
{"name":"pie_start","arguments":{"mode":"PlayInViewport","wait":true,"timeout":60}}
{"name":"pie_stop","arguments":{}}
{"name":"pie_status","arguments":{}}
```

Pin mode and wait; only allow a bounded finite start timeout. Stop/status have
no public timeout argument. Start polls for Playing/Paused. Stop cancels queued
play and requests live termination, then polls NotPlaying before releasing the
machine hold. See [Python lifecycle][uap-pie] and [native cancellation][uap-stop].

A successful MCP transport can contain uncertain work: start timeout returns
ok=false, queued=true, confirmed=false and warns that PIE may start later.
Fence subsequent execution even without a transport exception. Preserve the
receipt. No automatic retry, fallback, rollback claim or release to another agent.
The current Nexus core requires operator/host reconciliation outside its fenced
queue; pie.stop cannot bypass the fence.

UAP defaults a missing Remote Control phase ReturnValue to NotPlaying. Strict
Nexus result parsing cannot repair that upstream optimism; live malformed-RC
testing is required.

Alternate start modes, map_path, start_location and pause/resume are not initially
exposed. NewWindow uses the same request as Viewport; map_path is interpolated
into Python; pause can acknowledge when no world exists. Select the coherent
queued-cancel-and-confirm family, not every advertised mode.

## EngineWire: current viewport, not editor-world-only

```json
{"name":"unreal","arguments":{"operation":"execute","tool":"control_editor","action":"screenshot","params":{"mode":"editor_viewport","resolution":"1280x720","returnBase64":true,"keepFile":false,"waitForShaders":true}}}
```

The [native handler][ew-screen] reads pixels, encodes PNG, reports actual
dimensions and downscales within an aspect-preserving box. It does not rerender
at exact requested dimensions. Preserve [MCP image blocks][ew-image], text
receipt, warnings and shaderWait: its cap can expire with compilation outstanding.

mode=editor_viewport does not guarantee editor-world pixels. bEjectedView at
line 54 comes from current PIE state. Lines 192–194 select an existing
non-ejected PIE viewport even with editor_viewport mode. The receipt may report
pie_game or pie_ejected. Therefore Nexus calls this
`screenshot.viewport.current`. Require separately reconciled NotPlaying for
strict editor-world-only intent.

Omit transforms and arbitrary paths from this subset. EW game_viewport lacks
UMG; full_editor_window is another contract, not an interchangeable fallback.

## UE-MCP: selected PIE frame with UMG

```json
{"name":"tools","arguments":{"action":"call","category":"editor","method":"capture_screenshot","args":{"filename":"fresh-unique-frame.png","target":"pie","pieInstance":1}}}
```

The default public tool is [tools][micro], not editor. Pin target=pie. Native
filename is required; exact selectors are pieInstance and worldPath. Do not
invent a resolution argument.

The [native handler][ue-screen] resolves the selected capturable world, obtains
UMG-inclusive Slate pixels and writes synchronously. A returned file path is
not an MCP image: an authorized host-file read is still needed before claiming
visual inspection. Use a fresh basename; upstream can overwrite existing files.
The target=editor branch is asynchronous and excluded from this contract.

UAP supports UMG at the reviewed pin, but its first-PIE/active-window fallback
is weaker for exact-world evidence. Claireon's HighResShot acknowledges before
completion and its multiplier branch omits the requested output path. Hayba's
queued/check_only screenshot is honest but asynchronous. Retain those scope
differences; do not claim equivalence.

## Enhanced Input

Use UE micro category=pie and methods inject_input, inject_input_start,
inject_input_update, inject_input_stop. Canonical one-shot/start require
action_path, client_id and pie_instance; start also requires a workflow-owned
injection_id. Native defaults/optional selectors are deliberately narrowed by
Nexus. Hold update requires all three values; stop requires its exact ID.

[Native injection][input] rejects unavailable explicitly selected worlds.
client_id is a local player index; it is not a PIE world identifier. Preserve
the returned hold ID and release owned holds. Remote relay acceptance is not
execution proof; relay and tape playback stay unexposed initially. Raw gameplay
keys, Slate/UI input, analog routing and synthetic XR poses are different intents.

## Automation: Claireon, adapter required

Internal names are not public MCP tools. Future fixed wrappers should invoke
claireon.test_run with nonempty testFilter, strict=True, expected_tests,
allowed_skips and noTimeout=False; then test_poll with exact run_id.
Do not expose unrestricted Python.

The [implementation][tests] uses the normal controller/worker between polls.
Strict expectations compare discovered names, not only counts; skips require
names and reasons. Its gate has no autonomous expiry: polling completion,
deadline or cancellation releases it. Final report is returned once then
forgotten; persist it. Normal deadline is 1800 seconds; noTimeout raises it to
3600, not infinity. Zero tests and startup acknowledgements are not passes.

## Trace analysis: Claireon, adapter required

Future wrappers: pie_trace_start/stop, trace_open, trace_get_top_scopes,
trace_get_frame_stats, trace_close. Actual TraceServices analysis differs from
file metadata. [Scope aggregation][scopes] supports totalInclusive/count sorting.
Default capture channels omit GPU.

[Frame statistics][frames] cover the returned page, not necessarily the whole
requested range. Values are average/min/max, not percentiles; game_thread_ms is
frame duration, not separately measured GameThread CPU cost. Hitch lists alone
do not establish cause.

## Guidance and qualification

Preserve business errors, images, uncertainty, world identity, input cleanup
and measurement coverage. Missing metrics are not zero. Recorded assertions
are not executed tests. Offscreen rendering, NullRHI, commandlets and ordinary
editor automation are not interchangeable. Qualify all transports, plugin gates,
selected-world capture and queued-timeout recovery on the user's Unreal build.

## Immutable source evidence

[uap-pie]: https://github.com/ImagineTheGames/UnrealAgentPlayer/blob/4ab7a62eb78612c2ec110f683b6e11f5dea62e95/mcp-server/src/unreal_agent_player/tools/pie.py#L12-L170
[uap-stop]: https://github.com/ImagineTheGames/UnrealAgentPlayer/blob/4ab7a62eb78612c2ec110f683b6e11f5dea62e95/Plugin/Source/UnrealAgentPlayer/Private/UAPAgentSubsystem.cpp#L297-L340
[ew-screen]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/ControlEditor/McpEditorScreenshot.cpp#L37-L323
[ew-image]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/MCP/Protocol/McpJsonRpcImageContent.cpp#L127-L150
[micro]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/surface/context/micro-context.ts#L25-L104
[ue-screen]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Editor/EditorHandlers.cpp#L2822-L3064
[input]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/PIE/PIEHandlers_InputInject.cpp#L70-L284
[tests]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_TestRun.cpp#L158-L714
[scopes]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_TraceGetTopScopes.cpp#L116-L240
[frames]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_TraceGetFrameStats.cpp#L63-L146
