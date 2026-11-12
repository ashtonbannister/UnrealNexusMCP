# Checked actor deletion: 2026-11-12

The `ue-mcp-nexus-checked-delete-v1` candidate extends the reviewed owned-hold
patch. For an actorPath request, the native handler refuses a missing or
non-exact resolved path, checks the return value of Unreal's `DestroyActor`,
and returns the resolved path and a versioned acknowledgement. A successful
receipt is not a saved-level guarantee or an independent world readback.
Recreating an actor is lossy and is not rollback.

After preserving upstream CRLF line endings, the candidate rebuilt and the same live create/delete/readback succeeded. The candidate built in `NexusDeleteHost.uproject` with Unreal Engine 5.8.4 and
`-NoEngineChanges`. The candidate UE_MCP_Bridge DLL SHA-256 was
`3606d54499fcc4d55efdf038026e839ecd6a124ad05dd39564cbe5eb8020d35f`.
A separate candidate source checkout matched the recorded patch hashes. Its
TypeScript server reused the unchanged owned-hold-v1 build.

Through the candidate Nexus coordinator, one transient static-mesh actor was
created in the disposable editor, resolved by its returned actor path, deleted,
and then absent in a separate actor-list read. No save was requested. The fixture
editor canceled a graceful close because its temporary map became dirty again
after discard; the identified disposable editor process was stopped without
saving. The Henday Heat editor remained running and its plugins were not changed.

This is one positive live observation, not full native qualification. Unloaded
World Partition actors, native refusal, race and failure cases were not
individually live-tested. The selected route requires the exact source patch and
the live native `nexus-checked-actor-delete-v1` marker.

The separate candidate source is D:/NexusTools/upstreams/ue-mcp-checked-delete-v1-wip; the staged plugin is D:/NexusTools/staging/ue-mcp-checked-delete-v1-wip/UE_MCP_Bridge. Its staged DLL matched the tested hash. The earlier staged update remains unchanged.
