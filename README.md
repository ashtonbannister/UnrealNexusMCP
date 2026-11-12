# Unreal Nexus MCP

**One MCP entrypoint for the complete UE-MCP and EngineWire toolsets, with the
existing Nexus canonical operations preserved.**

Nexus publishes every tool advertised by each configured provider. Tool names
are namespaced as `<provider>__<original-name>`; provider input/output schemas,
descriptions, annotations and call results retain their original contracts.
Calls use the existing provider implementations and connections. Clients register
only Nexus, and do not need separate UE-MCP, EngineWire or specialist entries.

The namespaced surface is enabled by default with `providerTools: true`. The
42-operation canonical catalogue remains available through its existing packs
and IDs, but does not limit the provider toolset. Configured Claireon, Hayba and
UnrealAgentPlayer tools are exposed by the same mechanism.

The combined base uses the pinned upstream revisions in
`catalog/upstreams.lock.json`:

| Provider | Source revision |
|---|---|
| UE-MCP | `da2c0fb5b49b3ef0dc3aba2c761155e40e8fcce8` |
| EngineWire | `2792ba198403bf0842a6cd91f87113d9d86db8e3` |

## Run the unified server

Use Node.js 22 or newer and Git. SDK dependencies are locked in `package-lock.json`.

```sh
npm ci --ignore-scripts
npm run build
node src/main.mjs --config C:/Tools/NexusConfig/nexus.config.json
```

Create the configuration from
[config.unified.example.json](examples/config.unified.example.json), replacing
the project file, provider checkout paths, executable paths and endpoint with
your installed values. The example enables the complete toolsets of both
UE-MCP and EngineWire, and the compatible canonical authoring/observation packs.
It explicitly enables writes. For read-only access, set `allowWrites: false`:
all tools remain discoverable, but only tools advertising
`annotations.readOnlyHint: true` may execute through the provider surface.
Multipurpose gateway tools and tools without that annotation require writes to
be enabled.

Install the pinned provider servers and native plugins using the
[runtime setup guide](docs/RUNTIME_SETUP.md). Nexus reuses them; it does not
replace their native implementations or install them into an Unreal project.
With the editor running, export its EngineWire capability token as
`NEXUS_ENGINEWIRE_TOKEN` before launching Nexus. Keep tokens out of config files.

Register this **one** entry in the MCP client:

```json
{
  "mcpServers": {
    "unreal-nexus": {
      "command": "node",
      "args": [
        "C:/Tools/UnrealNexusMCP/src/main.mjs",
        "--config",
        "C:/Tools/NexusConfig/nexus.config.json"
      ]
    }
  }
}
```

[unified.claude.example.json](examples/unified.claude.example.json) contains this
client configuration. The old `direct-providers.claude.example.json` path now
contains the same single entry for migration. Remove separately registered
provider entries when adopting Nexus to avoid duplicate tool surfaces and
independent connections.

The command serves MCP over stdio and waits for a client; it is not an
interactive terminal prompt. [config.example.json](examples/config.example.json)
is a provider-free starter for inspecting Nexus controls and guidance. Local
authenticated HTTP is also supported by the same entrypoint; see the setup guide.

Full provider mode negotiates the supported 2025 MCP protocols so native
interactive approvals resume the original call. Automatic-negotiation clients
fall back to that protocol; modern-only clients receive an explicit version
refusal. Nexus does not replay a mutation to emulate a modern continuation.
Unified HTTP mode retains initialized client sessions and capabilities for
provider callbacks such as elicitation. All sessions share one configured
runtime and queue; canonical-only mode retains its legacy stateless handling.

## Complete provider tools and compatible canonical tools

| Provider tool | Name exposed by Nexus | Contract |
|---|---|---|
| UE-MCP `tools` | `ue-mcp__tools` | Original discovery, category, method and argument interface |
| EngineWire `unreal` | `enginewire__unreal` | Original operation, tool, action and params interface |
| Any additional advertised tool | `<provider>__<original-name>` | Original input/output schemas and result |
| Enabled Nexus canonical operation | Existing canonical ID | Existing selected route, validation and postconditions |

The prefix applies only to the public MCP tool name. Arguments identifying an
inner category, method, action or tool remain in the provider's original format.
Provider meta-tools retain their full functionality; Nexus does not filter their
inner actions to the canonical catalogue. Identically named tools from different
providers remain independently callable under their respective namespaces.

Provider prompts use the same `<provider>__<original-name>` namespace. Provider
resources and resource templates use
`unreal-nexus-provider://<provider>/<original-uri>`; for example, EngineWire's
`ue://health` is read through
`unreal-nexus-provider://enginewire/ue://health`. Nexus forwards prompt/resource
requests to the original provider and preserves their returned contents. The
resource `unreal-nexus://guidance/providers` includes upstream initialization
instructions and the namespace mapping.

