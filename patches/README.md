# Reviewed optional compatibility patches

These small source deltas adapt the pinned upstream behavior to Nexus's exact
contracts. They are not installed automatically. Their base revisions, artifact
hashes, before/after file hashes and live markers are recorded in
`catalog/compatibility-patches.json`.

| Patch ID | Why it is required | Rebuild/restart |
|---|---|---|
| `ue-mcp-nexus-owned-hold-v1` | Adds private-token owned local holds with independent per-frame injection; includes direct capture, guarded save and pagination. | Rebuild the UE-MCP native plugin and TypeScript server; restart both |
| `ue-mcp-nexus-direct-pie-v1` | Adds bounded exact-world PIE image capture and a dedicated server socket; includes guarded save and pagination. | Rebuild the UE-MCP native plugin and TypeScript server; restart both |
| `ue-mcp-nexus-guarded-save-v2` | Adds exact current-level save guarding and forbids external package deletion; includes pagination. | Rebuild the UE-MCP native plugin and TypeScript server; restart both |
| `ue-mcp-nexus-pagination-count-v1` | Actor listing must report a changed collection count even when its cursor anchor stays in place. Equal counts do not prove a snapshot. | Rebuild the UE-MCP native plugin and TypeScript server; restart both |
| `claireon-nexus-compile-loaded-v2` | Adds a fixed, already-loaded one-Blueprint no-save compile without expired-session cleanup; includes the no-autosave wrapper. | Rebuild Claireon and restart the editor |
| `claireon-nexus-no-autosave-v1` | The outer Python runner can autosave before a supposedly memory-only compile or read-only schema probe. Adds an explicit `nexus_skip_auto_save` flag and guards both outer autosave sites. Nexus always supplies true. | Rebuild the Claireon native plugin and restart the editor |
| `hayba-nexus-material-receipt-v2` | Adds exact native target and binary32/texture readback receipts plus a fixed read-only identity marker, retaining v1 no-retry behavior. | Rebuild the Hayba native plugin and TypeScript server |
| `hayba-nexus-no-retry-v1` | The TypeScript executor can retry a material mutation after transport failure. Classifies the mutation as non-idempotent, adds required typed `nexus_retry_policy="never"`, and strips it before native dispatch. | Rebuild/restart the Hayba TypeScript MCP server |
| `uap-nexus-owned-pie-v4` | Adds native request-correlated PIE ownership and an exact long-lived machine grant on top of v3. | Rebuild the UAP native plugin and restart the Python server and editor |
| `uap-nexus-queued-status-v3` | Queue-aware native PIE status, fixed preset and exact discovery, optional IPv4 interface, and the v1 no-replay/binding behavior. Does not establish lifecycle ownership. | Rebuild the UAP native plugin and restart the Python server and editor |
| `uap-nexus-no-replay-v1` | Python dispatch can replay at multiple layers and public exec_python checks the wrong success field. Adds a Nexus-only single-dispatch mode, exact project/editor-PID/RC binding and a live status marker. | Restart the Python MCP server from the patched source; native UAP installation is still required |

Other clients retain Claireon's default autosave behavior unless they explicitly
request the new flag. UAP's ordinary no-Nexus-env server construction retains its
stock behavior. Hayba's changed typed material route requires the new marker;
update callers of that patched direct route accordingly.

## Apply to a separate reviewed checkout

Start from the corresponding exact commit in `catalog/upstreams.lock.json` with
clean tracked source and no unignored additions. Preserve each upstream's Git
attributes and reviewed working-tree bytes; some files require CRLF. Apply the
applicable file:

```sh
git -C /absolute/path/to/Claireon apply --check /absolute/path/to/UnrealNexusMCP/patches/claireon-nexus-no-autosave.patch
git -C /absolute/path/to/Claireon apply /absolute/path/to/UnrealNexusMCP/patches/claireon-nexus-no-autosave.patch
```

Substitute the upstream checkout and patch file for Hayba or UAP. Keep the base
HEAD unchanged; source verification expects that HEAD plus the exact reviewed
delta, not a new local commit or an approximately similar edit. Rebuild/install
through the upstream's documented procedure, then set the matching
`compatibilityPatch` ID on that backend in Nexus's host configuration.

The flag alone is not proof. Before dispatch Nexus checks the base HEAD, reviewed
file hashes, unrelated source modifications and the actual live capability marker.
A stale plugin/server build fails the marker gate. The checkout verification does
not independently prove complete provenance of a loaded native binary; that
still belongs in live deployment acceptance.

The UAP patch permits retrying discovery/connections before a command is sent,
but does not resend a dispatched command after timeout, reset, EOF or crossed
response. Nexus mode binds both native channels from the host-injected
`NEXUS_UAP_PROJECT_FILE`, `NEXUS_UAP_EDITOR_PID` and `NEXUS_UAP_RC_PORT`. The public
status marker must report the same binding before Nexus uses its private identity
script. An uncertain PIE start keeps its native machine grant for external
reconciliation; gateway shutdown is not a release/rollback proof.

## Verification scope

All patches are source-reviewed and apply-checked against the exact pins. Tests
exercise fixed wrappers and isolated Python transport behavior with fixtures.
Selected patched builds and limited disposable-editor observations are documented
in `docs/qualification/`; these do not establish full native qualification. A patch application is not evidence that those builds or
live workflows have passed. Preserve upstream licences when installing the
patched components; original notices are included under `third_party/licenses/`.
