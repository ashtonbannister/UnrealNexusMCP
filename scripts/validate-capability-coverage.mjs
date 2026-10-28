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
  const sourcePaths=new Map();
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
    if (!all.length) fail('missing source files for ' + provider);
    const paths=new Map();
    for (const source of all) {
      if (!object(source) || !pathOk(source.path) || !sha256(source.sha256) || paths.has(source.path)) fail('invalid source path or hash for ' + provider);
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
    const key=JSON.stringify([entry.provider,entry.sourceEntry]);
    if (keys.has(key)) fail('duplicate source record for ' + entry.provider + ': ' + entry.sourceEntry);
    keys.add(key);
    const isEpic=entry.provider==='ue-mcp' && entry.surface==='recorded-epic-catalog';
    if (isEpic) epicCount++; else counts.set(entry.provider,counts.get(entry.provider)+1);
    if (entry.sourcePath !== undefined && !sourcePaths.get(entry.provider).has(entry.sourcePath)) fail('unknown source path for ' + entry.provider);
    const refs=entry.canonicalRouteReferences ?? [];
    if (!Array.isArray(refs) || new Set(refs).size !== refs.length) fail('invalid route references for ' + entry.sourceEntry);
    if (!['unreviewed','selected-route-slice-other-semantics-unreviewed'].includes(entry.disposition)) fail('unsupported disposition for ' + entry.sourceEntry);
    if ((entry.disposition==='unreviewed') !== (refs.length===0)) fail('disposition/route mismatch for ' + entry.sourceEntry);
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
  const epic=ledger.sources['ue-mcp']?.additionalSnapshots?.['recorded-epic-catalog'];
  if (!epic || epicCount!==epic.recordedTools) fail('recorded Epic snapshot count mismatch');
  return {status:'partial-unreviewed', records:ledger.entries.length, selectedRouteReferences:selected.length,
    limitation:'Local metadata consistency only; source bytes, semantic dispositions, live registration and native qualification are not verified.'};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {console.log(JSON.stringify(validateCapabilityCoverage(),null,2));}
  catch (error) {console.error(error.message);process.exitCode=1;}
}
