# Windows actor placement observation — 2026-11-11

Scope: a user-requested test in the running Henday Heat editor (PID 39912, world `Untitled_1`). This is a limited live observation, not full native or release qualification. No explicit save was requested or invoked by the test. Unreal displayed an autosave notification during earlier editor interaction; autosave activity was not independently established.

- A `Cube` was placed through the editor UI.
- `NexusTest_Sphere` and `NexusTest_Cylinder` were placed through fixed, direct UE-MCP calls before Nexus exposed actor placement. Each returned `created: true`, and a later UE-MCP outliner query found both in the editor world with the requested locations.
- `NexusTest_Cone` was placed through the new `actor.place.editor` Nexus route using the running editor's configured target. Nexus returned a correlated success receipt; a separate fixed UE-MCP outliner query found the named static-mesh actor at the requested location in `Untitled_1`.

The native placement receipt does not independently report the resolved world, actor object path, actual transform or mesh assignment. The outliner observations establish the returned labels, class, world name and positions, not visual appearance or exact mesh assignment. The route does not save the level. Unknown outcomes require reconciliation before retry; native inverse descriptors are not a rollback guarantee. Existing editor and gateway clients were left running, and separate clients do not share the test gateway's queue.

A subsequent `actor.list.editor` call through the updated Nexus coordinator used `nameFilter: "NexusTest_"` and `limit: 10`. It returned the three named actors, their paths and requested positions in `Untitled_1`, with `hasMore: false`, `total: 3` and `streamingSkipped: 128`. This is one live coordinator read; excluded streaming actors and other filters/pages were not tested. The native page is not an immutable snapshot and its row limit does not bound enumeration.
