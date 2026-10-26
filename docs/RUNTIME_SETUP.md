# Runtime setup

Nexus runs on the editor's machine. It exposes one canonical MCP surface and
connects only to the backends selected by enabled capabilities. The implementation
has protocol/fixture tests; complete live Unreal acceptance is still required.

## 1. Install and inspect without an editor

Use Node 22+ and Git. In this repository:

```sh
npm ci --ignore-scripts
npm run check
node src/main.mjs --help
node src/main.mjs --config examples/config.example.json
```

The full isolated Python checks also need `python3` and the pristine UAP checkout
at its pinned revision. Set `NEXUS_UAP_SOURCE_ROOT` to that checkout (or place it
beside this repo as `upstream-unrealagentplayer`). Without the snapshot, the
UAP patched-method test explicitly skips; without Python, the standalone wrapper
syntax check explicitly skips. A source snapshot plus missing Python is a test
setup error. The recorded full run supplied both and had no skips.

The final command is a stdio MCP server: stdout belongs to the protocol, and the
process waits for a client. The supplied example enables no backend operations.
Only `nexus.status`, `nexus.describe` and `nexus.plan` are advertised; describing or
planning a disabled capability refuses. The master guidance resources remain
available. Use the offline catalogue CLI to inspect disabled operations.

## 2. Identify the actual editor

Supply `target.projectRoot` as the **exact absolute `.uproject` file**, despite
the historical field name. Supply the live editor's `processId`. For example:

```sh
node src/main.mjs inspect-editor 12345
```

Replace 12345 with the real PID. This read-only command reports process details
and an instance identifier derived from process start identity. Linux uses the
boot ID, PID and `/proc` start ticks; Windows uses CIM process creation ticks.
The runtime derives that epoch on startup; optionally set `editorInstanceId` to
require an already-recorded epoch. A restart invalidates the old runtime target.

Per-provider probes must then corroborate the target. They reject game/server
processes, mismatched project paths, missing native schemas and unproved routes.
MacOS and remote-host OS identity are not implemented. UAP's native platform
support is Windows-only at the reviewed revision; Linux fixture tests do not
change that upstream restriction.

These checks are not atomic with a later engine command. Another process can act
or an editor can restart between checks. Native coordination remains required.
In particular, UE-MCP can reconnect through a project's live lockfile; Nexus
rechecks epoch/identity before each call, but does not add an engine-native epoch
token to the native dispatch protocol.

## 3. Install the selected sources

Use the commits in `catalog/upstreams.lock.json`, not floating packages. Each
configured `sourceRoot` must be the root of a Git checkout at its reviewed HEAD.
Nexus refuses unreviewed tracked modifications, unignored additional files,
index flags that hide modifications, and missing/altered required patches.

Keep local Nexus configuration and tokens outside upstream source checkouts.
Use the upstream's documented build/install procedure to install that source
into the intended Unreal project. For compatibility patches, retain LF source
bytes (`git -c core.autocrlf=false clone ...` is suitable): their reviewed file
hashes are exact. Do not commit the patch into the pinned upstream checkout;
Nexus expects the base HEAD plus the exact reviewed working-tree delta.

Ignored build products are deliberately outside source attestation. A matching
checkout is not proof that the running editor loaded its DLL or that the launched
Node/Python process uses that build. Live protocol markers/handler parity provide
additional evidence, and deployment must still verify loaded binary provenance.

## 4. Configure only the capabilities needed

Copy `examples/config.authoring.example.json` to a host-owned file such as
`nexus.config.json`. All example paths/PID/ports are placeholders. The two base
packs select UE-MCP and EngineWire; remove either pack and its backend if unused.
You may instead set `enabledCapabilities` to individual IDs. Writes/lifecycle
actions require `allowWrites: true`; this host setting does not replace the
user's task-specific authority.

Relative paths resolve against the configuration file's directory. Fields are
strictly checked; unknown keys are rejected. Credential values come from named
environment variables. A config change takes effect after an intentional restart,
not through a model-callable configuration tool.

