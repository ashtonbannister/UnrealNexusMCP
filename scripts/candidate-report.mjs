// Offline review aid. The caller supplies a bounded, public change-path manifest;
// it is not a diff verifier, semantic comparison, source attestation or promotion.
import {open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import upstreams from '../catalog/upstreams.lock.json' with {type:'json'};
import decisions from '../catalog/decisions.json' with {type:'json'};
import operations from '../catalog/operations.json' with {type:'json'};

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const relativePath = value => typeof value === 'string' && value.length > 0 && value.length <= 1024
  && !/[\\\u0000-\u001f\u007f]/u.test(value) && !value.startsWith('/')
  && !value.split('/')[0].includes(':')
  && !value.split('/').some(part => part === '' || part === '.' || part === '..');

/**
 * Accept a caller-supplied manifest containing only provider, baseCommit,
 * candidateCommit and changedPaths. These are claims, not verified Git data.
 * Every route using the provider remains review-required: path matching is
 * strictly an additional evidence pointer and cannot establish non-impact.
 */
export function candidateReport(manifest, {lock=upstreams, ledger=decisions, catalog=operations}={}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
    || Object.keys(manifest).some(key => !['provider','baseCommit','candidateCommit','changedPaths'].includes(key))) {
    throw new Error('Invalid change manifest');
  }
  const {provider,baseCommit,candidateCommit,changedPaths}=manifest;
  if (typeof provider !== 'string' || !Object.hasOwn(lock.sources,provider)
    || !sha(baseCommit) || !sha(candidateCommit) || baseCommit !== lock.sources[provider].commit
    || !Array.isArray(changedPaths) || changedPaths.length > 10000
    || !changedPaths.every(relativePath) || new Set(changedPaths).size !== changedPaths.length
    || (baseCommit === candidateCommit && changedPaths.length)) {
    throw new Error('Invalid change manifest');
  }
  const paths=[...changedPaths].sort();
  const relevant=ledger.decisions.filter(decision => decision.winner?.provider === provider
    || decision.evidence?.some(item => item.provider === provider)
    || decision.excludedDefaults?.some(item => item.provider === provider));
  const pathMatches=paths.map(path => ({path,decisionEvidence:relevant
    .filter(decision => decision.evidence?.some(item => item.provider === provider && item.path === path))
    .map(decision=>decision.id).sort()}));
  const routes=catalog.operations.filter(op=>op.provider===provider)
    .map(op=>({id:op.id,decision:op.decision,requiredCompatibility:op.requiredCompatibility ?? null,review:'required'}))
    .sort((a,b)=>a.id.localeCompare(b.id));
  return {
    provider, baseCommit, candidateCommit,
    candidateState:baseCommit === candidateCommit ? 'same-revision-claimed' : 'changed-revision-claimed',
    decisionsToReview:relevant.map(d=>d.id).sort(), routesToReview:routes,
    changedPaths:pathMatches,
    reviewRequirements:['Verify both immutable revisions and the complete diff independently.',
      'Review schema, behavior, license, compatibility patches, tests, native evidence and rollback per affected contract.',
      'Review every route and decision listed; unmatched paths are not evidence of no impact.',
      'No selection, pin change, installation, network access or promotion was performed.'],
    evidence:'Caller-supplied paths only; no source or runtime verification.',
  };
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Expected one manifest path');
  const path=resolve(process.argv[2]);
  const file=await open(path,'r');
  let input;
  try {
    if (!(await file.stat()).isFile()) throw new Error('Manifest must be a file');
    const buffer=Buffer.alloc(1024*1024+1);
    let length=0;
    while (length < buffer.length) {
      const {bytesRead}=await file.read(buffer,length,buffer.length-length,null);
      if (!bytesRead) break;
      length+=bytesRead;
    }
    if (length > 1024*1024) throw new Error('Manifest too large');
    input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,length)));
  } finally { await file.close(); }
  process.stdout.write(JSON.stringify(candidateReport(input),null,2)+'\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{process.stderr.write('Candidate report failed: invalid, unreadable or oversized manifest.\n');process.exitCode=1;});
}
