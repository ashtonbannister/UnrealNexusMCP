import { randomBytes } from 'node:crypto';
import specialistCatalog from '../catalog/specialists.json' with { type: 'json' };
import { compileSchema } from './validation.mjs';
import { NexusError } from './errors.mjs';

// These are fixed recipes, not an exported Python/function-name escape hatch.
// Source pins + exact optional compatibility deltas must also be verified by
// the host factory. A live schema marker alone cannot attest installed source.
const RECIPES = Object.freeze({
  'blueprint.compile.memory.asset': ['claireon', 'bp_compile_asset', 'bp_compile'],
  'blueprint.compile.memory.session': ['claireon', 'bp_compile_session', 'bp_compile'],
  'automation.tests.run': ['claireon', 'test_run', 'test_run'],
  'automation.tests.poll': ['claireon', 'test_poll', 'test_poll'],
  'insights.capture.start': ['claireon', 'pie_trace_start', 'pie_trace_start'],
  'insights.capture.stop': ['claireon', 'pie_trace_stop', 'pie_trace_stop'],
  'insights.trace.open': ['claireon', 'trace_open', 'trace_open'],
  'insights.trace.scopes': ['claireon', 'trace_get_top_scopes', 'trace_get_top_scopes'],
  'insights.trace.frames': ['claireon', 'trace_get_frame_stats', 'trace_get_frame_stats'],
  'insights.trace.close': ['claireon', 'trace_close', 'trace_close'],
  'material.parameter.scalar.persisted': ['hayba', 'material_scalar', 'material_set_param'],
  'material.parameter.vector.persisted': ['hayba', 'material_vector', 'material_set_param'],
  'material.parameter.texture.persisted': ['hayba', 'material_texture', 'material_set_param'],
});
const SPECS = new Map(specialistCatalog.operations.map((op) => [op.id, op]));
const VALIDATORS = new Map([...SPECS].map(([id, op]) => [id, compileSchema(op.parameters)]));
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const text = (v) => typeof v === 'string' && v.length > 0;
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const finiteOrNull = (v) => v === null || finite(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FRAME_PREFIX = 'NEXUS_RESULT_';

function refusal(code, message) { throw new NexusError(code, message); }
function uncertain(message, result) {
  const error = new NexusError('SPECIALIST_OUTCOME_UNKNOWN', message);
  // Preserve the native receipt for host recovery; do not guess rollback.
  if (result !== undefined) error.backendResult = result;
  throw error;
}
function specification(operation) {
  const recipe = RECIPES[operation?.id];
  const spec = SPECS.get(operation?.id);
  if (!recipe || operation.provider !== recipe[0]
    || operation.route?.kind !== recipe[0] + '-specialist'
    || operation.route.variant !== recipe[1]
    || operation.route.tool !== spec.route.tool
    || !same(operation.route.fixed, spec.route.fixed)) {
    refusal('SPECIALIST_ROUTE_REFUSED', 'Unknown or altered specialist recipe.');
  }
  return {recipe, spec};
}
function validateArguments(id, args) {
  VALIDATORS.get(id)(args);
  if ((id.endsWith('.asset') || id.startsWith('material.parameter.'))
    && [args.asset_path, args.instance_path,
      typeof args.value === 'string' ? args.value : undefined]
      .filter((v) => v !== undefined).some((v) => v.split('/').includes('..'))) {
    refusal('INVALID_ARGUMENTS', 'Asset paths cannot contain parent traversal.');
  }
  if (id === 'automation.tests.run') {
    const names = args.allowed_skips.map((v) => v.name);
    if (new Set(names).size !== names.length || names.some((name) => !args.expected_tests.includes(name))
      || args.allowed_skips.some((v) => !v.reason.trim()) || !args.testFilter.trim()) {
      refusal('INVALID_ARGUMENTS', 'Skip names must be unique expected tests with nonblank reasons; filter must be nonblank.');
    }
  }
  if ((id === 'insights.trace.scopes' && args.endTime < args.startTime)
    || (id === 'insights.trace.frames' && args.endFrame < args.startFrame)) {
    refusal('INVALID_ARGUMENTS', 'Analysis ranges must not be inverted.');
  }
}

function pythonRequest(spec, args, nonce, probe = false) {
  const recipe = RECIPES[spec.id];
  const payload = {version:1,id:spec.id,nonce,probe,
    args:probe ? {} : {...args,...spec.route.fixed}};
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  // No caller text, paths or tool names are interpolated into Python syntax.
  // Only the hardcoded recipe selects the callable; arguments are encoded JSON.
  const invoke = probe
    ? `claireon.tool_search(tool_name=${JSON.stringify(recipe[2])})`
    : `claireon.${recipe[2]}(**_nexus_payload["args"])`;
  const compact = probe ? `
    def _nexus_schema_shape(value):
        if isinstance(value, dict):
            return {k: _nexus_schema_shape(v) for k, v in value.items() if k not in ("description", "title", "examples", "example", "default")}
        if isinstance(value, list):
            return [_nexus_schema_shape(v) for v in value]
        return value
    _nexus_data = _nexus_native.get("data", {})
    _nexus_tool = _nexus_data.get("tool", {})
    _nexus_native = {"data": {"deep_inspect": _nexus_data.get("deep_inspect"), "tool": {"name": _nexus_tool.get("name"), "input_schema": _nexus_schema_shape(_nexus_tool.get("input_schema"))}}, "summary": _nexus_native.get("summary", ""), "warnings": _nexus_native.get("warnings", [])}` : '';
  const code = `import base64, json, claireon
_nexus_payload = json.loads(base64.b64decode(${JSON.stringify(encoded)}).decode("utf-8"))
_nexus_ok = False
_nexus_unknown = False
_nexus_error = None
_nexus_native = None
try:
    _nexus_native = ${invoke}${compact}
    _nexus_ok = True
except RuntimeError as _nexus_exc:
    if len(_nexus_exc.args) > 1 and isinstance(_nexus_exc.args[1], dict):
        _nexus_native = _nexus_exc.args[1]
        _nexus_error = str(_nexus_exc.args[0])
    else:
        _nexus_unknown = True
        _nexus_error = str(_nexus_exc)
except Exception as _nexus_exc:
    _nexus_unknown = True
    _nexus_error = str(_nexus_exc)
_nexus_out = {"version": 1, "id": _nexus_payload["id"], "nonce": _nexus_payload["nonce"], "probe": _nexus_payload["probe"], "ok": _nexus_ok, "unknown": _nexus_unknown, "native": _nexus_native, "error": _nexus_error}
_nexus_frame = base64.b64encode(json.dumps(_nexus_out, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")).decode("ascii")
print("${FRAME_PREFIX}" + _nexus_payload["nonce"] + ":" + _nexus_frame + ":END")
`;
  if (Buffer.byteLength(code, 'utf8') > 60 * 1024) {
    refusal('INVALID_ARGUMENTS', 'Fixed Python request exceeds the reviewed native script bound.');
  }
  return {name:'python_execute',arguments:{code,quiet:true,nexus_skip_auto_save:true}};
}

export function buildSpecialistCall(operation, args) {
  const {spec} = specification(operation);
  validateArguments(spec.id, args);
  const copiedArgs = structuredClone(args);
  const nonce = randomBytes(16).toString('hex');
  const request = spec.provider === 'claireon' ? pythonRequest(spec, copiedArgs, nonce)
    : {name:'material_set_param',arguments:{...copiedArgs,nexus_retry_policy:'never'}};
  return {...request,nexusSpecialist:{id:spec.id,args:copiedArgs,nonce}};
}

export function specialistNativeToolName(operation) {
  return specification(operation).spec.route.tool;
}

function completeResult(result) {
  if (!record(result) || !Array.isArray(result.content)) uncertain('Malformed specialist MCP response.', result);
  const strings = [];
  let bytes = 0;
  for (const part of result.content) {
    if (part?.type !== 'text') continue;
    if (typeof part.text !== 'string') uncertain('Malformed specialist text block.', result);
    bytes += Buffer.byteLength(part.text, 'utf8');
    if (bytes > MAX_RESPONSE_BYTES) uncertain('Specialist text exceeds the bounded receipt size.', result);
    strings.push(part.text);
  }
  const joined = strings.join('\n');
  if (/<spilled\b|<truncated\b|"__mcp_spilled__"\s*:\s*true|"spilled_streams"\s*:|\[output truncated\]/i.test(joined)
    || result._meta?.truncated === true || result._meta?.isTruncated === true
    || result.structuredContent?.__mcp_spilled__ === true
    || result.structuredContent?.spilled_streams !== undefined) {
    uncertain('Spilled or truncated transport output cannot establish a specialist outcome.', result);
  }
  return strings;
}

function parseFrame(result, spec, nonce, probe = false) {
  const strings = completeResult(result);
  if (result.isError === true || strings.some((s) => /<execute-result\b[^>]*status=["'](?:error|failure)["']/i.test(s))) {
    uncertain('Outer Python execution failed; an inner mutation may already have happened.', result);
  }
  const marker = FRAME_PREFIX + nonce + ':';
  const all = strings.join('\n');
  if (all.split(marker).length !== 2) uncertain('Missing or ambiguous nonce-bound specialist frame.', result);
  const matches = [...all.matchAll(new RegExp('(?:^|\\r?\\n)' + marker + '([A-Za-z0-9+/]+={0,2}):END(?=\\r?\\n|$)', 'g'))];
  if (matches.length !== 1) uncertain('Truncated or malformed specialist frame.', result);
  let value;
  try {
    const decoded = Buffer.from(matches[0][1], 'base64');
    if (decoded.toString('base64') !== matches[0][1]) throw new Error('noncanonical base64');
    value = JSON.parse(decoded.toString('utf8'));
  } catch { uncertain('Specialist frame is not canonical base64 JSON.', result); }
  if (!record(value) || value.version !== 1 || value.id !== spec.id || value.nonce !== nonce
    || value.probe !== probe || typeof value.ok !== 'boolean' || typeof value.unknown !== 'boolean') {
    uncertain('Specialist frame does not correlate to this invocation.', result);
  }
  if (value.unknown) uncertain('Python failed without a native result envelope; outcome is unknown.', result);
  if (!record(value.native) || !record(value.native.data) || typeof value.native.summary !== 'string'
    || !Array.isArray(value.native.warnings) || value.native.warnings.some((v) => typeof v !== 'string')
    || (value.native.logs !== undefined && typeof value.native.logs !== 'string')
    || (value.native.ue_log !== undefined && typeof value.native.ue_log !== 'string')) {
    uncertain('Missing or malformed native Claireon envelope.', result);
  }
  return value;
}

function schemaFields(schema, shapes, supplied) {
  if (!record(schema) || schema.type !== 'object' || !record(schema.properties)
    || (schema.required !== undefined && (!Array.isArray(schema.required)
      || schema.required.some((v) => typeof v !== 'string' || !supplied.includes(v))))) return false;
  return Object.entries(shapes).every(([name, shape]) => shapeMatches(schema.properties[name], shape));
}
function shapeMatches(actual, expected) {
  if (!record(actual) || actual.type !== expected.type) return false;
  if (expected.items && !shapeMatches(actual.items, expected.items)) return false;
  if (expected.enum && (!Array.isArray(actual.enum)
    || expected.enum.some((v) => !actual.enum.includes(v)))) return false;
  return true;
}
const s = {type:'string'}, b = {type:'boolean'}, n = {type:'number'}, i = {type:'integer'};
const NATIVE_SHAPES = {
  bp_compile:{session_id:s,asset_path:s,response_mode:s},
  test_run:{testFilter:s,noTimeout:b,strict:b,expected_tests:{type:'array',items:s},allowed_skips:{type:'array',items:{type:'object'}}},
  test_poll:{run_id:s,cancel:b},
  pie_trace_start:{filename:s,channels:s},pie_trace_stop:{},trace_open:{filePath:s},
  trace_get_top_scopes:{sessionId:s,startTime:n,endTime:n,maxResults:i,sortBy:{type:'string',enum:['totalInclusive','count']},includeGpu:b,threadFilter:s},
  trace_get_frame_stats:{sessionId:s,frameType:{type:'string',enum:['game','render']},startFrame:i,endFrame:i,maxResults:i,onlyHitches:b,hitchThresholdMs:n},
  trace_close:{sessionId:s},
};
function hasPythonCompatibility(tools) {
  const schema = tools.get('python_execute')?.inputSchema;
  return tools.has('tool_search') && schemaFields(schema,
    {code:s,quiet:b,nexus_skip_auto_save:b}, ['code','quiet','nexus_skip_auto_save']);
}
function hasMaterialCompatibility(tools) {
  const schema = tools.get('material_set_param')?.inputSchema;
  if (!schemaFields(schema,{instance_path:s,param_name:s},['instance_path','param_name','value','nexus_retry_policy'])
    || !schema.required?.includes('nexus_retry_policy')) return false;
  const marker = schema.properties.nexus_retry_policy;
  if (!record(marker) || marker.type !== 'string'
    || !(marker.const === 'never' || same(marker.enum,['never']))) return false;
  const variants = schema.properties.value?.anyOf ?? schema.properties.value?.oneOf;
  return Array.isArray(variants) && variants.length === 3
    && variants.some((v) => v.type === 'number') && variants.some((v) => v.type === 'string')
    && variants.some((v) => v.type === 'array' && v.items?.type === 'number' && v.minItems === 1 && v.maxItems === 4);
}
function normalized(result, native, outcome, error = null) {
  return {...result,...(!outcome.ok ? {isError:true} : {}),
    structuredContent:{...outcome,native,...(error === null ? {} : {error})},
    _meta:{...result._meta,'unreal-nexus/specialist':{
      qualification:'source-reviewed compatibility adapter; live Unreal qualification pending',
      persistence:'Only an explicit persisted result is a disk-save claim.',
    }}};
}
function assetIdentity(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.includes('.') ? path : path + '.' + base;
}
function absoluteTrace(path) {
  return typeof path === 'string' && /^(?:\/|[A-Za-z]:[\\/]|\\\\)[^\0]+\.utrace$/.test(path);
}

/** Optional lazy adapter. The host must attest exact patched source + editor
 * identity first. No factory creation/list/plan operation dispatches a tool. */
export function createSpecialistAdapter({provider, callTool, tools}) {
  if (!['claireon','hayba'].includes(provider) || typeof callTool !== 'function'
    || !Array.isArray(tools) || tools.some((t) => !text(t?.name) || !record(t.inputSchema))
    || new Set(tools.map((t) => t.name)).size !== tools.length) {
    refusal('INVALID_SPECIALIST_ADAPTER', 'Expected provider, full unique Tool descriptors and callTool.');
  }
  const descriptors = new Map(tools.map((t) => [t.name, structuredClone(t)]));
  const ready = new Set();
  const lifetime = new AbortController();
  const sessions = new Map();
  let closed = false, activeRun = null, capturePath = null;
  const dispatch = (request, timeoutMs, signal) => callTool(request.name, request.arguments,
    {timeoutMs,signal:signal === undefined ? lifetime.signal : AbortSignal.any([lifetime.signal,signal])});
  function assertOpen() { if (closed) refusal('SPECIALIST_CLOSED', 'Specialist adapter is closed.'); }
  function ownState(spec, args) {
    if (spec.id === 'automation.tests.run' && activeRun) refusal('RUN_ALREADY_OWNED', 'Poll/cancel the existing owned run first.');
    if (spec.id === 'automation.tests.poll' && activeRun?.runId !== args.run_id) {
      refusal('RUN_NOT_OWNED', 'Refusing to poll or cancel an unowned automation run.');
    }
    if (spec.id === 'insights.capture.start' && capturePath) refusal('CAPTURE_ALREADY_OWNED', 'Stop the owned trace first.');
    if (spec.id === 'insights.capture.stop' && !capturePath) refusal('CAPTURE_NOT_OWNED', 'Refusing to stop an unowned trace.');
    if (['insights.trace.scopes','insights.trace.frames','insights.trace.close'].includes(spec.id)
      && !sessions.has(args.sessionId)) refusal('TRACE_NOT_OWNED', 'Refusing to access an unowned analysis session.');
  }
  function checkedRequest(call) {
    assertOpen();
    const envelope = call?.nexusSpecialist;
    if (!record(envelope) || !SPECS.has(envelope.id) || !/^[0-9a-f]{32}$/.test(envelope.nonce ?? '')) {
      refusal('SPECIALIST_ROUTE_REFUSED', 'Only fixed Nexus specialist calls are accepted.');
    }
    const spec = SPECS.get(envelope.id);
    if (spec.provider !== provider || !ready.has(spec.id)) {
      refusal('CAPABILITY_UNAVAILABLE', 'A fresh live specialist capability check is required.');
    }
    validateArguments(spec.id,envelope.args);
    const request = provider === 'claireon' ? pythonRequest(spec,envelope.args,envelope.nonce)
      : {name:'material_set_param',arguments:{...envelope.args,nexus_retry_policy:'never'}};
    if (call.name !== request.name || !same(call.arguments,request.arguments)) {
      refusal('SPECIALIST_ROUTE_REFUSED', 'The planned fixed request was altered.');
    }
    ownState(spec,envelope.args);
    return {spec,envelope,request};
  }
  function interpretClaireon(result, frame, spec, args) {
    const native = frame.native, data = native.data;
    if (!frame.ok) {
      if (spec.id === 'automation.tests.poll') {
        if (!['execution','discovery'].includes(data.strict_failure)) {
          uncertain('Poll failed without a terminal strict receipt; run/gate state needs reconciliation.', result);
        }
        activeRun = null;
        return normalized(result,native,{ok:false,phase:args.cancel ? 'cancelled' : 'failed',run_id:args.run_id,gateReleased:true},frame.error);
      }
      return normalized(result,native,{ok:false,phase:'native-error'},frame.error);
    }
    if (spec.id.startsWith('blueprint.compile.memory.')) {
      if (!text(data.session_id) || !text(data.asset_path) || !Array.isArray(data.compile_log)
        || data.compile_log.some((row) => !record(row)
          || !['error','warning','note','info'].includes(row.severity) || typeof row.message !== 'string'
          || (row.node_guid !== undefined && !text(row.node_guid)))
        || !count(data.compile_log_num_errors) || !count(data.compile_log_num_warnings)
        || !count(data.compile_log_total_entries)
        || data.compile_log_total_entries < data.compile_log.length
        || (data.compile_log_truncated !== undefined && typeof data.compile_log_truncated !== 'boolean')
        || (args.session_id && data.session_id !== args.session_id)
        || (args.asset_path && assetIdentity(data.asset_path) !== assetIdentity(args.asset_path))) {
        uncertain('Compile receipt lacks exact target and structured diagnostics.', result);
      }
      const compiled = /^ok: Compilation successful(?: \(with warnings\))?(?:\r?\n|$)/.test(native.summary)
        && data.compile_log_num_errors === 0;
      if (!compiled && !/^ok: Compilation failed with errors(?:\r?\n|$)/.test(native.summary)) {
        uncertain('Native compiler status is not an explicit successful/failed status.', result);
      }
      return normalized(result,native,{ok:compiled,phase:compiled?'compiled-memory-only':'compile-failed',
        session_id:data.session_id,asset_path:data.asset_path,saved:false});
    }
    if (spec.id === 'automation.tests.run') {
      if (!text(data.run_id) || !['awaiting_workers','awaiting_test_list'].includes(data.state)
        || !count(data.total) || data.total === 0 || data.completed !== 0 || !finite(data.suggested_poll_after_seconds)
        || data.suggested_poll_after_seconds <= 0 || data.poll_with !== 'test_poll') {
        uncertain('Automation start did not return a correlated accepted-run receipt.', result);
      }
      activeRun = {runId:data.run_id,expectedTests:[...args.expected_tests],allowedSkips:structuredClone(args.allowed_skips)};
      return normalized(result,native,{ok:true,phase:'accepted',run_id:data.run_id,
        suggested_poll_after_seconds:data.suggested_poll_after_seconds});
    }
    if (spec.id === 'automation.tests.poll') {
      if (['awaiting_workers','awaiting_test_list','running'].includes(data.state)) {
        if (data.run_id !== args.run_id || !count(data.completed) || !count(data.total)
          || !finite(data.suggested_poll_after_seconds) || data.suggested_poll_after_seconds <= 0 || args.cancel) {
          uncertain('Automation progress is inconsistent with the requested owned run.', result);
        }
        return normalized(result,native,{ok:true,phase:'running',run_id:args.run_id,
          suggested_poll_after_seconds:data.suggested_poll_after_seconds});
      }
      const verdict = native.summary.match(/(?:^|\n)Strict: PASSED -- (\d+) discovered, (\d+) reported, (\d+) allowlisted skip\(s\) observed\.\n?$/);
      if (!verdict || Object.keys(data).length !== 0 || Number(verdict[1]) !== activeRun.expectedTests.length
        || Number(verdict[2]) !== activeRun.expectedTests.length || Number(verdict[3]) > activeRun.allowedSkips.length) {
        uncertain('Automation terminal response does not establish the owned strict verdict.', result);
      }
      const evidence = activeRun;
      activeRun = null;
      return normalized(result,native,{ok:!args.cancel,phase:args.cancel?'cancelled':'passed',run_id:args.run_id,
        gateReleased:true,expected_tests:evidence.expectedTests,allowed_skips:evidence.allowedSkips});
    }
    if (spec.id === 'insights.capture.start') {
      if (data.status !== 'recording' || !absoluteTrace(data.trace_file_path)
        || data.channels !== args.channels || data.stat_named_events !== true
        || !data.trace_file_path.replaceAll('\\','/').endsWith('/'+args.filename+'.utrace')) {
        uncertain('Trace start lacks the requested recording/path/channel receipt.', result);
      }
      capturePath = data.trace_file_path;
      return normalized(result,native,{ok:true,phase:'recording',trace_file_path:capturePath});
    }
    if (spec.id === 'insights.capture.stop') {
      if (data.status !== 'stopped' || data.trace_file_path !== capturePath || typeof data.stat_named_events !== 'boolean') {
        uncertain('Trace stop does not confirm the owned recording/path; reconcile externally.', result);
      }
      capturePath = null;
      return normalized(result,native,{ok:true,phase:'stopped',trace_file_path:data.trace_file_path});
    }
    if (spec.id === 'insights.trace.open') {
      if (!text(data.session_id) || sessions.has(data.session_id) || data.trace_file !== args.filePath
        || !count(data.frame_count) || !finiteOrNull(data.duration_ms)) {
        uncertain('Trace open lacks a fresh correlated reader handle.', result);
      }
      sessions.set(data.session_id,data.trace_file);
      return normalized(result,native,{ok:true,phase:'opened',session_id:data.session_id,trace_file:data.trace_file});
    }
    if (data.session_id !== args.sessionId) uncertain('Trace result does not match the owned reader.', result);
    if (spec.id === 'insights.trace.close') {
      if (data.closed !== true) uncertain('Trace reader closure was not confirmed.', result);
      sessions.delete(args.sessionId);
      return normalized(result,native,{ok:true,phase:'closed',session_id:args.sessionId});
    }
    if (spec.id === 'insights.trace.scopes') {
      if (!Array.isArray(data.scopes) || data.scopes.length > args.maxResults
        || data.scopes.some((row) => !record(row) || !text(row.name) || !finite(row.total_ms)
          || !finite(row.avg_ms) || !count(row.call_count))
        || typeof data.truncated !== 'boolean' || !count(data.total_scopes_before_truncation)
        || typeof data.gpu_timelines_present !== 'boolean' || !count(data.gpu_event_count)) {
        uncertain('Scope page is missing bounded native timing/truncation evidence.', result);
      }
      return normalized(result,native,{ok:true,phase:'observed',session_id:args.sessionId,
        range_seconds:[args.startTime,args.endTime],truncated:data.truncated});
    }
    if (spec.id === 'insights.trace.frames') {
      if (!Array.isArray(data.frames) || data.frames.length > args.maxResults
        || data.frames.some((row) => !record(row) || !count(row.frame_index)
          || row.frame_index < args.startFrame || row.frame_index > args.endFrame
          || !finiteOrNull(row.duration_ms) || !finiteOrNull(row.game_thread_ms))
        || !finite(data.avg_ms) || !finite(data.min_ms) || !finite(data.max_ms)
        || !count(data.unterminated_frames) || data.unterminated_frames > data.frames.length) {
        uncertain('Frame page is missing bounded native frame/aggregate evidence.', result);
      }
      return normalized(result,native,{ok:true,phase:'observed',session_id:args.sessionId,
        range_frames:[args.startFrame,args.endFrame],aggregates_scope:'returned-page-only',
        game_thread_ms_meaning:'native frame duration, not independent GameThread CPU timing'});
    }
    uncertain('No reviewed specialist result interpreter.', result);
  }
  function interpretMaterial(result, spec, args) {
    const strings = completeResult(result);
    if (result.isError === true) uncertain('Material execution failed without a verified write/save receipt; do not retry.', result);
    const payloads = [];
    if (record(result.structuredContent)) payloads.push(result.structuredContent);
    for (const value of strings) {
      try { const parsed = JSON.parse(value); if (record(parsed)) payloads.push(parsed); } catch { /* prose is retained */ }
    }
    if (payloads.length !== 1) uncertain('Missing/ambiguous typed material JSON receipt.', result);
    const data = payloads[0];
    if (data.param !== args.param_name || typeof data.verified !== 'boolean' || typeof data.saved !== 'boolean'
      || typeof data.dirty !== 'boolean' || !Object.hasOwn(data,'observed_value')
      || (spec.id.includes('.scalar.') && (!finite(data.observed_value) || !finite(data.value)))
      || (!spec.id.includes('.scalar.') && (!text(data.observed_value) || !text(data.value)))) {
      uncertain('Typed material receipt lacks parameter/readback/save fields.', result);
    }
    const ok = data.verified && data.saved;
    return normalized(result,data,{ok,phase:ok?'persisted':data.verified?'persistence-failed':'readback-failed',
      instance_path:args.instance_path,param_name:args.param_name,requested_value:args.value,
      observed_value:data.observed_value,verified:data.verified,saved:data.saved});
  }
  return {
    tools:new Set(descriptors.keys()),
    async supports(operation, {signal,timeoutMs=30000} = {}) {
      assertOpen();
      const {recipe,spec} = specification(operation);
      if (spec.provider !== provider) return false;
      ready.delete(spec.id);
      if (provider === 'hayba') {
        if (!hasMaterialCompatibility(descriptors)) return false;
      } else {
        // Check the no-autosave marker BEFORE any Python call, including probes.
        if (!hasPythonCompatibility(descriptors)) return false;
        const nonce = randomBytes(16).toString('hex');
        const request = pythonRequest(spec,{},nonce,true);
        const result = await dispatch(request,timeoutMs,signal);
        const frame = parseFrame(result,spec,nonce,true);
        const data = frame.native.data;
        const supplied = [...(spec.parameters.required ?? []),...Object.keys(spec.route.fixed)];
        if (!frame.ok || data.deep_inspect !== true || data.tool?.name !== recipe[2]
          || !schemaFields(data.tool.input_schema,NATIVE_SHAPES[recipe[2]],supplied)) return false;
      }
      ready.add(spec.id);
      return true;
    },
    validateCall(call) {
      checkedRequest(call);
      return true;
    },
    async call(call, timeoutMs = 120000, {signal} = {}) {
      const {spec,envelope,request} = checkedRequest(call);
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) {
        refusal('INVALID_ARGUMENTS', 'Invalid specialist deadline.');
      }
      ready.delete(spec.id);
      const result = await dispatch(request,timeoutMs,signal);
      return provider === 'claireon'
        ? interpretClaireon(result,parseFrame(result,spec,envelope.nonce),spec,envelope.args)
        : interpretMaterial(result,spec,envelope.args);
    },
    ownedState() {
      return {automationRun:activeRun ? structuredClone(activeRun) : null,capturePath,
        traceSessions:[...sessions].map(([sessionId,filePath]) => ({sessionId,filePath}))};
    },
    async close() {
      closed = true;
      lifetime.abort();
      ready.clear();
      // Do not silently cancel tests, close native sessions (some save), or stop
      // a capture. Host recovery must reconcile these explicitly after failure.
    },
  };
}
