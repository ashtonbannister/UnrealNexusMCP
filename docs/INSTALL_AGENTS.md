# Installing Nexus for an Unreal project (agent guide)

Audience: an agent setting up Unreal Nexus MCP on a Windows machine with Unreal Engine 5.8 and a project. Follow the steps in order. Stop and report to the user at any step marked **USER**.

Placeholders: `<NEXUS_ROOT>` (where the gateway lives), `<UPSTREAMS>` (pinned upstream checkouts), `<PROJECT>` (the `.uproject` folder), `<ENGINE>` (engine root, e.g. `C:\Program Files\Epic Games\UE_5.8`).

## 0. Rules that prevent most failures

- **Run the gateway on Windows Node, not WSL.** Identity checks inspect Windows processes; a Linux-side process cannot verify the editor. WSL also does not forward environment variables to Windows processes reliably, so do not rely on `WSLENV`.
- **Never put secrets in config files or in committed files.** The EngineWire capability token is read from the editor's `Saved\MCP\capability-token` by a launcher script.
- **Do not run any upstream `build` script that targets an engine tree or a test project.** Compile the target project itself with the engine's `Build.bat`.
- **Do not write into `<ENGINE>`.** Only project files and `<NEXUS_ROOT>` should change.
- **Editor state changes the config.** Set `target.processId` to `auto` on Windows to select the one running editor for the exact project when a provider is first needed. Nexus controls remain available before the editor starts; complete provider discovery needs the editor. Nexus pins the process after selection and refuses zero or ambiguous matches. EngineWire ports can change. On Windows, Claireon's `transport.url` and UAP's `rcEndpoint` can be set to `editor-auto`; each is resolved when its backend starts and must be owned by the selected editor.
- **Restart the agent client after any config change.** The gateway's config and PID are cached per session.

## 1. Prerequisites  **USER** if missing

