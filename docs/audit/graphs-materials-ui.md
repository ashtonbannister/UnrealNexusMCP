# Graph, material, and UI implementation audit

**Snapshot scope:** This report records the initial upstream source-selection review. Current adapter/patch availability is recorded in [implementation selection](../IMPLEMENTATION_SELECTION.md), [runtime setup](../RUNTIME_SETUP.md) and [the master guidance](../MASTER_SKILL_GUIDANCE_DRAFT.md). References below to an adapter still being required describe that original review stage.

Reviewed 2026-10-26 from pinned source. No Unreal plugin was compiled or tested
in a live editor. A similarly named function is not necessarily equivalent.

| Semantic operation | Decision | Current status |
|---|---|---|
| Memory-only Blueprint compile | Claireon bp_compile | Adapter required, not exposed |
| Strict persisted global material-instance parameter | Hayba material_set_param | Adapter required, not exposed |
| Blueprint pin connection | Preserve distinct implementations | No universal winner |
| Atomic material/Widget Blueprint batch | Hold atomic contract | Failure-path qualification required |
| Variable/component creation | Preserve pending narrower comparison | Conflict/persistence semantics differ |

## Blueprint compilation

Select Claireon's internal `bp_compile` for the memory-only contract, not as a
public MCP tool of that name. The [implementation][compile] accepts session_id or
asset_path and optional response_mode; the future adapter should require exactly
one target form.

It explicitly uses SkipSave, adds SkipGarbageCollection on UE 5.8+, and returns
structured compiler diagnostics with severity, best-effort node GUIDs, total
count and truncation. Output is bounded to 100 entries. It promotes BS_Error
when a first error message is available. Inspect actual compiler status, not
just transport success.

Claireon's public tool is [python_execute][python-schema]. Generate a fixed
allowlisted call with JSON-safe arguments; never accept raw caller code or
callable names. The [execution wrapper][python-output] has no structured data
stream and can spill stdout. A future adapter must explicitly serialize the
internal result with a bounded unambiguous marker and reject missing, truncated
or spilled output. Do not close sessions as automatic cleanup: closing can save.

Preserve compile-and-save, folder compilation and explicit save separately.
EngineWire's [shared compiler][engine-compile] uses different flags and can reset
undo history under live-instance/reference conditions; surface this side effect.

Qualification: clean/error/warning Blueprints, truncated diagnostics, session
ownership, supported engine versions, and unchanged disk bytes with
Save-on-Compile enabled.

## Strict material parameters

Select Hayba `material_set_param` only for existing UMaterialInstanceConstant
global scalar, RGB/RGBA vector or texture parameters. Inputs: instance_path,
param_name, value. An internal registry name does not prove public availability.

The [native implementation][material-native] refuses read-only packages before
mutation, checks parameter existence and supported types, validates finite
numbers/vector shape and texture loading, reads back the stored value, and
reports verified, saved, dirty and save_error.

Require verified=true and saved=true for the persisted contract. Failed
persistence may leave memory changed; inspect before considering another edit.
The [TypeScript schema][material-schema] permits 1–4 vector entries while native
code requires 3–4. Narrow the canonical schema. Reject nonfinite and
non-float32-representable numbers. Native boolean/static-switch support is absent
from this typed schema; do not expose it through this selection.

Preserve layer-associated parameters, dynamic instances, undeclared override
staging, parent reassignment, master-material graph edits and nonpersisting
session writes as different operations.

Qualification: missing/wrong-type parameters, invalid vectors, overflow, failed
texture loading, read-only packages, save refusal and mismatching readback via
the actual transport.

## Pin connections are not universally interchangeable

| Implementation | Useful behavior | Contract difference |
|---|---|---|
| Claireon bp_connect_pins | Direction-aware resolution, ambiguity rejection, wildcard notifications | Hardcoded K2 schema, session edit |
| UE-MCP blueprint/connect_pins | Actual graph schema, explicit break flags, existing links | Compile/save behavior, name-based selection |
| EngineWire manage_blueprint.connect_pins | Conversion/replaced-link receipts and observed connection | Can allocate/grow/reinterpret pins |

