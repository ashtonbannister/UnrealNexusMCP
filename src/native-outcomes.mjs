// Recognition of reviewed native uncertainty envelopes, not a retry classifier.
// False means "no recognized uncertainty marker", NOT "safe to retry" or rollback.
// Only envelope fields are read; nested actor/asset data is never searched.
// UE pin: 62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d
//   src/dispatch/server-dispatch.ts:59-73,328,432 (Error/MACHINE_ERROR envelopes)
//   src/bridge/bridge.ts:844-875,891-895,1080-1082 (post-send timeout/loss)
//   plugin/ue_mcp_bridge/Source/UE_MCP_Bridge/Private/GameThreadExecutor.cpp:186-193,294-298
// Hayba pin: b69ed11011f89aed3c444a50bd2331b99551c777
//   unreal/HaybaMCPToolkit/Source/HaybaMCPToolkit/Private/HaybaMCPCommandHandler.cpp:1441-1513

export const MAX_NATIVE_OUTCOME_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_BLOCKS = 256;
const MACHINE_PREFIX = 'MACHINE_ERROR=';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const interruptedCodes = new Set(['BRIDGE_TIMEOUT','CONNECTION_LOST']);

function uncertainEnvelope(provider,payload) {
  if (!record(payload)) return false;
  if (provider === 'ue-mcp') {
    // The executor may have already claimed the handler before its caller gave
    // up. Its shared-state abandon flag is not evidence of rollback/nonexecution.
    return payload.success === false && ['timeout','shutting_down'].includes(payload.reason);
  }
  // Hayba quarantines its process after a contained native fault. The current
  // request can be a pre-dispatch refusal yet the EDITOR still must stay fenced.
  return ['native_fault_contained','editor_unsafe_restart_required'].includes(payload.code)
    || payload.editor_unsafe === true
    || payload.editor_health?.editor_unsafe === true
    || (payload.ok === false && payload.mutation_status === 'unknown' && payload.may_have_executed === true)
    || (payload.ok === false && payload.data?.mutation_status === 'unknown' && payload.data?.may_have_executed === true)
    || (payload.ok === false && typeof payload.crash_guarded === 'string' && payload.crash_guarded.length > 0);
}

/**
 * Return whether a reviewed native response must fence the whole shared editor.
 * Receipts are not modified, discarded or reinterpreted as successful rollback.
 * Malformed machine-error markers or an exceeded inspection bound fail closed.
 */
export function nativeOutcomeUnknown(provider,result) {
  if (!['ue-mcp','hayba'].includes(provider)) return false;
  if (!record(result) || !Array.isArray(result.content) || result.content.length > MAX_BLOCKS) return true;
  if (uncertainEnvelope(provider,result.structuredContent)) return true;
  let bytes=0,firstText=true;
  for (const part of result.content) {
    if (part?.type !== 'text') continue;
    if (typeof part.text !== 'string') return true;
    bytes+=Buffer.byteLength(part.text,'utf8');
    if (bytes > MAX_NATIVE_OUTCOME_TEXT_BYTES) return true;
    const text=part.text;
    // CONNECTION_LOST is emitted without details; timeout can likewise lose its
    // machine tail through a task wrapper. Recognize only the exact dispatcher
    // prefix in the first text block of an error result, never words in prose.
    if (provider === 'ue-mcp' && firstText && result.isError === true
      && /^Error \[(?:BRIDGE_TIMEOUT|CONNECTION_LOST)\]: /.test(text)) return true;
    firstText=false;
    if (provider === 'ue-mcp' && text.startsWith(MACHINE_PREFIX)) {
      let machine;
      try {machine=JSON.parse(text.slice(MACHINE_PREFIX.length));} catch {return true;}
      if (!record(machine) || typeof machine.code !== 'string' || !machine.code) return true;
      if (machine.outcome === 'unknown' || interruptedCodes.has(machine.code)) return true;
      continue;
    }
    let payload;
    try {payload=JSON.parse(text);} catch {continue;}
    if (uncertainEnvelope(provider,payload)) return true;
  }
  return false;
}
