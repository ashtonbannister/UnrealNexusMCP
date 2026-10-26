# Specialized capability selection audit

Source-reviewed draft, 2026-10-26. No live Unreal/native qualification.
Selections are scoped; the executable catalogue remains authoritative.
Adapter-required/conditional candidates are not callable defaults.

## PCG connections

Select UE-MCP pcg.connect_nodes for a saved scalar connection. The
[native implementation][pcg-connect] checks existing edges, verifies the actual
UPCGEdge after mutation, reports save outcome and supplies an inverse only for
an edge it created. Existing edges get no destructive inverse.

Exclude Hayba pcg_wire from this default. Its [implementation][hayba-wire]
treats nonthrowing add_edge as success, does not verify the edge and ignores
save outcome. Static confidence is high, not live certification.

Preserve Claireon's session-based pcg_connect, which adds compatibility checks,
graph-parameter GUID validation and pending reconstruction settlement. Preserve
EngineWire's optionally unsaved manage_pcg.connect_pcg_pins. Their full contracts
differ from UE's saved scalar edit. Numeric node indices require fresh identity
resolution; never silently substitute ambiguous names.

## PCG generation

Select UE pcg.execute plus pcg.wait_for_generation. Its [wait][pcg-wait]
distinguishes generated, cancelled, cleaned, not_started, idle and timed_out
and selects a requested run ID. Native observations use generation/cancel/
cleanup delegates and partition-local generating components.

Exclude Hayba pcg_cook_and_wait as generic completion proof. Its
[heuristic][hayba-wait] accepts an idle timeout when ISMs are nonempty, which
may describe old/intermediate instances. Conversely zero ISMs can be valid
points/attributes/empty output. Retain ISM inspection as scatter diagnostics,
not evidence of general generation success.

Reviewed public inputs:

| Action | Native public contract |
|---|---|
| pcg.connect_nodes | assetPath/sourceNode/targetNode; optional explicit pins and aliases |
| pcg.execute | Exactly one actorLabel/actorPath; optional seed, wait, timeoutSeconds |
| pcg.wait_for_generation | Actor selector; optional componentName/runId/timeoutSeconds/graceSeconds |

Execute does not accept componentName or graphPath: it selects the actor's
first PCG component. Wait can select the component. Follow up with the actual
returned actor/component/run identity. The public wait is TypeScript
orchestration, not a native command.

Nexus narrows aliases, requires explicit pins/world identities where available
and bounds numeric inputs. These are Nexus policies, not upstream schema facts.
Native execute acknowledgement is not completion; wait=true can preserve success
with a timeout warning. Standalone wait also returns success for non-generated
terminal/idle states. Require generated for the exact run. Never retry execute
because waiting timed out.

## Control Rig

Prefer UE animation.create_control_rig for ordinary source-backed saved rigs.
The [implementation][rig-create] requires exactly one mesh/skeleton source,
checks conflicts, refuses overwrite, requires relocation to the requested
destination, reports save state and supplies a fresh-asset inverse.

Demote only the overlapping EngineWire creation branch: attempted relocation
can fail without failing the call. Preserve blank/modular/save=false and
older-engine variants. A rig asset is not validated animation: verify skeleton,
hierarchy, preview mesh, solve directions and an unchanged-animation round trip
before baking. New UE session workflows are version-gated; do not silently
replace them with raw bone keys. This remains a conditional future route.

## Sequencer

Do not choose Hayba seq_transform_keyframe as default. Its
[script][hayba-keys] picks the first track/section, catches individual key errors
and ignores save outcome; success can mean zero added keys.

Prefer EngineWire manage_sequence.add_keyframe for high-level track/section
creation: range expansion, preservation of unkeyed defaults, same-frame key
replacement and tangent recomputation. It still needs explicit save/readback
and can partially write a batch.

Prefer UE editor.set_sequence_channel_keys for exact existing-channel edits.
The [writer][channel-keys] validates entries, snapshots prior state and reads
keys back. Mismatches are warnings; its inverse does not restore custom
tangents. Dirty is not saved.

Keep these complementary contracts separate and unadapted until fractional
frame rates, replacement, partial failure, preserved scale/rotation, active
ranges and reload durability have been tested.

## Procedural and modelling variants

UE [foliage.add_instances][foliage] is the preferred candidate when native
foliage-type rules are intended: prevalidation, skipped reasons, World
Partition rehoming and bounded transform inverses. Exact no-trace/no-rules
placement requires projectToGround=false AND applyTypeRules=false.

Do not call Hayba's native foliage placement a stub: it checks before/after
counts. Preserve its seeded disc, EngineWire box/disc/point variants and
Claireon's session jittered rectangular grid. These are distinct algorithms.
Cross-cell inverse coverage requires live tests; no foliage route is enabled
in the first canonical set.

UE landscape sculpt is preferred for named edit layers and bounded previous-
height restoration. Preserve EngineWire's linear falloff, supplied-Z flatten
target and optional delayed flush; UE's ordinary brush instead uses smoothstep
and centre-height flattening. No landscape route is initially exposed.

StaticMesh asset booleans differ from live DynamicMesh actor booleans.
Custom native PCG geometry algorithms stay unless algorithm-level equivalence
is demonstrated.

## Specialist gates and guidance

Keep EngineWire vehicle configuration conditional. Its [helpers][vehicle]
ignore some reflective write results and can increment configured-wheel count
without verifying each property. Require readback and PIE behavior before
calling a vehicle validated.

Audio playback acknowledgements are not measured output. Preserve editor
versus audible-world targets, positional versus managed 2D playback and envelope
measurement as separate operations.

Resolve exact targets; serialize only within declared scope; preserve native
version/plugin gates, warnings, partial effects, failed saves and inverse limits.
Separate scheduling, completion, verification and persistence. Test ambiguous
targets, existing/no-op edits, late failures, cancellation, timeout and reload.
Generic reflection/runtime observation does not prove equivalence to these
specialized authoring operations.

## Immutable source evidence

[pcg-connect]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/PCG/PCGHandlers.cpp#L1208-L1308
[hayba-wire]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/tools/pcg/pcg-primitives.ts#L288-L346
[pcg-wait]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/src/tools/pcg-wait.ts#L55-L138
[hayba-wait]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/tools/pcg/pcg-cook-and-wait.ts#L79-L178
[rig-create]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Animation/AnimationHandlers_ControlRig.cpp#L258-L355
[hayba-keys]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/tools/sequencer/sequencer-py-tools.ts#L409-L491
[channel-keys]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Sequencer/SequencerHandlers_Channels.cpp#L404-L549
[foliage]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Foliage/FoliageHandlers_Placement.cpp#L383-L590
[vehicle]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/Animation/Physics/McpAnimVehiclePayload.cpp#L15-L175
