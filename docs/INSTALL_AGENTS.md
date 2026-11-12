# Installing Nexus for an Unreal project (agent guide)

Audience: an agent setting up Unreal Nexus MCP on a Windows machine with Unreal Engine 5.8 and a project. Follow the steps in order. Stop and report to the user at any step marked **USER**.

Placeholders: `<NEXUS_ROOT>` (where the gateway lives), `<UPSTREAMS>` (pinned upstream checkouts), `<PROJECT>` (the `.uproject` folder), `<ENGINE>` (engine root, e.g. `C:\Program Files\Epic Games\UE_5.8`).

## 0. Rules that prevent most failures

- **Run the gateway on Windows Node, not WSL.** Identity checks inspect Windows processes; a Linux-side process cannot verify the editor. WSL also does not forward environment variables to Windows processes reliably, so do not rely on `WSLENV`.
- **Never put secrets in config files or in committed files.** The EngineWire capability token is read from the editor's `Saved\MCP\capability-token` by a launcher script.
- **Do not run any upstream `build` script that targets an engine tree or a test project.** Compile the target project itself with the engine's `Build.bat`.
- **Do not write into `<ENGINE>`.** Only project files and `<NEXUS_ROOT>` should change.
- **Editor state changes the config.** Every editor restart changes the process ID, and the EngineWire, Claireon and UAP ports can change. Re-read them after each restart.
- **Restart the agent client after any config change.** The gateway's config and PID are cached per session.

## 1. Prerequisites  **USER** if missing

- Windows 10/11, Unreal Engine 5.8 installed, Visual Studio 2022 or 2026 with the C++ workload (required for `Build.bat`).
- Node.js 24 for Windows (the test script needs Node 24; runtime needs 22+).
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
npm run check
```

Expected result: all tests pass, with at most one skip (the UAP patched-method test, which needs step 3's source snapshot). **USER** if tests fail.

## 3. Clone and patch the upstreams at pinned commits

Read `catalog/upstreams.lock.json`. For each provider (`ue-mcp`, `enginewire`, `claireon`, `unrealagentplayer`, `hayba`):

```
git -c core.autocrlf=false clone <repository> <UPSTREAMS>\<name>
git -C <UPSTREAMS>\<name> checkout <commit>
```

Apply the reviewed patches (check first, then apply):

```
git -C <UPSTREAMS>\claireon apply --check <NEXUS_ROOT>\patches\claireon-nexus-no-autosave.patch
git -C <UPSTREAMS>\claireon apply <NEXUS_ROOT>\patches\claireon-nexus-no-autosave.patch
git -C <UPSTREAMS>\hayba apply --check <NEXUS_ROOT>\patches\hayba-nexus-no-retry.patch
git -C <UPSTREAMS>\hayba apply <NEXUS_ROOT>\patches\hayba-nexus-no-retry.patch
git -C <UPSTREAMS>\unrealagentplayer apply --check <NEXUS_ROOT>\patches\uap-nexus-no-replay.patch
git -C <UPSTREAMS>\unrealagentplayer apply <NEXUS_ROOT>\patches\uap-nexus-no-replay.patch
```

Do not commit inside the upstream checkouts. The patched working tree is intentional.

Build the servers that the gateway launches:

- **UE-MCP:** `npm install --ignore-scripts` then `npx tsc -p tsconfig.json` in `<UPSTREAMS>\ue-mcp`. Do **not** run `npm run build` (it targets UE-MCP's own test project).
- **Hayba:** `npm install --ignore-scripts` in `<UPSTREAMS>\hayba`, then `npm --prefix mcp-tools/hayba-mcp run build`.
- **UnrealAgentPlayer:** create a venv in `mcp-server` with the Windows Python and install it editable (`python -m venv .venv`, `.venv\Scripts\python.exe -m pip install -e .`). Verify with a small script that imports `unreal_agent_player`. Do not run a Linux-side Python here.

## 4. Install the plugins into the project

Copy each plugin folder into `<PROJECT>\Plugins\<Name>` without `.git`:

| Source | Destination name |
|---|---|
| `<UPSTREAMS>\unrealagentplayer\Plugin` | `UnrealAgentPlayer` |
| `<UPSTREAMS>\claireon` | `Claireon` |
| `<UPSTREAMS>\enginewire\plugins\EngineWire` | `EngineWire` |
| `<UPSTREAMS>\ue-mcp\plugin\ue_mcp_bridge` | `UE_MCP_Bridge` |
| `<UPSTREAMS>\hayba\unreal\HaybaMCPToolkit` | `HaybaMCPToolkit` |

Enable each in `<PROJECT>\<Project>.uproject` under `Plugins` (`"Enabled": true`). Keep the existing entries.

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
  RemoteExecutionMulticastBindAddress=0.0.0.0
  RemoteExecutionMulticastTtl=1
  ```
  The default bind address (`127.0.0.1`) and TTL (`0`) stop the ping from reaching the editor.
