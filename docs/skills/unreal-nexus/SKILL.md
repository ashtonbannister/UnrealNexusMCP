---
name: unreal-nexus
description: Use the unified Unreal Nexus MCP to discover and execute the full toolsets of its configured providers through one entrypoint, or use its compatible canonical Unreal Editor workflows.
---

# Unreal Nexus

Use one Nexus registration for the complete advertised toolsets of configured UE-MCP, EngineWire and optional providers. Public tool names use `<provider>__<original-name>`; arguments, schemas and results retain their provider-native contracts. Use existing canonical IDs when their scoped workflows fit the task. Their catalogue does not limit the namespaced provider interfaces.

Treat this document as a bundled workflow draft, not an installed personal skill. Distinguish complete MCP routing from native Unreal qualification: a discovered tool is not evidence that every native operation has been exercised in the current engine/project.

## Discover and execute

1. Establish the user's intended project, running editor instance, world/client, requested changes and whether they should be saved. Preserve existing work and distinguish the editor from PIE.
2. Request MCP `tools/list` for the complete combined manifest and `nexus.status` for runtime state. Full discovery connects configured providers and requires their live editor endpoints. Read `unreal-nexus://guidance/providers` for upstream initialization instructions and namespace translation. Use each provider's namespaced search/describe interface to discover inner actions, including actions without canonical routes.
3. For a canonical workflow, use `nexus.describe` with `{ "id": "..." }` and `nexus.plan` with `{ "id": "...", "arguments": { ... } }`. Read `unreal-nexus://guidance/enabled` or the `nexus_workflow` prompt for that operation. Canonical planning does not dispatch or start a provider. Obtain exact schemas from the current manifest or description rather than recalling parameter names.
4. Invoke the namespaced provider tool or enabled canonical ID with explicit parameters. Add the namespace only to the public MCP name; keep inner category, method, action and tool values unchanged. Preserve returned content blocks, images, structured results, warnings, native errors and metadata. Distinguish accepted, completed, verified and persisted work; read back the editor state that matters.
5. If a mutation times out, disconnects or has an ambiguous post-dispatch outcome, preserve the receipt and reconcile actual state before another attempt. Do not switch providers to replay uncertain work or claim rollback. All Nexus calls share its process-local queue; other processes and native events remain independent.

For currently materialized PIE and Game worlds, use `play.worlds.list` when enabled; its results do not establish lifecycle ownership or rule out a queued start.

## One entrypoint, full provider interfaces

Register only Nexus using [the unified client example](../../../examples/unified.claude.example.json) and configure provider connections in [the unified host example](../../../examples/config.unified.example.json). Replace its example paths, ports and project with the installed values. The old `direct-providers.claude.example.json` path also contains a single Nexus registration. Do not register separate provider servers merely to reach functions outside the canonical catalogue.

Keep `providerTools: true` (the default). Every configured backend contributes its actual live manifest regardless of canonical pack selection. With `allowWrites: false`, all tools remain listed but only provider tools advertising `annotations.readOnlyHint: true` may execute. Multipurpose gateway tools require writes enabled; the user's task still determines the authorized scope.

| Provider | Nexus entrypoint | Discover and use |
| --- | --- | --- |
| UE-MCP | `ue-mcp__tools` | Use the original `guide`, `search`, `describe` and `call` actions, category, method and args. |
| EngineWire | `enginewire__unreal` | Use the advertised search/describe/execute/configure interface and original capability or tool/action selectors. |
| Claireon | `claireon__tool_search`, `claireon__python_execute` | Search first and use the exact advertised execution schema and native semantics. |
| Hayba | `hayba__<original-name>` | Use the advertised search, signature, invoke and pack tools; preserve original inner names. |
| UnrealAgentPlayer | `unrealagentplayer__<original-name>` | Use the actual named tools, starting with `unrealagentplayer__bridge_status` where advertised. |

Treat the live manifest as authoritative if provider modes expose additional names. Nexus preserves provider-native functionality instead of requiring a separate canonical adapter for each inner action.

Use namespaced prompts as `<provider>__<original-name>`. Read provider resources and templates through `unreal-nexus-provider://<provider>/<original-uri>`; for example, EngineWire's `ue://health` is `unreal-nexus-provider://enginewire/ue://health`. Keep the provider's original content and inner references intact; apply the wrapper when making a routed resource request.

Use actual editor ports and runtime credentials from the host configuration. Claireon records its port in `Saved/Claireon/MCPServer.json`; EngineWire's token is in `Saved/MCP/capability-token`; Hayba uses its native TCP listener; UAP uses the editor's Remote Control port and Python remote execution. Never paste tokens into tracked files. A new editor process requires a new target identity and may use new ports.

For HTTP clients, unified mode retains MCP sessions and initialized client capabilities so provider callbacks, including elicitation, can reach the connected client. The client must support the callback requested by the provider. All sessions still share the configured project and Nexus queue.

## Missing or unavailable functions

