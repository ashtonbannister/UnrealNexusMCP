# Unreal Nexus MCP

**One canonical tool set. One reviewed winning implementation per function.
Only the backends needed by enabled capabilities. Optional specialists.**

Nexus is an MCP gateway with a curated catalogue of **29 canonical operations**.
It serves local stdio or authenticated loopback HTTP, starts selected backend
connections on first execution, and applies the
[master skill guidance draft](docs/MASTER_SKILL_GUIDANCE_DRAFT.md) through MCP
instructions, resources and a workflow prompt.

The protocol integration is tested with real MCP clients and fixture backends.
**Native Unreal compilation and live editor qualification remain pending.** This
repository does not merge or install the upstream Unreal plugins.

## Start the gateway

Use Node.js 22 or newer and Git. SDK dependencies are locked in `package-lock.json`.

```sh
npm ci --ignore-scripts
npm run check
node src/main.mjs --config examples/config.example.json
```

The example starts a stdio MCP server with every editor capability off. It waits
for an MCP client on stdin; it is not an interactive terminal prompt. You can
already discover the master guidance and use the read-only Nexus controls.

To execute Unreal operations, copy and edit
[the authoring configuration](examples/config.authoring.example.json), install
the pinned upstream backends, and set the exact project file, live editor PID,
source checkout paths, endpoints and credentials. Follow the
[runtime setup guide](docs/RUNTIME_SETUP.md). Writes remain off until the host
configuration explicitly enables them. No backend starts during discovery,
resource reads, prompts or planning.

For an MCP client that launches commands, use an absolute executable and paths:

```json
{
  "mcpServers": {
    "unreal-nexus": {
      "command": "node",
      "args": [
        "C:/Tools/UnrealNexusMCP/src/main.mjs",
        "--config",
        "C:/Tools/UnrealNexusMCP/nexus.config.json"
      ]
    }
  }
}
```

This is a local host configuration example. Connecting a remote hosted client
requires a separately designed deployment/authentication boundary; this change
does not publish a public service.

## Public MCP surface

| Surface | Purpose |
|---|---|
| Enabled canonical tools | The exact reviewed operations in `catalog/operations.json` |
| `nexus.status` | Enablement, loaded backends, identity evidence and queue state |
| `nexus.describe` | Selected route, source pin, schema, effects and postconditions |
| `nexus.plan` | Validate and preview a call, with `dispatched: false` |
| `unreal-nexus://guidance/master` | The complete master guidance draft |
| `unreal-nexus://guidance/enabled` | Governing rules and workflows for enabled capabilities |
| `unreal-nexus://catalog/enabled` | The enabled canonical catalogue |
| `unreal-nexus://runtime/status` | Read-only runtime status |
| Prompt `nexus_workflow` | The appropriate workflow for one enabled capability |

The master document is loaded and its section mapping checked when the runtime
starts. Its SHA-256 is reported in status. It remains a draft, not an installed
personal skill. Nexus exposes no raw provider multiplexer, arbitrary Python,
console command, configuration mutation or uncertainty-reset tool.

## Capability packs

| Pack | Canonical operations | Selected backend(s) | Additional condition |
|---|---:|---|---|
| `authoring-core` | 7 | UE-MCP | Live micro-mode handler/schema parity |
| `editor-observation` | 1 | EngineWire | Direct editor-owned HTTP endpoint |
| `playtesting` | 8 | UnrealAgentPlayer + UE-MCP | Reviewed UAP no-replay/target-binding patch |
| `blueprint-compile` | 2 | Claireon | Reviewed no-autosave patch; direct editor endpoint |
| `material-strict` | 3 | Hayba | Reviewed no-retry patch; fixed native port; typed tools |
| `automation-tests` | 2 | Claireon | Same compatibility patch; owned run and terminal receipt |
| `insights-analysis` | 6 | Claireon | Same compatibility patch; owned capture/readers |

Every pack is off by default. Individual capability IDs can be enabled instead
of packs. Enabling a capability registers its backend factory; only executing
that capability connects or starts the backend. Failed startup is cached instead
of being silently retried. Specialists that are never enabled or used do not
start their backend servers.

The first 16 operations remain the core set. Thirteen fixed specialist adapters
implement the compile, material, test and trace workflows. They verify source
patches and live capability markers before using those paths. The stock upstream
versions do not satisfy all of these contracts; merely setting a config flag is
insufficient. See [compatibility patches](patches/README.md).

## Targeting and execution

The host pins an exact `.uproject` file and an OS process start identity, then
corroborates that target with native PID/project evidence or a direct
editor-owned listener. The runtime currently supports local Windows and Linux
identity inspection. Backend-specific platform restrictions still apply.

Source verification checks the pinned Git revision, tracked changes, unignored
new files and exact reviewed compatibility deltas. **It does not independently
prove which compiled DLL or ignored build output the editor loaded.** Live schema
markers and handler parity add checks; final native build provenance and engine
compatibility still need acceptance in the intended project.

All calls in one runtime share one serialized editor queue, including separate
HTTP requests. Preparation, native capability checks and dispatch have bounded
deadlines. Cancellation before dispatch prevents the operation; timeout,
disconnect or cancellation after dispatch leaves its outcome unknown and fences
further execution. Native queued lifecycle or contained-fault receipts can also
fence the queue. Received images, diagnostics, warnings and partial results are
preserved. There is no automatic mutation retry, provider failover or reset.

Reconcile uncertain work externally before deliberately restarting Nexus. A
request cancellation is not an Unreal rollback. The queue is local to one
gateway process and cannot coordinate other gateways, direct clients, game-thread
events or editor restarts atomically. Endpoint/identity checks reduce wrong-target
risk but are not an editor-native epoch lock.

## Offline catalogue

```sh
npm run catalog -- list
npm run catalog -- describe asset.save.exact
npm run catalog -- plan asset.save.exact '{"assetPaths":["/Game/Blueprints/BP_Demo"],"force":true}'
```

The offline CLI never connects to Unreal. It shows the complete reviewed
catalogue, while the MCP manifest shows only host-enabled operations.

## Selection policy and evidence

The catalogue contains 23 decision groups, 13 selected groups, six immutable
upstream source pins and 25 competing-default exclusions. A winner is selected
for its exact target, validation, completion, persistence and failure semantics.
New upstream releases are review candidates; routing does not follow floating
`latest` releases or fall back to a different implementation after a failure.

The original repository contained only `LICENSE`. Duplicate defaults are
excluded from Nexus's public allowlist; native function bodies were not deleted
from external repositories. Ivan's backend is not required by these 29 routes,
but its distinct capabilities are not declared universally redundant.

- [Runtime setup and supported transports](docs/RUNTIME_SETUP.md)
- [Master skill guidance draft](docs/MASTER_SKILL_GUIDANCE_DRAFT.md)
- [Implementation decisions](docs/IMPLEMENTATION_SELECTION.md)
- [Canonical operations](catalog/operations.json) and [source evidence](catalog/decisions.json)
- [Compatibility patch manifest](catalog/compatibility-patches.json)
- [Source audit inventory](docs/audit/inventory.md)
- [Validation record](docs/VALIDATION.md)
- [Live acceptance checklist](docs/INTEGRATION_ACCEPTANCE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