- Windows 10/11, Unreal Engine 5.8 installed, Visual Studio 2022 or 2026 with the C++ workload (required for `Build.bat`).
- Node.js 22 or newer for Windows.
- Python 3.10+ for Windows (for UnrealAgentPlayer's venv).
- Git.

Check the engine version from `<ENGINE>\Engine\Build\Build.version` (`MajorVersion`, `MinorVersion`, `PatchVersion`). Do not assume it from a catalogue.

## 2. Get the gateway

```
git clone https://github.com/ashtonbannister/UnrealNexusMCP.git <NEXUS_ROOT>
git -C <NEXUS_ROOT> checkout <branch-with-the-version-you-reviewed>
```

Install and verify, from `<NEXUS_ROOT>`:

```
npm ci --ignore-scripts
npm run build
npm run test:integration
```

Expected result: production JavaScript and pinned catalogue validation, followed by the targeted unified integration checks
pass. These checks use fixture providers and do not build or qualify Unreal.

## 3. Clone and patch the upstreams at pinned commits

Read `catalog/upstreams.lock.json`. Install `ue-mcp` and `enginewire` for the
combined base configuration. Also install any configured optional provider
(`claireon`, `unrealagentplayer`, `hayba`):

```
git -c core.autocrlf=false clone <repository> <UPSTREAMS>\<name>
git -C <UPSTREAMS>\<name> checkout <commit>
```

For providers required by the selected profile, apply their reviewed patches (check first, then apply). Omit commands for unused providers:

```
git -C <UPSTREAMS>\ue-mcp apply --check <NEXUS_ROOT>\patches\ue-mcp-nexus-owned-hold-v1.patch
git -C <UPSTREAMS>\ue-mcp apply <NEXUS_ROOT>\patches\ue-mcp-nexus-owned-hold-v1.patch
git -C <UPSTREAMS>\claireon apply --check <NEXUS_ROOT>\patches\claireon-nexus-compile-loaded-v2.patch
git -C <UPSTREAMS>\claireon apply <NEXUS_ROOT>\patches\claireon-nexus-compile-loaded-v2.patch
git -C <UPSTREAMS>\hayba apply --check <NEXUS_ROOT>\patches\hayba-nexus-material-receipt-v2.patch
git -C <UPSTREAMS>\hayba apply <NEXUS_ROOT>\patches\hayba-nexus-material-receipt-v2.patch
git -C <UPSTREAMS>\unrealagentplayer apply --check <NEXUS_ROOT>\patches\uap-nexus-owned-pie-v4.patch
git -C <UPSTREAMS>\unrealagentplayer apply <NEXUS_ROOT>\patches\uap-nexus-owned-pie-v4.patch
```

For the optional `actor-deletion-checked` profile, apply `ue-mcp-nexus-checked-delete-v1.patch` to a pristine UE-MCP checkout instead of the owned-hold patch above; it includes that patch. Build the native plugin and TypeScript server, and require the live marker before use.

Do not commit inside the upstream checkouts. The patched working tree is intentional.

Build only the servers required by the selected profile that the gateway launches:

- **UE-MCP:** `npm install --ignore-scripts` then `npx tsc -p tsconfig.json` in `<UPSTREAMS>\ue-mcp`. Do **not** run `npm run build` (it targets UE-MCP's own test project).
- **Hayba:** `npm install --ignore-scripts` in `<UPSTREAMS>\hayba`, then `npm --prefix mcp-tools/hayba-mcp run build`.
- **UnrealAgentPlayer:** create a venv in `mcp-server` with the Windows Python and install it editable (`python -m venv .venv`, `.venv\Scripts\python.exe -m pip install -e .`). Verify with a small script that imports `unreal_agent_player`. Do not run a Linux-side Python here.

## 4. Install the plugins into the project

For each provider required by the selected profile, copy its plugin folder into `<PROJECT>\Plugins\<Name>` without `.git`:

| Source | Destination name |
|---|---|
| `<UPSTREAMS>\unrealagentplayer\Plugin` | `UnrealAgentPlayer` |
| `<UPSTREAMS>\claireon` | `Claireon` |
| `<UPSTREAMS>\enginewire\plugins\EngineWire` | `EngineWire` |
| `<UPSTREAMS>\ue-mcp\plugin\ue_mcp_bridge` | `UE_MCP_Bridge` |
| `<UPSTREAMS>\hayba\unreal\HaybaMCPToolkit` | `HaybaMCPToolkit` |

Enable each selected plugin in `<PROJECT>\<Project>.uproject` under `Plugins` (`"Enabled": true`). Keep the existing entries.

**USER:** the project should be under your control; these steps modify it. Confirm before writing into it, and save a copy of the `.uproject` and `Config\` folder if the project is not under version control.

## 5. Config changes the project needs

- **EngineWire native port.** Port 3000 is often in use. In `<PROJECT>\Config\DefaultGame.ini` add:
  ```
  [/Script/EngineWire.EngineWireSettings]
  NativeMCPPort=<free port>
  ```
  Check the port with a listener probe before choosing it.
- **Python remote execution** (needed by UnrealAgentPlayer). In `<PROJECT>\Config\DefaultEngine.ini` add:
  ```
  [/Script/PythonScriptPlugin.PythonScriptPluginSettings]
  bRemoteExecution=True
  RemoteExecutionMulticastBindAddress=<reviewed interface address>
  RemoteExecutionMulticastTtl=1
  ```
  Select an interface and TTL only after reviewing network isolation and peer trust; binding all interfaces expands exposure.
- **Editor setting (manual).** Project Settings → Plugins → Remote Control → Security → **Allow Any Remote Function Call**. UE 5.8 defaults this off, and UnrealAgentPlayer's calls fail until it is on. This broad permission expands exposure; use only after reviewing isolation and peer trust. It is a per-user setting.

## 6. Build the editor target

Stop any running editor first, and stop Live Coding (Ctrl+Alt+F11 in the editor, or close it). `UnrealBuildTool` refuses to build while Live Coding is active, and `-DisableLiveCoding` does not get around it.

```
"<ENGINE>\Engine\Build\BatchFiles\Build.bat" <Project>Editor Win64 Development -Project="<PROJECT>\<Project>.uproject" -WaitMutex -NoEngineChanges
```

Expected: `Result: Succeeded`. Check the log, not just the exit code. A first build takes several minutes.

## 7. Start the editor and find its PID

Start the project in the editor and wait until it is idle. With `target.processId: "auto"`, Nexus selects the unique editor for the exact project. Find its PID to inspect ports; if explicit selection is preferred, put that PID in the configuration and update it after each editor restart.

Read the ports the editor actually bound (`Get-NetTCPConnection -OwningProcess <PID>` in PowerShell). Expect:

- UAP RC HTTP port (the log line "RC HTTP port <n> already bound from config").
- EngineWire native MCP on the port set in step 5.
- Claireon direct MCP port from `<PROJECT>\Saved\Claireon\MCPServer.json` (created when Claireon's server starts; open its Diagnostics tab to start it).
- Hayba's native TCP port.

**USER:** if Claireon's server does not start, open its Diagnostics tab in the editor.

## 8. Write the gateway config

Create `<NEXUS_ROOT>`-adjacent `nexus.config.json` (keep it outside the repo).
Use `examples/config.unified.example.json` as the template. Replace
`target.projectRoot` (the `.uproject` path), each backend's `sourceRoot`, transport
command/args, and ports with installed values. It exposes the complete UE-MCP
and EngineWire toolsets through Nexus and also enables canonical authoring and
observation. Add optional providers under `backends` to expose their complete
toolsets through the same entrypoint.

Keep `providerTools: true` (the default). `enabledPacks` and
`enabledCapabilities` choose canonical convenience routes; they do not restrict
provider tools. The unified example enables writes to permit multipurpose
provider gateways. For a read-only host set `allowWrites: false`: all provider
tools remain discoverable, but only those advertising
`annotations.readOnlyHint: true` may execute. This setting does not replace
task-specific authorization.

Secrets: pass the EngineWire token through a launcher script that reads the file (see section 9), not through the config file.

## 9. Launcher (Windows)

A small `.cmd` that reads the token from the file and runs the gateway with Windows Node:

```
@echo off
set /p NEXUS_ENGINEWIRE_TOKEN=<"<PROJECT>\Saved\MCP\capability-token"
"C:\Program Files\nodejs\node.exe" "<NEXUS_ROOT>\src\main.mjs" --config "<config path>"
```

Register it with the agent client as one stdio server whose command is `cmd.exe`
with args `/c <launcher path>`. Name it `unreal-nexus`.

The [single-entry client example](../examples/unified.claude.example.json)
launches Node directly when the environment already contains the token. The old
`direct-providers.claude.example.json` now contains the same unified entry for
migration. Remove separately registered provider entries. All provider calls
go through Nexus; neither UE-MCP nor EngineWire needs its own client entry.

## 10. Verify, in order

1. **Combined manifest:** connect the client to Nexus and request `tools/list`.
   Confirm `ue-mcp__tools` and `enginewire__unreal` are both present, along with
   every additional tool their live manifests advertise. Discovery connects
   providers; no separate client registrations are involved.
2. **One call per provider:** use each namespaced gateway's original discovery
   or read-only command, keeping its original arguments. Confirm the original
   provider response is returned. A namespace changes only the public MCP name,
   not an inner category, method, action or tool value.
3. **Status:** `nexus.status` should report the configured providers, their
   connection/identity evidence and queue state. Existing canonical calls remain
   available when their packs and compatibility patches are enabled.

If optional providers are configured, include them in the same manifest check.
Canonical held operations remain held; provider tools retain their native
contracts. Native qualification beyond these setup round trips is a separate
claim and must be reported with its actual evidence.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `enginewire.headerEnv … must be a nonempty string` | Token not in the gateway process environment | Use the launcher (section 9) |
| EngineWire log: "Failed to bind … 3000" | Port 3000 in use | Set `NativeMCPPort` to a free port (section 5) |
| UAP: "not allowed by remote control settings" | Allow Any Remote Function Call is off | Tick it in the editor (section 5) |
| UAP: `UE_REMOTE_EXEC_OFF` | Python remote exec not answering | Check bind address and TTL (section 5), then restart the editor |
| `Live Coding is active` at build | Live Coding running | Stop it, then build |
| `IDENTITY_UNPROVEN` | Identity, listener, marker, project or process checks did not establish the target | Inspect the specific diagnostics and reconcile before retrying |
| Tools missing in the agent after config change | Stale session | Restart the agent client |

## 12. Do not

- Commit `Saved\`, `Intermediate\`, `Binaries\`, `DerivedDataCache\` or the capability token.
- Run upstream build scripts that touch the engine tree.
- Run the editor build without `-NoEngineChanges`. Always pass that flag.
- Use an agent to close the user's editor without asking. Closing can lose unsaved work.
