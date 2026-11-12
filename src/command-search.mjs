// Bounded offline discovery. Inventory records are evidence pointers, not routes.
import {NexusError} from './errors.mjs';
import {reviewedUeBridgeFor} from './provider-probes.mjs';
const text = value => typeof value === 'string' ? value : '';
const normalize = value => text(value).replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export async function searchCommands(gateway, args, loadInventory = () => import('../catalog/capability-coverage.json', {with:{type:'json'}})) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['query','limit','offset'].includes(key))
    || typeof args.query !== 'string' || [...args.query].length > 256
    || (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50))
    || (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || args.offset < 0 || args.offset > 100000))) {
    throw new NexusError('INVALID_ARGUMENTS','Search needs a query of at most 256 characters, limit 1–50 and a nonnegative offset.');
  }
  const limit=args.limit ?? 20, offset=args.offset ?? 0;
  const terms=normalize(args.query).split(' ').filter(Boolean);
  const matches = value => {const searchable=normalize(value);return terms.every(term=>searchable.includes(term));};
  const enabled=new Set(gateway.list().map(op=>op.id));
  const held=new Set(gateway.status().heldCapabilities.map(op=>op.id));
  const canonical=gateway.catalog.list().filter(op=>matches([op.id,op.description,op.provider].join(' '))).map(op=>({
    kind:'canonical',id:op.id,description:op.description,provider:op.provider,effect:op.effect,
    enabled:enabled.has(op.id),held:enabled.has(op.id) ? held.has(op.id) : null,availability:'not-checked',
  }));
  const inventory=(await loadInventory()).default;
  if (!Array.isArray(inventory?.entries)) throw new NexusError('INVENTORY_UNAVAILABLE','Source inventory is unavailable.');
  const index=(await import('../catalog/enginewire-search-index.json',{with:{type:'json'}})).default;
  const source=inventory.sources?.enginewire;
  if (index?.version!==1 || index.provider!=='enginewire' || index.commit!==gateway.catalog.upstreams.sources.enginewire.commit
    || index.sourceSha256!==source?.sha256 || index.sourcePath!==source?.path || !index.records || typeof index.records!=='object') {
    throw new NexusError('INVENTORY_UNAVAILABLE','EngineWire search metadata does not match the pinned inventory.');
  }
  const metadata = row => row.provider==='enginewire' && (row.surface ?? 'legacy-default')==='legacy-default'
    ? index.records[row.sourceEntry] : undefined;
  const sources=inventory.entries.filter(row=>{const m=metadata(row);return matches([row.sourceEntry,row.provider,row.category,row.sourceGroup,m?.summary,...(m?.terms ?? [])].map(text).join(' '));}).map(row=>{
    const m=metadata(row);
    return {kind:'source-record',provider:row.provider,sourceEntry:row.sourceEntry,
      surface:row.surface ?? 'legacy-default',disposition:row.disposition,
      reviewOwnerTask:row.reviewOwnerTask ?? null,canonicalRouteReferences:row.canonicalRouteReferences ?? [],
      ...(m?.summary ? {summary:m.summary,summaryTruncated:m.summaryTruncated} : {})};
  });
  const all=[...canonical,...sources];
  return {query:args.query,results:all.slice(offset,offset+limit),total:all.length,
    nextOffset:offset+limit<all.length?offset+limit:null,
    note:'Source records are overlapping static inventory, not callable operations or proof of live availability.'};
}

// A source record is a static discovery reference, not an executable route.
export async function describeSource(gateway, args, loadInventory = () => import('../catalog/capability-coverage.json', {with:{type:'json'}})) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['provider','surface','sourceEntry'].includes(key))
    || ['provider','surface','sourceEntry'].some(key => typeof args[key] !== 'string' || !args[key] || [...args[key]].length>256)) {
    throw new NexusError('INVALID_ARGUMENTS','Source description needs provider, surface and sourceEntry from a search result.');
  }
  const inventory=(await loadInventory()).default;
  if (!Array.isArray(inventory?.entries)) throw new NexusError('INVENTORY_UNAVAILABLE','Source inventory is unavailable.');
  const matches=inventory.entries.filter(row=>row.provider===args.provider && row.sourceEntry===args.sourceEntry
    && (row.surface ?? 'legacy-default')===args.surface);
  if (matches.length!==1) throw new NexusError('SOURCE_RECORD_NOT_FOUND','No unique source record matches those identifiers.');
  const source=gateway.catalog.upstreams.sources[args.provider];
  if (!source || inventory.sources?.[args.provider]?.commit!==source.commit) throw new NexusError('INVENTORY_UNAVAILABLE','Source record does not match the pinned provider.');
  const row=matches[0];
  if (Buffer.byteLength(JSON.stringify(row),'utf8')>32768) throw new NexusError('INVENTORY_RECORD_TOO_LARGE','Source record exceeds the description limit.');
  const enabled=new Set(gateway.list().map(op=>op.id));
  const held=new Set(gateway.status().heldCapabilities.map(op=>op.id));
  const bindings=gateway.catalog.list().filter(op=>op.provider===args.provider && (
    (op.route.kind==='ue-micro' && reviewedUeBridgeFor(op.route.category,op.route.method)===row.sourceEntry
      && (!row.category || row.category===op.route.category))
    || (op.route.kind==='enginewire' && `${op.route.tool}.${op.route.action}`===row.sourceEntry)
    || (op.route.kind==='direct' && op.route.tool===row.sourceEntry)
  )).map(op=>({id:op.id,enabled:enabled.has(op.id),held:enabled.has(op.id)?held.has(op.id):null}));
  return {record:structuredClone(row),source:{repository:source.repository,commit:source.commit,license:source.license},
    currentBindings:bindings,note:'Static source record and exact current route bindings only. This does not prove semantic equivalence, runtime availability, or permission to execute. Inventory dispositions may predate newer routes.'};
}