- **Editor setting (manual).** Project Settings → Plugins → Remote Control → Security → **Allow Any Remote Function Call**. UE 5.8 defaults this off, and UnrealAgentPlayer's calls fail until it is on. **USER** must tick it in the editor; it is a per-user setting and is not reliably writable from config.

## 6. Build the editor target

Stop any running editor first, and stop Live Coding (Ctrl+Alt+F11 in the editor, or close it). `UnrealBuildTool` refuses to build while Live Coding is active, and `-DisableLiveCoding` does not get around it.

```
"<ENGINE>\Engine\Build\BatchFiles\Build.bat" <Project>Editor Win64 Development -Project="<PROJECT>\<Project>.uproject" -WaitMutex -NoEngineChanges
```

Expected: `Result: Succeeded`. Check the log, not just the exit code. A first build takes several minutes.

## 7. Start the editor and find its PID

Start the project in the editor. Wait until it is idle. Find the process whose command line includes `<Project>.uproject`, and note its PID. This PID changes on every restart.

Read the ports the editor actually bound (`Get-NetTCPConnection -OwningProcess <PID>` in PowerShell). Expect:

- UAP RC HTTP port (the log line "RC HTTP port <n> already bound from config").
- EngineWire native MCP on the port set in step 5.
- Claireon direct MCP port from `<PROJECT>\Saved\Claireon\MCPServer.json` (created when Claireon's server starts; open its Diagnostics tab to start it).
- Hayba's native TCP port.

**USER:** if Claireon's server does not start, open its Diagnostics tab in the editor.

## 8. Write the gateway config

Create `<NEXUS_ROOT>`-adjacent `nexus.config.json` (keep it outside the repo). Fields that change per machine: `target.processId`, `target.projectRoot` (the `.uproject` path), each backend's `sourceRoot`, transport command and args, and ports. Use `examples/config.authoring.example.json` as the template. Start with `"allowWrites": false` and `enabledPacks` limited to the packs you need; enable writes only after read-only checks pass.

Secrets: pass the EngineWire token through a launcher script that reads the file (see section 9), not through the config file.

## 9. Launcher (Windows)

A small `.cmd` that reads the token from the file and runs the gateway with Windows Node:

```
@echo off
set /p NEXUS_ENGINEWIRE_TOKEN=<"<PROJECT>\Saved\MCP\capability-token"
"C:\Program Files\nodejs\node.exe" "<NEXUS_ROOT>\src\main.mjs" --config "<config path>"
```

Register it with the agent client as a stdio server whose command is `cmd.exe` with args `/c <launcher path>`.

## 10. Verify, in order

1. **Status (read-only, no backends started):** `nexus.status` should list the enabled providers and no error.
2. **UE-MCP:** a read-only `actor.inspect.editor` on a path that does not exist should return "No actor at …" from the editor. That response proves the round trip.
3. **EngineWire:** `POST` to its `/mcp` with the header `X-MCP-Capability-Token` returns `initialize`; without it, 401.
4. **UAP:** the RC call `GetPluginVersion` on `/Script/UnrealAgentPlayer.Default__UAPAgentSubsystem` returns a version; a Python exec returns the engine version.
5. **Nexus `pie.status`:** should pass. If it returns `IDENTITY_UNPROVEN`, see troubleshooting.

Only after all of these: enable writes, and run one write test that the user approves.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `enginewire.headerEnv … must be a nonempty string` | Token not in the gateway process environment | Use the launcher (section 9) |
| EngineWire log: "Failed to bind … 3000" | Port 3000 in use | Set `NativeMCPPort` to a free port (section 5) |
| UAP: "not allowed by remote control settings" | Allow Any Remote Function Call is off | Tick it in the editor (section 5) |
| UAP: `UE_REMOTE_EXEC_OFF` | Python remote exec not answering | Check bind address and TTL (section 5), then restart the editor |
| `Live Coding is active` at build | Live Coding running | Stop it, then build |
| `pie.status` → `IDENTITY_UNPROVEN` | UAP RC object missing (`/Engine/Transient.UAPAgentSubsystem_0`) | Open issue; see project notes |
| Tools missing in the agent after config change | Stale session | Restart the agent client |

## 12. Do not

- Commit `Saved\`, `Intermediate\`, `Binaries\`, `DerivedDataCache\` or the capability token.
- Run upstream build scripts that touch the engine tree.
- Run the editor build without `-NoEngineChanges`. Always pass that flag.
- Use an agent to close the user's editor without asking. Closing can lose unsaved work.