| Provider | Production connection | Target/capability proof |
|---|---|---|
| UE-MCP | Prefer launched stdio from pinned `dist/index.js`, one exact project argument | Live `project.get_status` PID/project/handler parity, OS epoch, per-action description |
| EngineWire | Direct local Streamable HTTP `/mcp` | Listener belongs to selected editor; native project settings and exact available action schema |
| UnrealAgentPlayer | Launched stdio, reviewed patch, explicit local RC base URL | Bound project/PID/RC marker; native Python identity; same-editor RC listener and reflected functions |
| Claireon | Direct local Streamable HTTP `/mcp`, reviewed patch | Editor-owned listener/OS project, outer no-autosave marker, exact inner schema via a fixed wrapper |
| Hayba | Launched stdio, reviewed patch, explicit `UE_TCP_PORT` | Native listener owner, fixed read-only Python identity, directly advertised typed material schema |

EngineWire and Claireon proxies are not qualified identity routes. A proxy-owned
port cannot prove which editor receives the later mutation. EngineWire's legacy
stdio proxy also resends after HTTP 404; direct native HTTP avoids that route.
The transport library supports explicit legacy SSE, but that support alone does
not qualify a provider's target/operation semantics.

### UE-MCP and EngineWire

The authoring example launches the local UE-MCP build with the intended project
argument. Its public surface must be micro mode (`tools`). Nexus forces its
launched stdio server into `UE_MCP_SERVER_MODE=in-process`, avoiding a detached
daemon whose loaded source/lifetime may differ. Install the native bridge before
using Nexus; the gateway does not run upstream init/update/deploy commands.

For EngineWire, copy the current native capability token to the environment
variable `NEXUS_ENGINEWIRE_TOKEN`. The example sends it using
`X-MCP-Capability-Token`. Change the port to the actual native listener if needed.
The URL must be literal loopback for production identity verification.

### UnrealAgentPlayer

Apply `uap-nexus-no-replay-v1` from the patch guide, then install/build its Python
environment from the pinned checkout. Configure, for example:

```json
{
  "sourceRoot": "C:/Tools/upstreams/UnrealAgentPlayer",
  "compatibilityPatch": "uap-nexus-no-replay-v1",
  "rcEndpoint": "http://127.0.0.1:30010",
  "transport": {
    "type": "stdio",
    "command": "C:/Tools/upstreams/UnrealAgentPlayer/mcp-server/.venv/Scripts/python.exe",
    "args": ["-m", "unreal_agent_player"],
    "inheritEnv": ["PATH", "SystemRoot", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA"]
  }
}
```

Place that object under `backends.unrealagentplayer`. **30010 is an example, not
a discovered per-editor port**; use the actual selected editor's RC port.
Enable `playtesting` or the desired UAP canonical IDs.

Nexus injects `NEXUS_UAP_PROJECT_FILE`, `NEXUS_UAP_EDITOR_PID` and
`NEXUS_UAP_RC_PORT` from the pinned target and validated RC URL. It also binds
`PYTHONPATH` to the verified checkout's `mcp-server/src`. The patch constructs
both native clients with those bindings. `bridge_status` must echo the actual
binding and single-dispatch marker before the identity script is sent. No caller
can substitute a discovery selector in canonical arguments.

### Claireon

Apply `claireon-nexus-no-autosave-v1`, rebuild the plugin and run it in direct
mode. Find the live port in the intended project's `Saved/Claireon/MCPServer.json`;
Nexus verifies the actual listener owner. Proxy mode cannot satisfy this check.
Configure the actual endpoint:

```json
{
  "sourceRoot": "C:/Tools/upstreams/Claireon",
  "compatibilityPatch": "claireon-nexus-no-autosave-v1",
  "transport": {"type": "streamable-http", "url": "http://127.0.0.1:52000/mcp"}
}
```

52000 is a placeholder. Enable any of `blueprint-compile`, `automation-tests` or
`insights-analysis`. Every wrapper fixes `nexus_skip_auto_save=true`, including
schema probes. Nexus does not execute Python to establish Claireon's identity.
If the outer live marker or inner schema is missing, the requested operation is
not dispatched.

