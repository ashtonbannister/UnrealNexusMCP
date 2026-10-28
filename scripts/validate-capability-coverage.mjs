// Offline consistency checks only. No upstream code is loaded or executed.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import coverage from '../catalog/capability-coverage.json' with {type:'json'};
import upstreams from '../catalog/upstreams.lock.json' with {type:'json'};
import inventory from '../catalog/inventory-summary.json' with {type:'json'};
import operations from '../catalog/operations.json' with {type:'json'};
import {reviewedUeBridgeFor} from '../src/provider-probes.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sha256 = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const pathOk = v => typeof v === 'string' && v.length > 0 && !v.startsWith('/')
  && !v.includes('\\') && !v.split('/')[0].includes(':') && !/[\x00-\x1f\x7f]/.test(v)
  && v.split('/').every(part => part && part !== '.' && part !== '..');
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const fail = message => {throw new Error('Capability inventory: ' + message);};

/** Check local records against the lock and prior inventory; no source attestation. */
export function validateCapabilityCoverage({ledger=coverage,lock=upstreams,summary=inventory,catalog=operations}={}) {
  if (!object(ledger) || ledger.version !== 1 || ledger.status !== 'partial-unreviewed'
    || !object(ledger.sources) || !Array.isArray(ledger.entries) || !Array.isArray(ledger.limitations)
    || !ledger.limitations.length) fail('expected an explicitly partial ledger with limitations');
  if (!object(lock?.sources) || !object(summary?.providers) || !Array.isArray(catalog?.operations)) fail('invalid supporting data');
  const providers=Object.keys(lock.sources);
  if (providers.length !== Object.keys(ledger.sources).length || providers.some(p=>!Object.hasOwn(ledger.sources,p))) fail('provider set differs from lock');
  const routes=new Map();
  for (const op of catalog.operations) {
    if (!nonempty(op?.id) || !Object.hasOwn(lock.sources,op.provider) || routes.has(op.id)) fail('invalid or duplicate catalog operation');
    routes.set(op.id,op);
  }
  const sourcePaths=new Map(), groupPaths=new Map(), groupCounts=new Map();
  // Existing rows without a surface belong to their provider's original
  // static subset. Explicit Claireon and UE snapshot surfaces are retained.
  const baselineSurfaces = {enginewire:['legacy-default'], 'ue-mcp':['legacy-default','recorded-epic-catalog'],
    unrealagentplayer:['legacy-default'], hayba:['legacy-default'], 'ivan-unreal-mcp':['legacy-default'],
    claireon:['internal-tool-static-declaration','mcp-visible-name-filter']};
  for (const provider of providers) {
    const item=ledger.sources[provider], pin=lock.sources[provider], recorded=summary.providers[provider];
    if (!object(item) || !object(recorded) || item.commit !== pin.commit || recorded.commit !== pin.commit) fail('commit mismatch for ' + provider);
    if ((item.repository && item.repository !== pin.repository) || recorded.repository !== pin.repository) fail('repository mismatch for ' + provider);
    if (!Number.isSafeInteger(item.count) || item.count < 0) fail('invalid source count for ' + provider);
    const all=[];
    if (item.path !== undefined) all.push({path:item.path,sha256:item.sha256});
    if (item.sources !== undefined) {
      if (!Array.isArray(item.sources) || !item.sources.length) fail('invalid source files for ' + provider);
      all.push(...item.sources);
    }
    if (item.additionalSnapshots !== undefined) {
      if (!object(item.additionalSnapshots)) fail('invalid additional snapshots for ' + provider);
      for (const snapshot of Object.values(item.additionalSnapshots)) {
        if (!object(snapshot) || snapshot.commit !== pin.commit || snapshot.repository !== pin.repository) fail('snapshot pin mismatch for ' + provider);
        if (!Number.isSafeInteger(snapshot.recordedTools) || snapshot.recordedTools < 0) fail('invalid snapshot count for ' + provider);
        all.push(snapshot);
      }
    }
    if (item.additionalSourceGroups !== undefined) {
      if (!object(item.additionalSourceGroups)) fail('invalid additional source groups for ' + provider);
      for (const [surface,group] of Object.entries(item.additionalSourceGroups)) {
        if (!nonempty(surface) || baselineSurfaces[provider]?.includes(surface) || !object(group)
          || group.sourceVersion !== 1 || group.provider !== provider || group.status !== 'partial-unreviewed'
          || group.commit !== pin.commit || group.repository !== pin.repository
          || !nonempty(group.scope) || !nonempty(group.method) || !Array.isArray(group.limitations) || !group.limitations.length
          || !Array.isArray(group.sources) || !Number.isSafeInteger(group.sourceCount) || group.sources.length !== group.sourceCount
          || !Number.isSafeInteger(group.entryCount) || group.entryCount < 0
          || !Array.isArray(group.unmatchedSources) || !Number.isSafeInteger(group.unmatchedSourceCount)
          || group.unmatchedSources.length !== group.unmatchedSourceCount
          || new Set(group.unmatchedSources).size !== group.unmatchedSources.length) fail('invalid additional source group for ' + provider);
        const groupKey=JSON.stringify([provider,surface]), fileSet=new Set();
        for (const file of group.sources) {
          if (!object(file) || !pathOk(file.path) || !sha256(file.sha256) || fileSet.has(file.path)
            || (file.gitBlobSha1 !== undefined && !/^[a-f0-9]{40}$/.test(file.gitBlobSha1))) fail('invalid group source for ' + provider);
          fileSet.add(file.path);
        }
        if (group.unmatchedSources.some(file=>!fileSet.has(file))) fail('unknown unmatched group source for ' + provider);
        const supporting = new Map();
        if (group.supportingSources !== undefined) {
          if (!Array.isArray(group.supportingSources) || !group.supportingSources.length) fail('invalid supporting sources for ' + provider);
          const supportPaths=new Set();
          for (const file of group.supportingSources) {
            if (!object(file) || !pathOk(file.path) || !sha256(file.sha256) || !nonempty(file.role)
              || supportPaths.has(file.path) || fileSet.has(file.path)
              || (file.gitBlobSha1 !== undefined && !/^[a-f0-9]{40}$/.test(file.gitBlobSha1))) fail('invalid supporting source for ' + provider);
            supportPaths.add(file.path);supporting.set(file.path,file.role);
          }
          all.push(...group.supportingSources);
        }
        if (provider==='hayba' && surface==='material-custom-handler') {
          // The six custom handlers and the explicitly identified non-tool
          // helper are exactly the seven files unmatched by literal extraction.
          // This is local metadata consistency, not upstream source attestation.
          const literal=item.additionalSourceGroups['material-typed-wrapper-literal'];
          const helpers=(group.supportingSources ?? []).filter(file=>file.role==='internal compile feedback helper; not a tool descriptor');
          const original=Array.isArray(literal?.sources) ? new Map(literal.sources.map(file=>[file.path,file])) : new Map();
          const unmatched=Array.isArray(literal?.unmatchedSources) ? new Set(literal.unmatchedSources) : new Set();
          const accounted=[...group.sources,...helpers], paths=new Set(accounted.map(file=>file.path));
          if (helpers.length!==1 || group.sources.length!==6 || unmatched.size!==7 || paths.size!==7
            || [...paths].some(path=>!unmatched.has(path))
            || accounted.some(file=>!original.has(file.path) || !/^[a-f0-9]{40}$/.test(file.gitBlobSha1)
              || original.get(file.path).sha256!==file.sha256
              || original.get(file.path).gitBlobSha1!==file.gitBlobSha1)) fail('custom handler source reconciliation mismatch');
        }
        groupPaths.set(groupKey,{fileSet,supporting,unmatched:new Set(group.unmatchedSources),represented:new Set(),expected:group.entryCount});
        groupCounts.set(groupKey,0);
        all.push(...group.sources);
      }
    }
    if (!all.length) fail('missing source files for ' + provider);
    const paths=new Map();
    for (const source of all) {
      if (!object(source) || !pathOk(source.path) || !sha256(source.sha256)
        || (paths.has(source.path) && paths.get(source.path)!==source.sha256)) fail('invalid source path or hash for ' + provider);
      paths.set(source.path,source.sha256);
    }
    const expected=Array.isArray(recorded.sources) ? recorded.sources : [{path:recorded.source,sha256:recorded.sha256}];
    for (const source of expected) {
      if (!pathOk(source.path) || !sha256(source.sha256) || paths.get(source.path) !== source.sha256) fail('recorded source hash mismatch for ' + provider);
    }
    sourcePaths.set(provider,paths);
  }
  const counts=new Map(providers.map(p=>[p,0])), keys=new Set(), selected=[];
  let epicCount=0;
  for (const entry of ledger.entries) {
    if (!object(entry) || !Object.hasOwn(ledger.sources,entry.provider) || !nonempty(entry.sourceEntry)
      || !nonempty(entry.reviewOwnerTask)) fail('invalid source record');
    const surface=entry.surface ?? 'legacy-default';
    if (!nonempty(surface)) fail('invalid source surface for ' + entry.provider);
    const groupKey=JSON.stringify([entry.provider,surface]), group=groupPaths.get(groupKey);
    if (!group && !baselineSurfaces[entry.provider]?.includes(surface)) fail('unknown source surface for ' + entry.provider);
    const key=JSON.stringify([entry.provider,surface,entry.sourceEntry]);
    if (keys.has(key)) fail('duplicate source record for ' + entry.provider + ': ' + entry.sourceEntry);
    keys.add(key);
    const isEpic=entry.provider==='ue-mcp' && surface==='recorded-epic-catalog';
    if (group) {
      if (!group.fileSet.has(entry.sourcePath) || group.unmatched.has(entry.sourcePath)) fail('unknown group record source for ' + entry.provider);
      if (surface==='material-custom-handler' && (!nonempty(entry.handlerExport)
        || !Number.isSafeInteger(entry.handlerDeclarationLine) || entry.handlerDeclarationLine < 1
        || !Number.isSafeInteger(entry.nativeDispatchLine) || entry.nativeDispatchLine < 1
        || !Number.isSafeInteger(entry.registryDescriptorLine) || entry.registryDescriptorLine < 1
        || group.supporting.get(entry.registryPath)!=='static descriptor registration index')) fail('invalid custom handler evidence for ' + entry.provider);
      group.represented.add(entry.sourcePath);
      groupCounts.set(groupKey,groupCounts.get(groupKey)+1);
    } else if (isEpic) epicCount++; else counts.set(entry.provider,counts.get(entry.provider)+1);
    if (entry.sourcePath !== undefined && !sourcePaths.get(entry.provider).has(entry.sourcePath)) fail('unknown source path for ' + entry.provider);
    const refs=entry.canonicalRouteReferences ?? [];
    if (!Array.isArray(refs) || new Set(refs).size !== refs.length) fail('invalid route references for ' + entry.sourceEntry);
    if (!['unreviewed','blocked','selected-route-slice-other-semantics-unreviewed'].includes(entry.disposition)) fail('unsupported disposition for ' + entry.sourceEntry);
    if ((entry.disposition==='selected-route-slice-other-semantics-unreviewed') !== (refs.length>0)) fail('disposition/route mismatch for ' + entry.sourceEntry);
    if (entry.disposition==='blocked') {
      if (!nonempty(entry.blockReason) || !nonempty(entry.reopeningCondition)
        || !Array.isArray(entry.sourceEvidence) || !entry.sourceEvidence.length
        || !entry.sourceEvidence.every(e=>object(e) && e.commit===lock.sources[entry.provider].commit
          && pathOk(e.path) && Array.isArray(e.lines) && e.lines.length===2
          && Number.isSafeInteger(e.lines[0]) && Number.isSafeInteger(e.lines[1])
          && e.lines[0]>0 && e.lines[1]>=e.lines[0])) fail('invalid blocked evidence for ' + entry.sourceEntry);
    }
    for (const id of refs) {
      const op=routes.get(id);
      if (!op || op.provider !== entry.provider) fail('invalid selected route reference for ' + entry.sourceEntry);
      // The provider probe owns the reviewed UE route-to-bridge mapping.
      // This consistency check is not independent source or runtime attestation.
      // Specialist/unknown kinds remain held until a shared authoritative
      // source-entry correspondence exists.
      const route=op.route;
      if (!['direct','ue-micro','enginewire'].includes(route?.kind)
        || (route?.kind==='direct' && route.tool!==entry.sourceEntry)
        || (route?.kind==='ue-micro' && (route.category!==entry.category
          || reviewedUeBridgeFor(route.category,route.method)!==entry.sourceEntry))
        || (route?.kind==='enginewire' && (!Array.isArray(entry.legacySelectors)
          || !entry.legacySelectors.some(s=>s.tool===route.tool && s.action===route.action)))) {
        fail('invalid selected route reference for ' + entry.sourceEntry);
      }
      selected.push(id);
    }
  }
  for (const provider of providers) if (counts.get(provider)!==ledger.sources[provider].count) fail('record count mismatch for ' + provider);
  for (const [key, group] of groupPaths) {
    if (groupCounts.get(key)!==group.expected) fail('additional source group count mismatch');
    if ([...group.fileSet].some(file=>!group.unmatched.has(file) && !group.represented.has(file))) fail('unaccounted group source');
  }
  const epic=ledger.sources['ue-mcp']?.additionalSnapshots?.['recorded-epic-catalog'];
  if (!epic || epicCount!==epic.recordedTools) fail('recorded Epic snapshot count mismatch');
  return {status:'partial-unreviewed', records:ledger.entries.length, selectedRouteReferences:selected.length,
    limitation:'Local metadata consistency only; source bytes, semantic dispositions, live registration and native qualification are not verified.'};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {console.log(JSON.stringify(validateCapabilityCoverage(),null,2));}
  catch (error) {console.error(error.message);process.exitCode=1;}
}
