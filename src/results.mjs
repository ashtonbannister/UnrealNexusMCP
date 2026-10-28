import { isDeepStrictEqual } from 'node:util';
import { nativeOutcomeUnknown } from './native-outcomes.mjs';

// Interpret only one unambiguous provider JSON envelope, never nested asset data.
// UE-MCP may append editor attribution or prepend modal notices as prose.
function payloadOf(result) {
  if (result.structuredContent && typeof result.structuredContent === 'object'
    && !Array.isArray(result.structuredContent)) return result.structuredContent;
  const parsed = [];
  for (const part of result.content ?? []) {
    if (part.type !== 'text') continue;
    try {
      const data = JSON.parse(part.text);
      if (data && typeof data === 'object' && !Array.isArray(data)) parsed.push(data);
    } catch { /* Preserve prose, but it is not a machine-readable outcome. */ }
  }
  return parsed.length === 1 ? parsed[0] : null;
}
export function normalizeResult(operation, result, expectedArgs = {}) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.content)) {
    throw new Error('Malformed backend MCP result');
  }
  const payload = payloadOf(result);
  let failed = result.isError === true || payload?.ok === false || payload?.success === false || payload?.bIsError === true;
  let policy = 'backend-response-only';
  let outcomeUnknown = nativeOutcomeUnknown(operation.provider,result);
  if (operation.provider === 'unrealagentplayer') {
    policy = 'uap-json-envelope';
    if (!payload || typeof payload.ok !== 'boolean' || typeof payload.phase !== 'string' || !payload.phase) failed = true;
    if (operation.id === 'pie.start.viewport'
      && (payload?.playing !== true || !['Playing','Paused'].includes(payload?.phase))) failed = true;
    if (operation.id === 'pie.stop' && (payload?.stopped !== true || payload?.phase !== 'NotPlaying')) failed = true;
  }
  if (operation.provider === 'unrealagentplayer' && operation.effect === 'lifecycle') {
    // Native start deadlines return a normal MCP response while queued work can
    // still take effect. Stop can likewise return before teardown is complete.
    outcomeUnknown = !payload
      || typeof payload.phase !== 'string' || !['NotPlaying','Starting','Playing','Paused','Stopping'].includes(payload.phase)
      || ['UE_CONNECTION_RESET','UE_CROSSED_RESPONSE','PYTHON_RUNTIME'].includes(payload.error?.code)
      || (payload.queued === true && payload.confirmed !== true)
      || ['Starting','Stopping'].includes(payload.phase)
      || (operation.id === 'pie.stop' && payload.stopped === false
        && payload.phase !== 'NotPlaying');
    if (outcomeUnknown) failed = true;
  }
  const ueRefusalPrefix = operation.provider === 'ue-mcp' && result.isError === true
    && result.content[0]?.type === 'text'
    && /^Error \[(?:NOT_CONNECTED|INVALID_PARAMS)\]: /u.test(result.content[0].text);
  // A refusal prefix mixed with JSON completion envelopes is contradictory.
  const ueEnvelopes = operation.provider === 'ue-mcp' ? result.content.flatMap(part => {
    if (part?.type !== 'text') return [];
    try { const value = JSON.parse(part.text); return value && typeof value === 'object' && !Array.isArray(value) ? [value] : []; }
    catch { return []; }
  }) : [];
  if (ueRefusalPrefix && (ueEnvelopes.length || result.structuredContent)) outcomeUnknown = true;
  if (operation.provider === 'ue-mcp' && (ueEnvelopes.length > 1
    || (result.structuredContent && ueEnvelopes.length === 1
      && !isDeepStrictEqual(result.structuredContent,ueEnvelopes[0])))) outcomeUnknown = true;
  // Pinned UE native handlers use HandlerResult.h's boolean success envelope;
  // the selected Node-local PCG waiter also supplies a boolean success field.
  // A dialog refusal can explicitly report that work had already started.
  if (operation.provider === 'ue-mcp' && payload?.partiallyApplied === true) outcomeUnknown = true;
  if (operation.provider === 'ue-mcp' && typeof payload?.success !== 'boolean') {
    failed = true;
    // Only reviewed pre-dispatch refusals can substitute for a native JSON receipt.
    const refusal = ueRefusalPrefix && !ueEnvelopes.length && !result.structuredContent;
    if (!refusal) outcomeUnknown = true;
  }
  if (operation.id === 'screenshot.viewport.current') {
    policy = 'require-inline-current-viewport-image';
    if (!result.content.some((part) => part.type === 'image'
      && typeof part.data === 'string' && part.data.length > 0
      && typeof part.mimeType === 'string' && part.mimeType.startsWith('image/'))) failed = true;
  }
  if (operation.id === 'pcg.generation.wait') {
    policy = 'require-exact-generated-run';
    // Native success:true also covers cancelled, idle, cleaned and not_started.
    if (!payload || payload.state !== 'generated'
      || payload.runId !== expectedArgs.runId || payload.lastRun?.id !== expectedArgs.runId
      || payload.lastRun?.state !== 'generated') failed = true;
  }
  if (outcomeUnknown) failed = true;
  return {
    ...result,
    ...(failed ? { isError: true } : {}),
    _meta: { ...result._meta, 'unreal-nexus/result-policy': {
      policy, outcomeUnknown,
      classification: outcomeUnknown ? 'outcome-unknown' : failed ? 'failure-or-unmet-contract' : 'response-received',
      note: 'Receipt is not independent proof of editor identity, completion, correctness or persistence.',
    } },
  };
}