Claireon's [connection path][claireon-connect] obtains UEdGraphSchema_K2;
it is not a universal custom/animation graph connector.
UE's [path][ue-connect] uses the actual graph schema. deferCompile skips
compilation, not checked persistence.
EngineWire's [path][engine-connect] reports inserted conversions and changed
links, but convenience pin growth and variable-Set reinterpretation are extra
mutations.

Define graph schema and save scope before pruning. Test ambiguous names,
same-name input/output pins, existing links, break flags, reconstruction,
conversion insertion and failure after mutation. Prefer GUIDs and explicit
directions. Never blindly replay a timed-out edit.

## Hold atomic batch claims

Claireon's [generic delta failure path][delta-base] invokes phase-3 cleanup and
transaction cancellation. Material [cleanup][delta-cleanup] removes newly
created expressions; this does not demonstrate restoration of deleted
expressions or disconnected links.

Widget spec [creation/type failures][widget-spec] record failed entries and
continue. The [shared spec driver][spec-base] can record entry failures without
critical failure. Compile/save failures may become warnings followed by success;
slot-property write results may be ignored and widget-property failures may be
warnings. A transaction or UndoTransaction call does not establish complete
rollback of all memory, auto-created assets and disk effects.

Preserve declarative authoring as advanced, not atomic default. Keep granular
edits, subtree extraction, widget asset inspection and live-widget interaction
separate. Test valid edit A followed by failing B after deletion/disconnection;
compare graph/tree, asset registry, disk bytes, dirty flags and undo history.
Repeat with property, compile and save failure.

## Master guidance

Separate public tools/internal functions; mutation/compilation/persistence/runtime
application; and gateway scheduling/native locks. Preserve diagnostics and
per-item failures. Surface undo resets, reinstancing, partial effects and save
failures. Do not prune variable/component variants until conflict, attachment,
type and persistence contracts match.

## Immutable source evidence

[compile]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonBlueprintGraphTool_Compile.cpp#L104-L269
[python-schema]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_ExecutePython.cpp#L447-L474
[python-output]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonTool_ExecutePython.cpp#L882-L889
[engine-compile]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Foundation/BridgeHelpers/Blueprints/McpBPDiag.h#L34-L137
[material-native]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/unreal/HaybaMCPToolkit/Source/HaybaMCPToolkit/Private/handlers/HaybaMCPMaterialHandler.cpp#L1326-L1460
[material-schema]: https://github.com/zajalist/hayba/blob/b69ed11011f89aed3c444a50bd2331b99551c777/mcp-tools/hayba-mcp/src/tools/material/material-set-param.ts#L13-L23
[claireon-connect]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonBlueprintGraphTool_ConnectPins.cpp#L234-L417
[ue-connect]: https://github.com/db-lyon/ue-mcp/blob/62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d/plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/Handlers/Blueprint/BlueprintHandlers_Graph.cpp#L1063-L1229
[engine-connect]: https://github.com/ChiR24/Unreal_mcp/blob/5a17d6d343ef9b40a509068cff73f1bfb4509815/plugins/EngineWire/Source/EngineWire/Private/Domains/BlueprintGraph/McpBPGraphPinMutations.cpp#L18-L199
[delta-base]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/FClaireonDeltaApplicatorBase.cpp#L229-L255
[delta-cleanup]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/FClaireonDeltaApplicator_Material.cpp#L380-L393
[widget-spec]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/ClaireonSpecApplicator_WidgetBP.cpp#L317-L492
[spec-base]: https://github.com/believer-oss/Claireon/blob/89bee2f4c62d1df625cca71ae66e7c81a415a009/Source/Claireon/Private/Tools/FClaireonSpecApplicatorBase.cpp#L121-L207
