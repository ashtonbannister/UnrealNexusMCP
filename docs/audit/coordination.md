# Coordination and lifecycle audit

Review date: 2026-10-26. Static inspection of six immutable revisions. No native
build, live concurrent-backend test or transport fault injection was performed.
Nexus is a dependency-free routing core; real backend transports remain deferred.

| Responsibility | Preferred approach | Boundary |
|---|---|---|
| Public routing | One canonical operation, lazy adapters, optional specialists | Compare semantics, not names |
| Native scheduling | EngineWire queue pattern | Preserve every backend's native guards |
| Mutation replay | Native idempotency plus conservative adapter policy | Timeout is not nonexecution |
| Resource coordination | Hayba lease model, conditionally | Candidate; cooperative identities |
| Edit sessions | Retain Claireon dependencies | Tool-owned is not agent-owned |
| Foreground/input | Retain UAP machine lock | Separate from asset/editor leases |
| Upgrades | Reevaluate newer pinned revisions | Never auto-select moving HEAD |

## Native enforcement must survive deduplication

EngineWire's [queue][EW-queue] uses fair batches, an explicit non-reentrancy guard
and state-revision validation immediately before dispatch. [Tick draining][EW-tick]
also waits out package saving, GC and async loading.

A gateway queue only controls its own process. It cannot police direct clients,
other gateways or user/editor changes. Preserve native validation, transactions,
game-thread fences and state checks. UE-MCP uses [ticker dispatch][UE-dispatch]
to avoid TaskGraph reentry during imports.

## Never replay an uncertain mutation

EngineWire's [ledger][EW-idempotency] distinguishes first execution, in-flight
work, completed replay and conflicting payloads; keys include principal and
capability.

Claireon's [proxy retry][CL-retry] retries HTTPException/OSError and HTTP 5xx once
with the same request, despite a timed-out operation potentially remaining
in-flight. Do not inherit this as the default mutation retry policy. This is a
source-supported duplicate-side-effect risk, not a live reproduction.

EngineWire's [proxy][EW-proxy] propagates transport exceptions and retries only
explicit stale-session HTTP 404. Its modern path ignores cancellation
notifications and omits resource subscriptions; do not claim complete parity.

Distinguish definite pre-dispatch refusal, ordinary returned failure and
post-dispatch uncertainty. Preserve task identity and report outcome_unknown
for unconfirmed outstanding work. Never switch providers. Cancellation is not
rollback. Nexus's native UAP queued-timeout fence preserves the receipt and
requires external reconciliation before a new gateway instance.

## Locks and sessions differ

Hayba's [lease policy][HAY-policy] offers nonblocking acquisition, bounded
waiters, expiry, aging/fairness and disconnected-owner recovery. [Owner
identity][HAY-owner] can come from the request envelope: it is a cooperative
label, not an authenticated per-agent principal. The pinned [README][HAY-status]
identifies these protections as 0.4.0 candidates under final validation.
Adopt conditionally with Nexus-controlled identities and live tests.

UE-MCP's [locking wrapper][UE-locks] is opt-in, can run without locks when no
target paths are identified, and can fail open when acquisition invocation
fails. Do not make it the master exclusion gate.

Claireon reuses an asset session when [ToolName matches][CL-session]. Agents
using one tool family are not distinct lock owners. Preserve sessions without
presenting them as cross-agent exclusion.

UAP's [machine hooks][UAP-machine] retain a sticky machine hold, fail closed
when coordination cannot be read, return newly acquired holds on failed start,
and release the project hold after confirmed stop. Preserve this separately.

## Lifecycle and persistence scope

Identify project/worktree plus editor process start epoch, not just PID.
Restart invalidates handles, snapshots, sessions and mutation preconditions;
rediscover capabilities.

Claireon's deferred map/PIE/reload path can [autosave all dirty world and
content packages][CL-save]. auto_saved_packages reports scope; it does not
narrow it. Do not normalize this as persistence-free.

## Licensing

UE-MCP, EngineWire, Claireon, UAP and Hayba roots are MIT. Preserve notices
and inspect bundled components separately. Ivan's root is Apache-2.0, but
[RQL][IV-RQL] and the [Code-Exec vendor note][IV-CodeExec] identify PolyForm
Shield terms. Do not wholesale copy those trees into an MIT bundle. An
external adapter is not legal clearance for every competitive use.

## Master guidance

Resolve exact identity; confirm live schemas; preserve native guards, sessions,
transactions and authorization. Keep asset, world/PIE and machine/input scopes
separate. Re-read stale state; preserve images/warnings/partial results and
task IDs. Declare autosave scope and stop when native health is unsafe.
New candidates stay pinned and unqualified until competing owners, stale state,
direct access, queued cancellation, late replies, restart and partial failures
have been exercised in a disposable project.

## Immutable source evidence

[EW-queue]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Core/Subsystem/EngineWireSubsystemRequestQueue.cpp#L164-L275
[EW-tick]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Core/Subsystem/EngineWireSubsystemLifecycle.cpp#L219-L230
[EW-idempotency]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Foundation/McpIdempotencyLedger.cpp#L38-L184
[EW-proxy]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/src/proxy/native-proxy.ts#L214-L279
[UE-dispatch]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/GameThreadExecutor.cpp#L220-L301
[UE-locks]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/dispatch/locking.ts#L133-L165
[CL-retry]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Content/Python/claireon_proxy.py#L2851-L2881
[CL-session]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/ClaireonSessionManager.cpp#L31-L100
[CL-save]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/ClaireonServer.cpp#L973-L1007
[HAY-policy]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/unreal/HaybaMCPToolkit/Source/HaybaMCPToolkit/Private/HaybaMCPLeasePolicy.h#L7-L56
[HAY-owner]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/unreal/HaybaMCPToolkit/Source/HaybaMCPToolkit/Private/HaybaMCPLeaseManager.cpp#L112-L138
[HAY-status]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/README.md#L17-L56
[UAP-machine]: https://github.com/ImagineTheGames/UnrealAgentPlayer/blob/4ab7a62eb78612c2ec110f683b6e11f5dea62e95/mcp-server/src/unreal_agent_player/tools/machine.py#L27-L70
[IV-RQL]: https://github.com/IvanMurzak/Unreal-MCP/blob/1fb60e84bf8bea8f3e5bf6c27737e79fd7940d07/UnrealMCP/Source/ThirdParty/RQL/LICENSE.md#L1-L37
[IV-CodeExec]: https://github.com/IvanMurzak/Unreal-MCP/blob/1fb60e84bf8bea8f3e5bf6c27737e79fd7940d07/UnrealMCP/Content/Python/unreal_mcp/_vendor/code_exec/VENDORED.md#L1-L8
