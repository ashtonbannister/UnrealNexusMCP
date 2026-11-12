# EngineWire update candidate — 2026-11-12

Scope: initial comparison of pinned EngineWire `5a17d6d343ef9b40a509068cff73f1bfb4509815` (package `0.6.0-beta-f`) with its observed default `dev` head `2792ba198403bf0842a6cd91f87113d9d86db8e3` (package `0.6.1-beta-b`). This is a candidate, not an automatic upgrade or a stable-release claim. The installed source and running editor remain at their prior versions.

- The candidate is 244 commits ahead; a local Git comparison with renames expanded found 1,021 changed paths. The root MIT license file is unchanged; bundled components still need their own license review before reuse.
- Its generated capability registry contains 489 records versus 427 at the pin: 62 IDs added and none removed by ID. Its candidate registry SHA-256 is `650b3b51bc3e7e449b551c9f3ec355bea058b3fd7bb0b5265a9d51233001f579`. These are discovery records, not a count of unique, available or qualified Nexus operations.
- The `control_editor.screenshot` registry entry retains the same structural schema for `mode`, `resolution`, `returnBase64`, `keepFile` and `waitForShaders`. It adds camera, field-of-view, render-size and path-tracing options. Nexus's selected current-viewport route does not expose those new options.
- The native screenshot handler delegates frame reading to a new helper. Without `renderSize`, the helper still reads the viewport and forces opaque alpha; the separate file-write helper changed, but Nexus fixes `keepFile` to false. Review all response and transport details and test the actual updated native plugin before promotion; matching parameter schemas do not establish equal behavior.
- A local evidence-span comparison mapped 67 existing EngineWire decision and inventory spans: 48 byte-identical and uniquely located, 19 changed. Unchanged spans do not establish unchanged dependencies or behavior.
- In a temporary Linux checkout, `npm ci --ignore-scripts --no-audit --no-fund` and `node node_modules/typescript/bin/tsc -p tsconfig.json` completed successfully under Node 24.11.1. No candidate EngineWire native plugin was built, loaded or exercised during this assessment.

Next: compare the candidate's selected screenshot receipt and identity preflight against Nexus, refresh the search index and source inventory from this exact revision, review changed dependencies and distinct provider variants, then build and test the actual native plugin before changing the installed pin. Retain the previous source and binaries for explicit rollback; no automatic provider failover or replay is implied.

## Unified MCP integration

The master MCP update pins EngineWire to `2792ba198403bf0842a6cd91f87113d9d86db8e3` (`0.6.1-beta-b`) and incorporates its complete native `unreal` surface, including all four gateway operations and their unchanged provider contracts. The current source inventory and search index now use all 489 registry records from that commit, including the 62 added records. Older source dispositions remain historical evidence, not a filter on provider access.

The retained canonical viewport adapter still uses `mode=editor_viewport`, `returnBase64=true`, `keepFile=false`, and the caller's explicit resolution bounding box. Its source references now follow the updated viewport reader and screenshot receipt. Camera overrides, off-screen render size and path tracing remain available through the original namespaced provider tool. No native handler body was copied or rewritten.

The refreshed registry contains 1,658 distinct legacy tool/action selector pairs across 23 internal parent groups; these are capability selectors, not 1,658 separately registered MCP tools. EngineWire's public manifest remains one `unreal` tool, with resources, resource templates, prompts, completions and change subscriptions on its advertised MCP surface. Source refresh does not claim a native plugin build or live editor execution in this environment.
