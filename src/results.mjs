import { isDeepStrictEqual } from 'node:util';
import { nativeOutcomeUnknown } from './native-outcomes.mjs';
import { validatePngScanlineIntegrity } from './png-scanline-integrity.mjs';

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
// EngineWire's pinned native transport limits returned PNG bytes to 3 MiB.
// Validates bounded PNG framing and scanlines, not full decoding or pixels.
function viewportImageReceipt(result, expectedArgs) {
  const envelope = result.structuredContent;
  if (!record(envelope) || envelope.success !== true || envelope.operation !== 'execute'
    || !record(envelope.data) || result.isError === true) return false;
  const {width,height,view,sizeBytes,mimeType} = envelope.data;
  // The selected native route always requests inline image output. Its pinned
  // default bounding box is 1600x900; explicit resolution is also a downscale
  // bounding box, not an exact rerender or a preallocation limit.
  const resolution = expectedArgs.resolution ?? '1600x900';
  const box = typeof resolution === 'string' && /^([1-9][0-9]{0,3})x([1-9][0-9]{0,3})$/u.exec(resolution);
  if (!box || width > Number(box[1]) || height > Number(box[2])) return false;
  const maxBytes = 3 * 1024 * 1024, maxPixels = 4 * 1024 * 1024;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0
    || width > Math.floor(maxPixels / height)
    || !['editor_viewport','pie_game','pie_ejected'].includes(view) || mimeType !== 'image/png'
    || !Number.isSafeInteger(sizeBytes) || sizeBytes < 45 || sizeBytes > maxBytes) return false;
  const images = result.content.filter(part => part?.type === 'image');
  if (images.length !== 1 || images[0].mimeType !== 'image/png' || typeof images[0].data !== 'string') return false;
  const encoded = images[0].data;
  if (encoded.length !== 4 * Math.ceil(sizeBytes / 3)
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) return false;
  const png = Buffer.from(encoded,'base64');
  if (png.length !== sizeBytes || png.toString('base64') !== encoded) return false;
  try {
    validatePngScanlineIntegrity(png,{width,height,maxEncodedBytes:maxBytes,maxPixels,
      maxInflatedBytes:40 * 1024 * 1024,maxDimension:9999,maxChunks:4096});
  } catch { return false; }
  return true;
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
    if (operation.id === 'pie.status' && payload && typeof payload.phase === 'string'
      && !['NotPlaying','Starting','Playing','Paused','Ending'].includes(payload.phase)) {
      failed = true; outcomeUnknown = true;
    }
    if (operation.id === 'pie.start.viewport'
      && (payload?.playing !== true || !['Playing','Paused'].includes(payload?.phase))) failed = true;
    if (operation.id === 'pie.stop' && (payload?.stopped !== true || payload?.phase !== 'NotPlaying')) failed = true;
  }
  if (operation.provider === 'unrealagentplayer' && operation.effect === 'lifecycle') {
    // Native start deadlines return a normal MCP response while queued work can
    // still take effect. Stop can likewise return before teardown is complete.
    outcomeUnknown = !payload
      || typeof payload.phase !== 'string' || !['NotPlaying','Starting','Playing','Paused','Ending'].includes(payload.phase)
      || ['UE_CONNECTION_RESET','UE_CROSSED_RESPONSE','PYTHON_RUNTIME'].includes(payload.error?.code)
      || (payload.queued === true && payload.confirmed !== true)
      || ['Starting','Ending'].includes(payload.phase)
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
    if (!viewportImageReceipt(result,expectedArgs)) {
      failed = true;
      // Native errors, including TIMEOUT, may follow dispatch; no reviewed
      // screenshot-specific pre-dispatch refusal is assumed here.
      outcomeUnknown = true;
    }
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
  if (['actor.inspect.editor','actor.inspect.pie'].includes(operation.id) && payload?.success === true) {
    policy = 'require-matching-actor-path';
    // UE trims paths and has a case-insensitive fallback. Conservatively fence
    // normalized paths rather than claiming an exact string match.
    if (result.isError === true || typeof expectedArgs.actorPath !== 'string'
      || payload.actorPath !== expectedArgs.actorPath || payload.path !== expectedArgs.actorPath) {
      failed = true; outcomeUnknown = true;
    }
    // The native receipt does not report the resolved world or PIE instance.
  }
  if (operation.id === 'pcg.generation.execute') {
    policy = 'require-correlated-pcg-generation-acknowledgement';
    // The pinned handler selects the first component, starts a run and may
    // change its seed before returning. A receipt is not a completion claim.
    if (payload?.success === true) {
      const run = payload.lastRun;
      const coherent = result.isError !== true && payload.updated === true
        && typeof expectedArgs.actorPath === 'string' && payload.actorPath === expectedArgs.actorPath
        && typeof payload.componentName === 'string' && payload.componentName.length > 0
        && Number.isSafeInteger(payload.runId) && payload.runId > 0 && payload.runId <= 2147483647
        && record(run) && run.id === payload.runId
        && ['generating','generated','cancelled','cleaned','not_started'].includes(run.state)
        && Number.isInteger(payload.seed) && payload.seed >= -2147483648 && payload.seed <= 2147483647
        && (!Object.hasOwn(expectedArgs,'seed') || payload.seed === expectedArgs.seed);
      if (!coherent) { failed = true; outcomeUnknown = true; }
    } else if (payload?.success === false) {
      // An unmarked native error does not establish whether the generation or
      // seed change happened. Preserve it; do not replay or infer rollback.
      outcomeUnknown = true;
    }
  }
  if (operation.id === 'input.action.once') {
    policy = 'require-correlated-local-input-receipt';
    if (payload?.success === true) {
      const correlated = payload.action === expectedArgs.action_path
        && ['Boolean','Axis1D','Axis2D','Axis3D'].includes(payload.value_type)
        && payload.idempotencyObservable === false && nonempty(payload.idempotencyNote)
        && payload.rollbackPossible === false && nonempty(payload.rollbackNote)
        && !Object.hasOwn(payload,'relayed') && result.isError !== true;
      if (!correlated) { failed = true; outcomeUnknown = true; }
    } else if (payload?.success === false) {
      // A generic returned error does not identify whether a frame was injected.
      outcomeUnknown = true;
    }
  }
  if (operation.id === 'pcg.generation.wait') {
    policy = 'require-exact-generated-run';
    // The pinned waiter uses timed_out for both an elapsed deadline and a
    // failed state read. Neither establishes that the native run has stopped.
    if (payload?.state === 'timed_out') { failed = true; outcomeUnknown = true; }
    // Native success:true also covers cancelled, idle, cleaned and not_started.
    if (!payload || payload.state !== 'generated'
      || payload.runId !== expectedArgs.runId || payload.lastRun?.id !== expectedArgs.runId
      || payload.lastRun?.state !== 'generated') failed = true;
    // Native/preflight failures may omit identity; any identity actually
    // reported by either a success or failure must match the selected target.
    if (payload && ((Object.hasOwn(payload,'componentName') && payload.componentName !== expectedArgs.componentName)
      || (Object.hasOwn(payload,'actorPath') && payload.actorPath !== expectedArgs.actorPath)
      || (Object.hasOwn(payload,'runId') && payload.runId !== expectedArgs.runId))) {
      failed = true; outcomeUnknown = true;
    }
    // A successful native state includes the component name; failed preflight
    // responses may omit it. Cancellation can carry a later lastRun ID.
    const terminalMatch = ['cancelled','cleaned','not_started'].includes(payload?.state)
      && payload.lastRun?.id === expectedArgs.runId && payload.lastRun?.state === payload.state;
    const superseded = payload?.state === 'cancelled' && Number.isSafeInteger(payload.lastRun?.id)
      && payload.lastRun.id > expectedArgs.runId;
    if (payload?.success === true && payload.state !== 'generated'
      && (result.isError === true || payload.runId !== expectedArgs.runId
        || payload.componentName !== expectedArgs.componentName || (!terminalMatch && !superseded))) {
      failed = true; outcomeUnknown = true;
    }
    // The pinned waiter returns the native component name, but drops actorPath.
    // Never infer the actor from its echoed request or from the run ID alone.
    if (payload?.success === true && payload.state === 'generated'
      && (result.isError === true || payload.runId !== expectedArgs.runId
        || payload.lastRun?.id !== expectedArgs.runId || payload.lastRun?.state !== 'generated'
        || payload.componentName !== expectedArgs.componentName
        || (Object.hasOwn(payload,'actorPath') && payload.actorPath !== expectedArgs.actorPath))) {
      failed = true; outcomeUnknown = true;
    }
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
