// Build a search-only index from the exact locked EngineWire catalogue.
// No upstream JavaScript is imported or executed. Existing output is never replaced.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import coverage from '../catalog/capability-coverage.json' with {type:'json'};
import lock from '../catalog/upstreams.lock.json' with {type:'json'};

export async function buildEngineWireIndex(root) {
  const source=coverage.sources.enginewire, pin=lock.sources.enginewire;
  if (source.commit !== pin.commit || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('EngineWire inventory pin mismatch');
  const bytes=await readFile(path.join(root,...source.path.split('/')));
  if (bytes.length>8*1024*1024 || createHash('sha256').update(bytes).digest('hex')!==source.sha256) throw new Error('EngineWire catalogue source hash mismatch');
  const doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!Array.isArray(doc.records) || doc.records.length!==source.count || doc.recordCount!==source.count) throw new Error('EngineWire catalogue record count mismatch');
  const records={};
  for (const row of doc.records) {
    if (typeof row.id!=='string' || !row.id || Object.hasOwn(records,row.id)) throw new Error('Invalid or duplicate capability id');
    const discovery=row.discovery ?? {};
    const summary=typeof discovery.summary==='string' ? discovery.summary.slice(0,2048) : '';
    const candidates=[discovery.domain,discovery.family,...(Array.isArray(discovery.topics)?discovery.topics:[]),...(Array.isArray(row.aliases)?row.aliases:[])];
    const terms=[...new Set(candidates.filter(v=>typeof v==='string' && v.length>0 && v.length<=256))].slice(0,100);
    records[row.id]={summary,summaryTruncated:typeof discovery.summary==='string' && discovery.summary.length>2048,terms};
  }
  return {version:1,provider:'enginewire',commit:pin.commit,sourcePath:source.path,sourceSha256:source.sha256,records};
}
async function main() {
  if (process.argv.length!==4) throw new Error('Usage: node scripts/build-enginewire-search-index.mjs <upstream-root> <new-output.json>');
  await writeFile(process.argv[3],JSON.stringify(await buildEngineWireIndex(process.argv[2]),null,2)+'\n',{encoding:'utf8',flag:'wx'});
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
