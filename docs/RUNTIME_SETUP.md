# Runtime setup

Nexus runs on the editor's machine. One client registration exposes the complete
advertised toolsets of every configured provider, plus any enabled canonical
operations. The namespaced provider surface is enabled by default. Complete live
Unreal acceptance remains separate from host protocol/fixture verification.

## 1. Install and inspect without an editor

Use Node 22+ and Git. In this repository:

```sh
npm ci --ignore-scripts
npm run build
npm run test:integration
node src/main.mjs --help
node src/main.mjs --config examples/config.example.json
```

The build validates production JavaScript and the pinned catalogue; this `.mjs`
host does not require transpilation. The targeted integration command checks the combined tool
manifest and original provider contracts through MCP transports. It does not
build an Unreal project or execute native editor operations.

The final command is a stdio MCP server: stdout belongs to the protocol, and the
process waits for a client. The supplied example configures no providers and
enables no canonical operations. It advertises the five read-only Nexus controls
and the master guidance resources. Use the offline catalogue CLI to inspect
disabled canonical operations. Full provider discovery requires configured
backends and their live editor connections.

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
into the intended Unreal project. For compatibility patches, preserve the checkout's declared Git attributes and
reviewed working-tree bytes: their file hashes are exact. Some upstream files
explicitly require CRLF even with `core.autocrlf=false`. Do not commit the patch into the pinned upstream checkout;
Nexus expects the base HEAD plus the exact reviewed working-tree delta.

Ignored build products are deliberately outside source attestation. A matching
checkout is not proof that the running editor loaded its DLL or that the launched
Node/Python process uses that build. Live protocol markers/handler parity provide
additional evidence, and deployment must still verify loaded binary provenance.

## 4. Configure the unified toolset

Copy `examples/config.unified.example.json` to a host-owned file such as
`nexus.config.json`. All example paths/PID/ports are placeholders. It configures
UE-MCP and EngineWire, enables their full provider surfaces, and retains the
canonical authoring and observation packs. `providerTools` defaults to `true`;
every backend in `backends` participates even when no canonical pack uses it.

Register only Nexus with the MCP client using
`examples/unified.claude.example.json`. `tools/list` obtains each provider's
complete actual manifest, follows its pages, and exposes its tools as
`<provider>__<original-name>`. UE-MCP's `tools` becomes `ue-mcp__tools` and
EngineWire's `unreal` becomes `enginewire__unreal`. Keep inner category, method,
tool and action values unchanged. Provider schemas, content blocks, structured
results and ordinary tool failures retain their original contracts. You do not
need separate provider registrations or a new canonical adapter per action.

Provider prompts are exposed as `<provider>__<original-name>`. Resource and
template URIs use `unreal-nexus-provider://<provider>/<original-uri>`, including
the original URI's scheme. For example, EngineWire's `ue://health` becomes
`unreal-nexus-provider://enginewire/ue://health`. Nexus routes these requests to
the original provider without rewriting their returned content. Read the
`unreal-nexus://guidance/providers` for upstream initialization instructions and
namespace translation.

Full discovery can start or connect providers and requires their target editor.
Canonical controls and guidance remain available before full provider discovery.
Set `providerTools: false` for the explicit legacy canonical-only mode; only
that mode retains the old no-provider-start-during-tool-discovery behavior.

The unified example sets `allowWrites: true` so multipurpose provider gateway
tools can execute their complete interfaces. With `allowWrites: false`, every
tool is still listed, but only provider tools declaring
`annotations.readOnlyHint: true` may execute. Unknown and multipurpose tools are
treated as potentially writing. This host setting does not replace the user's
task-specific authority.

### Existing canonical routes

Full provider sessions use the supported 2025 MCP protocol revisions on stdio
and HTTP. Clients with automatic negotiation select that mode. Modern-only
requests receive an unsupported-version response: the native providers' blocking
approval exchanges must resume the original call, not replay its mutation.
Explicit canonical-only mode retains its existing protocol support.

`enabledPacks` and `enabledCapabilities` select additional canonical IDs; they
do not filter the full provider surface. The following restrictions describe
those canonical contracts. Provider-native tools retain upstream semantics.

`level.save.current` requires the UE-MCP guarded-save v2 patch and an exact
expected level package from `level.current.inspect`. It includes loaded
external packages and refuses dirty empty external packages instead of deleting
them. The legacy `allowLevelExternalPackageDeletion` setting does not grant
deletion for this route. `screenshot.pie` requires the UE-MCP direct-PIE compatibility patch and
a rebuilt matching native plugin and server. It uses a dedicated bounded socket
and writes no screenshot file. Specify an exact world path and instance from
`play.worlds.list`; the capture does not own the PIE session. Canonical held
entries never dispatch; their configured provider can still be connected for
its full namespaced manifest. PIE start and stop require the v4 native
ownership patch and a unique machine grant. `pie.status` is only a point-in-time
observation. Reconcile pre-existing PIE sessions and uncertain grants
externally; Nexus performs no implicit stop or grant release. Owned input holds require the UE-MCP owned-hold v1 patch and a rebuilt native
plugin and TypeScript server. The gateway keeps private hold tokens only in
memory; a finite lease limits abandoned input, and stop can leave one already
queued frame. Other sources on the same action can combine with the hold.
Automation start, both Blueprint compile forms, trace capture and trace-reader
open remain held pending their native ownership boundaries. Existing holds, runs,
captures and readers require external reconciliation; Nexus does not implicitly
stop, cancel or reset them.

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