Check whether a missing tool's provider is configured, `providerTools` is enabled, its connection/identity succeeded, and its actual manifest advertises that tool. For an inner action, use the provider's own discovery interface. A missing canonical route does not make its provider-native equivalent unavailable. Report disabled provider features, unsupported upstream actions and actual connection failures precisely.

Do not treat static source-inventory entries as executable tool names. When an upstream tool is present but absent from the combined manifest, fix the forwarding defect rather than adding another narrow canonical wrapper or requiring a separate client registration. Add a canonical workflow only when its distinct validated contract is useful and development is requested. Preserve provider contracts, meaningful variants and licence notices.

Use authoritative upstream documentation and source for capability lookup; do not manually exercise every command merely to discover it. [UE-MCP's configuration reference](https://github.com/db-lyon/ue-mcp/blob/main/docs/configuration.md) and [EngineWire's tools reference](https://github.com/ChiR24/Unreal_mcp/wiki/Tools-Reference) may describe newer versions. Check changes against [the pinned revisions](../../../catalog/upstreams.lock.json). Fixture tests establish host forwarding behavior; native evidence establishes what the installed editor actually did.

## Efficient command lookup

- Use `tools/list` and the namespaced provider search/describe tools for complete live discovery. Use `nexus.status` to inspect connections, canonical enablement and shared queue state.
- Use `nexus.search` with a short query such as `{"query":"spawn actor","limit":20}` to inspect canonical operations and static source records. Follow `nextOffset` with `offset`. `kind: canonical` identifies a canonical ID; `kind: source-record` is an inventory item, not a callable public tool name.
- Use `nexus.describe_source` with the returned `provider`, `surface` and `sourceEntry` for pinned provenance and canonical bindings. An absent binding does not remove the original provider action from its namespaced gateway.
- Use `nexus.describe` and `nexus.plan` only for canonical IDs. For example, plan `actor.list.editor` with `{"nameFilter":"Example","limit":10}`, adjusted to its current schema, then invoke that canonical ID. Provider calls use their own original schemas and discovery interfaces.
- Compare native semantics when two providers offer similar actions. Preserve target, save scope, output shape and useful variants; a common action name does not make implementations interchangeable.

## Practical workflows

- **Actors:** discover in the intended editor/PIE world, use returned paths, then place, inspect, transform or manage tags as requested. The canonical `actor.delete.editor` requires the checked native patch and an exact loaded actor path; independently check the world afterward. Labels can be duplicated; placement receipts may not prove mesh, material, transform or resolved world. Read back what matters.
- **Assets and graphs:** canonical `blueprint.create` creates and compiles one Blueprint and may save according to editor settings. Canonical `blueprint.variable.add` adds, compiles and saves one variable. Identify the exact asset and graph/node/pin before editing. Use the namespaced provider interfaces for their complete graph/asset functionality and follow their own persistence semantics. A request not to save excludes explicit save commands.
- **Play, input and observation:** distinguish the editor viewport from a particular PIE client, verify play state and target, preserve image blocks and release only holds or sessions the task owns. Screenshot size can be a bounding box; capture may foreground the editor.
- **Compilation, tests and profiling:** use an appropriate canonical route or namespaced provider tool. Preserve diagnostics, progress, warnings and partial results. A successful dispatch is not necessarily completed work.
- **Recovery:** record the exact target and receipt. Reconcile an uncertain post-dispatch outcome before any retry; timeout, cancellation and inverse descriptors do not prove rollback. The queue coordinates this Nexus runtime only.

Apply canonical holds, patches and extra postconditions to their corresponding canonical routes. Follow the original provider contract for namespaced calls. Use the live schema instead of inventing parameter names or assuming that a static source record is itself callable.

## Task references

Read relevant sections of [master workflow guidance](../../MASTER_SKILL_GUIDANCE_DRAFT.md): section 1 discovery; 2 PIE; 3 images; 4 actors; 5 persistence; 6–7 PCG; 8 input; 9 compilation; 10 materials; 11 automation; 12 profiling; 13 graphs/UI; 14 imports/assets; 15 specialist authoring; 16 recovery/qualification. Use [operations.json](../../../catalog/operations.json) for canonical contracts, [decisions.json](../../../catalog/decisions.json) for canonical provider choices, and [capability-coverage.json](../../../catalog/capability-coverage.json) as a source inventory. The [roadmap](../../../MASTER_ROADMAP.md) and [capability backlog](../../CAPABILITY_BACKLOG.md) describe canonical development; [runtime setup](../../RUNTIME_SETUP.md) explains the full provider interface and identity checks.

Use offline `npm run catalog -- list <query>`, `describe <id>` and `plan <id> '<JSON>'` to inspect the canonical catalogue without connecting providers. Obtain the complete provider surface from live MCP discovery. When recording native evidence, use the [qualification plan](../../QUALIFICATION_PLAN.md) and distinguish source pins, process identity, listener ownership, loaded binaries and observed behavior.
