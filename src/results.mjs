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
// Native save rows are per resolved package, not per requested object: two
// requested objects may collapse to one package row. A shorter receipt cannot
// prove whether a path was an alias or omitted, so it is conservatively fenced.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
function coherentExactAssetSave(payload, args, isFailure = false) {
  if (!Array.isArray(args.assetPaths) || !args.assetPaths.length || !Array.isArray(payload.results)
    || payload.results.length < 1 || payload.results.length > args.assetPaths.length
    || payload.force !== (args.force ?? false)
    || !count(payload.savedCount) || !count(payload.notDirtyCount) || !count(payload.failedCount)
    || (isFailure ? payload.failedCount < 1 || !nonempty(payload.error) : payload.failedCount !== 0 || Object.hasOwn(payload,'error'))
    || payload.savedCount + payload.notDirtyCount + payload.failedCount !== payload.results.length
    || Object.hasOwn(payload,'refused') || payload.rollbackPossible !== false || !nonempty(payload.rollbackNote)) return false;
  if (payload.savedCount > 0 ? payload.updated !== true || Object.hasOwn(payload,'unchanged')
    : payload.updated !== false || payload.unchanged !== true) return false;
  const requested = new Set(args.assetPaths.map(path => typeof path === 'string' ? path.trim() : path));
  if (payload.results.length !== requested.size) return false;
  const paths = new Set(), packages = new Set();
  let saved = 0, clean = 0, failed = 0;
  for (const row of payload.results) {
    if (!record(row) || !nonempty(row.path) || !requested.has(row.path) || paths.has(row.path)
      || !nonempty(row.package) || packages.has(row.package) || typeof row.wasDirty !== 'boolean') return false;
    paths.add(row.path); packages.add(row.package);
    if (row.status === 'saved') {
      if (typeof row.stillDirty !== 'boolean' || (!row.wasDirty && !payload.force)) return false;
      saved++;
    } else if (row.status === 'notDirty') {
      if (row.wasDirty || payload.force) return false;
      clean++;
    } else if (row.status === 'failed' && isFailure) {
      if (typeof row.stillDirty !== 'boolean' || !nonempty(row.reason) || (!row.wasDirty && !payload.force)) return false;
      failed++;
    } else return false;
  }
  if (saved !== payload.savedCount || clean !== payload.notDirtyCount || failed !== payload.failedCount) return false;
  if (isFailure) {
    const first = payload.results.find(row => row.status === 'failed');
    return payload.error === `${failed} of ${saved + failed} packages did not reach disk. The first: ${first.package}: ${first.reason}`;
  }
  return true;
}
// Native validates the complete selector before entering its save loop and
// explicitly reports every refused input. Do not infer package aliases here.
function exactAssetPreflightRefusal(payload, args) {
  if (!Array.isArray(args.assetPaths) || !args.assetPaths.length || !Array.isArray(payload.refused)
    || !payload.refused.length || payload.refused.length > args.assetPaths.length
    || Object.keys(payload).length !== 3 || !nonempty(payload.error)) return false;
  const requested = new Set(args.assetPaths.map(path => typeof path === 'string' ? path.trim() : path));
  if (!payload.refused.every(row => record(row) && nonempty(row.path) && requested.has(row.path)
    && row.status === 'refused' && nonempty(row.reason))) return false;
  const first = payload.refused[0];
  return payload.error === `${payload.refused.length} of ${args.assetPaths.length} assetPaths cannot be saved, so nothing was written. The first: '${first.path}' - ${first.reason}`;
}
function coherentLevelSave(payload, isFailure = false) {
  if (!nonempty(payload.levelName) || !nonempty(payload.levelPath) || !nonempty(payload.levelPackage)
    || typeof payload.usesExternalActors !== 'boolean' || !count(payload.externalPackagesLoaded)
    || !count(payload.landscapesMerged) || !count(payload.savedCount) || !count(payload.failedCount)
    || (isFailure ? payload.failedCount < 1 || !nonempty(payload.error) : payload.failedCount !== 0 || Object.hasOwn(payload,'error'))
    || !count(payload.skippedCount) || !count(payload.deletedCount) || !Array.isArray(payload.saved)
    || payload.saved.length !== payload.savedCount) return false;
  if (payload.savedCount + payload.deletedCount > 0
    ? payload.rollbackPossible !== false || !nonempty(payload.rollbackNote)
    : Object.hasOwn(payload,'rollbackPossible') || Object.hasOwn(payload,'rollbackNote')) return false;
  const rows = (field, n) => payload[field] === undefined ? n === 0
    : Array.isArray(payload[field]) && payload[field].length === n;
  if (!rows('skipped',payload.skippedCount) || !rows('deleted',payload.deletedCount)
    || !rows('failed',payload.failedCount)) return false;
  if (!payload.saved.every(row => record(row) && nonempty(row.package) && row.saved === true)) return false;
  if (!(payload.skipped ?? []).every(row => record(row) && nonempty(row.package)
    && row.saved === false && row.skipped === true)) return false;
  if (!(payload.deleted ?? []).every(row => record(row) && nonempty(row.package)
    && row.emptyPackage === true && typeof row.deleted === 'boolean'
    && (row.deleted ? !Object.hasOwn(row,'neverOnDisk') : row.neverOnDisk === true))) return false;
  if (!(payload.failed ?? []).every(row => record(row) && nonempty(row.package) && nonempty(row.error)
    && (row.saved === false || (row.emptyPackage === true && row.saved === undefined)))) return false;
  if (isFailure && payload.error !== payload.failed[0].error) return false;
  const levelRows = [...payload.saved,...(payload.skipped ?? []),...(payload.failed ?? [])];
  const packages = [...levelRows,...(payload.deleted ?? [])].map(row => row.package);
  return levelRows.filter(row => row.package === payload.levelPackage).length === 1
    && new Set(packages).size === packages.length;
}
const levelPieRefusal = payload => Object.keys(payload).length === 2
  && payload.error === 'Play In Editor is running; stop it before saving the level. Saving during PIE is what produced an unexplained failure before.';
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
  if (operation.id === 'asset.save.exact' || operation.id === 'level.save.current') {
    policy = operation.id === 'asset.save.exact' ? 'require-coherent-exact-asset-save-receipt' : 'require-coherent-level-save-receipt';
    if (payload?.success === true && (result.isError === true
      || !(operation.id === 'asset.save.exact' ? coherentExactAssetSave(payload,expectedArgs) : coherentLevelSave(payload)))) {
      // A returned but contradictory success cannot establish which work completed.
      failed = true; outcomeUnknown = true;
    }
    if (payload?.success === false) {
      const known = operation.id === 'asset.save.exact'
        ? exactAssetPreflightRefusal(payload,expectedArgs) || coherentExactAssetSave(payload,expectedArgs,true)
        : levelPieRefusal(payload) || coherentLevelSave(payload,true);
      if (!known) outcomeUnknown = true;
    }
  }
  if (operation.id === 'pcg.graph.connect.persisted') {
    policy = 'require-verified-persisted-pcg-edge';
    // The pinned native existing-edge path returns before its save attempt.
    // An in-memory no-op receipt does not prove the edge was persisted.
    if (payload?.edgeVerified !== true || payload?.saved !== true) failed = true;
    // A success receipt without the exact requested identity cannot be safely
    // correlated to this dispatch. Unreal renders pin FNames; exact comparison
    // can conservatively reject a legitimate case-normalized label.
    const identityMatches = payload && [
      ['assetPath','assetPath'],['sourceNodeName','sourceNode'],
      ['targetNodeName','targetNode'],['sourcePinLabel','sourcePin'],
      ['targetPinLabel','targetPin'],
    ].every(([receiptField,argument]) => typeof payload[receiptField] === 'string'
      && payload[receiptField] === expectedArgs[argument]);
    if (payload?.success === true) {
      const existingEdge = payload.created === false && payload.existed === true
        && payload.edgeVerified === true && payload.rollbackPossible === false
        && !Object.hasOwn(payload, 'saved') && !Object.hasOwn(payload, 'transient');
      const createdAndSaved = payload.created === true && payload.existed === false
        && payload.edgeVerified === true && payload.saved === true && !Object.hasOwn(payload, 'transient');
      const createdTransient = payload.created === true && payload.existed === false
        && payload.edgeVerified === true && payload.saved === false && payload.transient === true;
      if (!identityMatches || result.isError === true
        || (!existingEdge && !createdAndSaved && !createdTransient)) outcomeUnknown = true;
    }
    if (payload?.success === false) {
      // At this pin a plain MCPError can occur after Graph->Modify/AddEdge.
      // Only two exact preflight errors and a correlated, explicit save failure
      // establish what happened without additional native evidence.
      const exactPinRefusal = Object.keys(payload).length === 2
        && ['No suitable output pin found on source node',
          'No suitable input pin found on target node'].includes(payload.error);
      const knownSaveFailure = identityMatches && payload.created === true
        && payload.existed === false && payload.edgeVerified === true
        && payload.saved === false && typeof payload.saveError === 'string';
      if (!exactPinRefusal && !knownSaveFailure) outcomeUnknown = true;
    }
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