### Hayba

Apply `hayba-nexus-no-retry-v1` and rebuild the TypeScript server. Copy
`examples/hayba.settings.example.json` outside the source checkout and configure
it as `HAYBA_SETTINGS_PATH`. That settings file preloads the direct `material`
and `python` domain packs using upstream deferred routing.

```json
{
  "sourceRoot": "C:/Tools/upstreams/hayba",
  "compatibilityPatch": "hayba-nexus-no-retry-v1",
  "transport": {
    "type": "stdio",
    "command": "node",
    "args": ["C:/Tools/upstreams/hayba/mcp-tools/hayba-mcp/dist/index.js"],
    "cwd": "C:/Projects/NexusDemo",
    "inheritEnv": ["PATH", "SystemRoot", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA"],
    "env": {
      "UE_TCP_PORT": "52342",
      "HAYBA_SETTINGS_PATH": "C:/Tools/NexusConfig/hayba.settings.json"
    }
  }
}
```

Use the actual editor-owned native TCP port, not an assumed default. Explicit
`UE_TCP_PORT` prevents the transport from rediscovering a different editor port
after reconnection. Nexus requires direct `python_run` with read-only/no-transaction
parameters for its private identity probe and direct `material_set_param` with
the required `nexus_retry_policy="never"` marker for mutation. It never invokes
Hayba's generic routing or dynamically loads a pack to evade a refusal.

## 5. Local HTTP instead of stdio

Set the server portion of the same config:

```json
{"transport":"http","host":"127.0.0.1","port":7337,"tokenEnv":"NEXUS_HTTP_TOKEN"}
```

Set that environment variable to a randomly generated token containing at least
32 non-whitespace characters before starting. Connect the MCP client to
`http://127.0.0.1:7337/mcp` with `Authorization: Bearer <token>`. Do not store the
value in a committed config. The host refuses non-loopback binds and checks Host,
Origin, token, path and request-body size. This is local bearer authentication,
not a deployed OAuth service or a public ChatGPT connector.

All HTTP clients share one configured project, authority level, queue and fence.
There is no separate per-client principal or ownership system. The bearer is a
host access boundary; do not use this host as a multi-tenant service.

Modern HTTP cancellation and an original HTTP request disconnect propagate into
the gateway. The SDK's stateless legacy serving mode does not correlate a separate
`notifications/cancelled` POST with a call on another server instance. A legacy
client's cancellation notification alone therefore does not cancel that call;
the serialized queue and operation deadline still apply. Cancellation never
proves that native Unreal work stopped or rolled back.

## 6. Connection lifecycle and recovery

The first actual call verifies source, starts/connects the selected backend,
enumerates its real tools and corroborates the target. Later calls reuse that
connection and repeat live target/capability checks. The transport sends a tool
request once: no auth refresh, redirect following, protocol fallback, reconnect
or request replay. Reviewed native compatibility patches address additional
retries inside affected upstreams.

Child processes inherit only named `inheritEnv` values plus explicit `env`.
Use an absolute executable when PATH lookup is inappropriate. On Linux, add the
specific home/temp/runtime variables that the chosen backend actually requires;
the Windows example list is not a portable environment prescription. Child stderr
is drained rather than copied into MCP output or retained as potentially secret
logs. Diagnosing a backend startup may require running its configured command
directly under the same explicit environment.

Known preparation refusals do not imply an editor mutation. Late preparation
cannot dispatch the requested operation. After dispatch, uncertain transport,
native timeout or contained-fault evidence fences the whole gateway. The status
and received receipts remain readable. There is no reset or fallback tool.

Reconcile outstanding work using the host/editor recovery path, including owned
PIE, input holds, automation runs and traces, before deliberately restarting.
Transport shutdown does not implicitly save, stop a trace, cancel a test or close
an upstream session. Incomplete transport cleanup is reported as such. The live
acceptance matrix in `INTEGRATION_ACCEPTANCE.md` remains required before claiming
the editor workflows are qualified.
