// Read-only, local Git comparison of existing evidence spans. It does not
// import upstream code, compare full behavior, or promote a candidate.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import lock from '../catalog/upstreams.lock.json' with {type:'json'};
import decisions from '../catalog/decisions.json' with {type:'json'};

const exec=promisify(execFile);
const sha=value=>typeof value==='string' && /^[a-f0-9]{40}$/.test(value);
const relative=value=>typeof value==='string' && value.length>0 && value.length<=1024
  && !value.startsWith('/') && !value.includes('\\') && !/[\x00-\x1f\x7f]/u.test(value)
  && !value.split('/')[0].includes(':') && value.split('/').every(x=>x && x!=='.' && x!=='..');
async function git(root,args) {
  const {stdout}=await exec('git',['--no-optional-locks','-c','core.fsmonitor=false','-C',root,...args],{
    encoding:'buffer',timeout:15000,maxBuffer:8*1024*1024,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0'},windowsHide:true,
  });return stdout;
}
function locate(base,candidate,start,end) {
  const old=base.split('\n'), next=candidate.split('\n');
  if (end>old.length) throw new Error('Evidence line range exceeds base source');
  const segment=old.slice(start-1,end).join('\n');if (!segment) throw new Error('Empty evidence span');
  const hits=[];let offset=0;
  while (offset<=candidate.length) {
    const i=candidate.indexOf(segment,offset);if(i<0)break;
    const finish=i+segment.length;
    if ((i===0 || candidate[i-1]==='\n') && (finish===candidate.length || candidate[finish]==='\n')) hits.push(i);
    if (hits.length>1) return {status:'ambiguous'};
    offset=i+1;
  }
  if (!hits.length) return {status:'changed'};
  const line=candidate.slice(0,hits[0]).split('\n').length;
  return {status:'unchanged-unique',candidateLines:[line,line+(end-start)]};
}
export async function mapCandidateEvidence({root,provider,candidateCommit,includeInventory=false},{sources=lock,ledger=decisions,inventory}={}) {
  const source=sources?.sources?.[provider];
  if (typeof root!=='string' || !path.isAbsolute(root) || !source || !sha(source.commit) || !sha(candidateCommit)) throw new Error('Invalid repository, provider or commit');
  await git(root,['cat-file','-e',source.commit+'^{commit}']);await git(root,['cat-file','-e',candidateCommit+'^{commit}']);
  if (typeof includeInventory!=='boolean') throw new Error('Invalid inventory option');
  const evidence=ledger.decisions.flatMap(d=>(d.evidence??[]).filter(e=>e.provider===provider).map(e=>({decision:d.id,...e})));
  if (includeInventory) {
    const data=inventory ?? (await import('../catalog/capability-coverage.json',{with:{type:'json'}})).default;
    if (!Array.isArray(data?.entries) || data.sources?.[provider]?.commit!==source.commit) throw new Error('Inventory does not match base pin');
    for (const row of data.entries.filter(item=>item.provider===provider)) {
      for (const e of row.sourceEvidence ?? []) {
        if (e.commit!==source.commit) throw new Error('Inventory evidence does not match base pin');
        evidence.push({sourceEntry:row.sourceEntry,surface:row.surface ?? 'legacy-default',...e});
      }
    }
  }
  const cache=new Map(), decoder=new TextDecoder('utf-8',{fatal:true});
  async function read(commit,file) {
    const key=commit+':'+file;if(!cache.has(key)) cache.set(key,git(root,['show',key]).then(b=>decoder.decode(b)));return cache.get(key);
  }
  const spans=[];
  for (const e of evidence) {
    const reference=e.sourceEntry ? {sourceEntry:e.sourceEntry,surface:e.surface} : {decision:e.decision};
    if (!relative(e.path) || !Array.isArray(e.lines) || e.lines.length!==2 || !Number.isSafeInteger(e.lines[0]) || !Number.isSafeInteger(e.lines[1]) || e.lines[0]<1 || e.lines[1]<e.lines[0]) throw new Error('Invalid evidence reference');
    const base=await read(source.commit,e.path);let next;
    try {next=await read(candidateCommit,e.path);} catch {spans.push({...reference,path:e.path,baseLines:e.lines,status:'candidate-file-unavailable'});continue;}
    spans.push({...reference,path:e.path,baseLines:e.lines,...locate(base,next,e.lines[0],e.lines[1])});
  }
  return {provider,baseCommit:source.commit,candidateCommit,spans,
    limitation:'Exact text spans only: unchanged text does not establish unchanged helpers, semantics, runtime registration or native behavior; unavailable files may be renamed or unreadable.'};
}
async function main() {
  if (![5,6].includes(process.argv.length) || (process.argv.length===6 && process.argv[5]!=='--include-inventory')) throw new Error('Usage: node scripts/map-candidate-evidence.mjs <provider> <absolute-repository-root> <candidate-commit> [--include-inventory]');
  console.log(JSON.stringify(await mapCandidateEvidence({provider:process.argv[2],root:process.argv[3],candidateCommit:process.argv[4],includeInventory:process.argv.length===6}),null,2));
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e=>{console.error('Candidate evidence mapping failed:',e.message);process.exitCode=1;});