Apply `uap-nexus-owned-pie-v4` from the patch guide, then rebuild its native plugin and install/build its Python
environment from the pinned checkout. Configure, for example:

```json
{
  "sourceRoot": "C:/Tools/upstreams/UnrealAgentPlayer",
  "compatibilityPatch": "uap-nexus-owned-pie-v4",
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
a discovered per-editor port**; use the actual selected editor's RC port. On Windows, set `rcEndpoint` to `editor-auto` to read the selected project's Remote Control settings and require that the selected editor owns the listener.
Its full tools appear under `unrealagentplayer__` when provider tools are enabled.
Also enable `playtesting` or the desired UAP canonical IDs when needed. If the editor's
Python Remote Execution is bound to a specific IPv4 interface, set
`NEXUS_UAP_MULTICAST_INTERFACE` in this transport's trusted `env` to the same
address (for example `127.0.0.1` for a loopback-only host). If omitted, the
provider retains its default interface selection. No discovery fallback is
attempted on another interface.

Nexus injects `NEXUS_UAP_PROJECT_FILE`, `NEXUS_UAP_EDITOR_PID` and
`NEXUS_UAP_RC_PORT` from the pinned target and validated RC URL. It also binds
`PYTHONPATH` to the verified checkout's `mcp-server/src`. The patch constructs
both native clients with those bindings. `bridge_status` must echo the actual
binding and single-dispatch marker before the identity script is sent. No caller
can substitute a discovery selector in canonical arguments.

### Claireon

For `blueprint.compile.memory.loaded` or the `blueprint-compile` pack, apply
`claireon-nexus-compile-loaded-v2`; it includes the no-autosave patch. Rebuild
the plugin and run it in direct mode. Find the live port in the intended project's `Saved/Claireon/MCPServer.json`;
Nexus verifies the actual listener owner. Proxy mode cannot satisfy this check.
Configure the actual endpoint:

```json
{
  "sourceRoot": "C:/Tools/upstreams/Claireon",
  "compatibilityPatch": "claireon-nexus-compile-loaded-v2",
  "transport": {"type": "streamable-http", "url": "http://127.0.0.1:52000/mcp"}
}
```

52000 is a placeholder. On Windows, `transport.url: "editor-auto"` reads the selected project's direct-mode port metadata and verifies the selected editor owns the listener. Both auto endpoints are resolved once when that backend starts; they do not switch to another process or port after a failure. Enable any of `blueprint-compile`, `automation-tests` or
`insights-analysis`. Every wrapper fixes `nexus_skip_auto_save=true`, including
schema probes. Nexus does not execute Python to establish Claireon's identity.
If the outer live marker or inner schema is missing, the requested operation is
not dispatched.

### Hayba

Apply `hayba-nexus-material-receipt-v2` and rebuild both its native plugin and
TypeScript server. Copy `examples/hayba.settings.example.json` outside the
source checkout and configure it as `HAYBA_SETTINGS_PATH`. The host settings
preload the direct `material` domain pack using upstream deferred routing.

```json
{
  "sourceRoot": "C:/Tools/upstreams/hayba",
  "compatibilityPatch": "hayba-nexus-material-receipt-v2",
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
after reconnection. Nexus uses the fixed read-only `material_nexus_identity`
tool to corroborate the editor and native receipt marker, then the direct
`material_set_param` tool with the v2 receipt selector and no-retry marker.
Those fixed canonical adapters do not invoke generic routing. The complete
provider surface also exposes Hayba's own routing tools under `hayba__`, with
their original contracts.

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

In unified mode, legacy Streamable HTTP retains each initialized MCP session and
its client capabilities. This allows provider callbacks, including elicitation,
to reach the same connected client; the client must support the requested
callback. MCP clients manage the session identifier returned during initialization.
Sessions share the same runtime, provider connections and queue.

Explicit canonical-only mode retains stateless legacy HTTP handling. In that
mode, a separate `notifications/cancelled` POST cannot cancel a call handled by
another server instance. Original-request disconnects, modern HTTP cancellation
and operation deadlines still apply. Cancellation never proves that native
Unreal work stopped or rolled back.

## 6. Connection lifecycle and recovery

In unified mode, tool discovery verifies source, starts/connects all configured
providers, enumerates their real tools and corroborates the target. In legacy
canonical-only mode this happens when the first canonical call needs a provider.
Later calls reuse those connections and repeat live target checks; canonical
calls retain their additional capability checks. The transport sends a tool
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
