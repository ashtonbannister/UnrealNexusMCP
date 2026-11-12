// Bounded offline discovery. Inventory records are evidence pointers, not routes.
import {NexusError} from './errors.mjs';
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
