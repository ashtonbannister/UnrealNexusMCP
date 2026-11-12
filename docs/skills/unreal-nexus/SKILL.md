---
name: unreal-nexus
description: Use Unreal Nexus MCP to discover, plan, and execute Unreal Editor workflows through its selected providers; also guide integration of missing upstream functions.
---

# Unreal Nexus

Nexus aims to offer comprehensive Unreal functionality through one MCP coordinator, selecting the strongest implementation for each semantic function and preserving meaningful variants. The current catalogue is an incomplete implementation of that goal. Do not claim that every upstream function is currently callable or native-qualified.

## Discover and execute

1. Establish the user's intended project, running editor instance, world/client, requested changes and whether they should be saved. Preserve existing work and distinguish the current editor from PIE.
2. Use MCP `tools/list` and `nexus.status` to discover enabled operations and runtime state. Use `nexus.search` with a short intent query to search canonical operations and the static upstream inventory, paging with `nextOffset`; source records are not callable operations. EngineWire results may include source-derived summaries and topics, which are discovery aids rather than selected routes. `nexus.describe` with `{ "id": "..." }` gives a selected operation's schema, provider, scope and postconditions. Use `nexus.plan` with `{ "id": "...", "arguments": { ... } }` to validate and preview without dispatch. Discovery and planning do not start backends.
3. Read `unreal-nexus://guidance/enabled` and the `nexus_workflow` prompt for the selected operation. The full draft is `unreal-nexus://guidance/master`; `unreal-nexus://catalog/enabled` and `unreal-nexus://runtime/status` expose current catalogue and status. Use the returned schema, not a remembered signature.
4. Call the selected canonical operation with explicit parameters. Preserve returned content blocks, images, warnings, partial results, native errors and metadata. Check the actual result and relevant editor state; distinguish accepted, completed, verified and persisted. A viewport capture may foreground the editor; its requested resolution is a downscale bounding box.
5. If a mutation times out, disconnects or has an ambiguous post-dispatch outcome, do not retry, switch providers or claim rollback. Preserve the receipt and reconcile the actual editor state. A gateway queue coordinates only its own process, not other gateways or direct clients.

## Direct provider access

An agent may also connect to an individual upstream MCP directly when the user requests it or the task calls for an upstream function that Nexus has not routed. The coordinator is not a required intermediary. When useful, consult Nexus `nexus.search`, `nexus.describe`, its guidance resources, or the local catalogue and provider decisions to find and understand a function before using the provider directly. Discovery and planning do not start backends. Discover that provider's actual advertised tools and schemas, use the intended editor/project, and follow the provider's own consent and operation semantics. Do not use a direct client to evade a specific refusal, an unresolved post-dispatch outcome, or the user's scope. Direct clients and separate gateways do not share the Nexus queue or its ownership state; coordinate their effects and reconcile uncertain outcomes explicitly. Do not silently claim that a direct-provider result was executed or qualified through Nexus.

## Missing or unavailable functions

Do not mistake an absent Nexus tool for an absent Unreal or upstream capability. Report whether it is disabled, held, not yet routed, or unavailable at the connected editor. When development is in scope, inspect the pinned upstream implementation, schema and semantics, choose the best implementation for the requested function, and integrate a fixed canonical contract across catalogue, routing, result handling, guidance and appropriate verification. Preserve distinct useful variants and upstream licence notices. Never expose an unrestricted backend, Python or console escape as a substitute for routing the requested function.

Use authoritative upstream documentation and source to map capabilities efficiently; do not require a manual test of every upstream command merely to discover it. The [UE-MCP configuration reference](https://github.com/db-lyon/ue-mcp/blob/main/docs/configuration.md) documents its search and describe interfaces, and [EngineWire's tools reference](https://github.com/ChiR24/Unreal_mcp/wiki/Tools-Reference) describes its search/describe/execute model. These links may describe newer versions: verify signatures and behavior against the immutable revisions in [upstreams.lock.json](../../../catalog/upstreams.lock.json) before changing Nexus. Representative live workflows and relevant failure cases are needed to verify coordinator integration; documentation and fixture tests alone do not prove loaded native behavior.

## Task references

Read only the relevant sections of [master workflow guidance](../../MASTER_SKILL_GUIDANCE_DRAFT.md): section 1 discovery; 2 PIE; 3 images; 4 actors; 5 persistence; 6–7 PCG; 8 input; 9 compilation; 10 materials; 11 automation; 12 profiling; 13 graphs and UI; 14 imports and assets; 15 specialist authoring; 16 recovery and qualification. Use [operations.json](../../../catalog/operations.json) for current canonical contracts, [decisions.json](../../../catalog/decisions.json) for provider choices, and [capability-coverage.json](../../../catalog/capability-coverage.json) as a source inventory, not a count of callable functions. The [roadmap](../../../MASTER_ROADMAP.md) and [capability backlog](../../CAPABILITY_BACKLOG.md) track remaining work; [runtime setup](../../RUNTIME_SETUP.md) explains configuration and provider identity.

Offline, `npm run catalog -- list <query>`, `npm run catalog -- describe <id>`, and `npm run catalog -- plan <id> '<JSON>'` inspect or preview the local catalogue without contacting a backend. Offline catalogue entries may not be enabled or available in the live server. Consult [qualification plan](../../QUALIFICATION_PLAN.md) when recording native evidence; source pins, process identity, listener ownership, loaded binaries and live behavior are distinct evidence.