`tools/list` obtains the complete live manifests from configured providers,
including paginated manifests. This can start a provider process or connect to
the editor. The editor and configured endpoints must be available to discover
the full live toolset. `nexus.status` and the existing planning/guidance controls
remain available independently of a successful provider discovery.

Set `providerTools: false` only to request the legacy canonical-only surface.
Canonical pack selection does not remove provider tools while full mode is on;
configure only the backends you intend to expose.

## Nexus controls

| Surface | Purpose |
|---|---|
| `nexus.status` | Enabled operations, provider connections, identity evidence and queue state |
| `nexus.search` | Search canonical operations and the static source inventory |
| `nexus.describe_source` | Inspect a pinned source record and its canonical bindings |
| `nexus.describe` | Read one canonical route, schema, effects and postconditions |
| `nexus.plan` | Validate a canonical call without dispatching it |
| `unreal-nexus://guidance/master` | Master guidance draft for canonical workflows |
| `unreal-nexus://guidance/enabled` | Guidance for enabled canonical capabilities |
| `unreal-nexus://guidance/providers` | Original provider instructions and namespace translation |
| `unreal-nexus://catalog/enabled` | Enabled canonical catalogue |
| `unreal-nexus://runtime/status` | Runtime status |
| Prompt `nexus_workflow` | Workflow for one enabled canonical capability |

The historical selection documents describe the canonical layer. Their
canonical-only allowlist does not restrict the complete namespaced provider
surface. Provider-native tools use their own schemas and semantics; canonical
holds and specialized postconditions remain properties of the corresponding
canonical routes.

## Canonical capability packs

| Pack | Canonical operations | Provider(s) | Canonical requirement |
|---|---:|---|---|
| `authoring-core` | 14 | UE-MCP | Reviewed compatibility patch and live schema parity |
| `editor-observation` | 1 | EngineWire | Direct editor-owned HTTP endpoint |
| `playtesting` | 9 | UnrealAgentPlayer + UE-MCP | Owned PIE and input patches |
| `blueprint-compile` | 3 | Claireon | Loaded-compile patch and direct endpoint |
| `material-strict` | 3 | Hayba | Native receipt and no-retry patch |
| `automation-tests` | 2 | Claireon | Owned run and terminal receipt |
| `insights-analysis` | 6 | Claireon | Owned capture/readers |

All canonical packs are off unless explicitly configured. Enable individual
canonical IDs with `enabledCapabilities`. Their compatibility requirements and
existing held operations are unchanged. See [compatibility patches](patches/README.md).

## Targeting, contracts and execution

Nexus pins the configured source revisions and exact `.uproject`/editor process
identity, corroborating the target through provider-native evidence or an
editor-owned listener. Local Windows and Linux inspection are supported, subject
to provider platform requirements. Source hashes do not independently prove
which compiled native plugin the editor loaded.

Provider calls preserve returned content blocks, images, structured output,
warnings and `isError` results. Existing canonical calls continue to use their
specialized adapters. Calls share the runtime's serialized queue; Nexus does not
automatically retry mutations, switch providers or replay a call after an
uncertain transport failure. Cancellation after dispatch is not a rollback.
Reconcile uncertain native work before deliberately restarting the runtime.

The integration checks use real MCP clients with fixture provider processes and
HTTP endpoints. Full native Unreal qualification remains pending; a successful
host build or fixture round trip is not a claim that every native operation was
executed in Unreal. This repository retains prior live editor observations in
the qualification records.

## Focused verification and offline catalogue

```sh
npm run build
npm run test:integration
npm run catalog -- list
```

The `.mjs` host needs no transpilation; the build validates production JavaScript and
the pinned catalogue. It does not compile native Unreal plugins. The targeted integration
checks exercise the unified manifest and call
contracts. The offline catalogue CLI covers canonical operations only; the full
provider manifest comes from the running providers.

- [Runtime setup and supported transports](docs/RUNTIME_SETUP.md)
- [Windows installation guide](docs/INSTALL_AGENTS.md)
- [Pinned upstream revisions](catalog/upstreams.lock.json)
- [Canonical implementation decisions](docs/IMPLEMENTATION_SELECTION.md)
- [Canonical operations](catalog/operations.json) and [source evidence](catalog/decisions.json)
- [Master skill guidance draft](docs/MASTER_SKILL_GUIDANCE_DRAFT.md)
- [Validation record](docs/VALIDATION.md)
- [Native qualification plan](docs/QUALIFICATION_PLAN.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
