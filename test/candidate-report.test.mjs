import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateReport} from '../scripts/candidate-report.mjs';
import upstreams from '../catalog/upstreams.lock.json' with {type:'json'};
import decisions from '../catalog/decisions.json' with {type:'json'};

const base=upstreams.sources['ue-mcp'].commit;
const changed='a'.repeat(40);
const manifest=(changedPaths=[])=>({provider:'ue-mcp',baseCommit:base,candidateCommit:changed,changedPaths});

test('candidate report maps exact reviewed evidence but conservatively retains all provider routes',()=>{
  const d=decisions.decisions.find(item=>item.evidence.some(e=>e.provider==='ue-mcp'));
  const path=d.evidence.find(e=>e.provider==='ue-mcp').path;
  const out=candidateReport(manifest([path,'new/unknown.cpp']));
  assert.ok(out.changedPaths.find(item=>item.path===path).decisionEvidence.includes(d.id));
  assert.deepEqual(out.changedPaths.find(item=>item.path==='new/unknown.cpp').decisionEvidence,[]);
  assert.ok(out.routesToReview.some(route=>route.id==='asset.save.exact'));
  const rejected=decisions.decisions.find(item=>item.excludedDefaults.some(e=>e.provider==='ue-mcp'));
  assert.ok(out.decisionsToReview.includes(rejected.id));
  assert.ok(out.routesToReview.every(route=>route.review==='required'));
  assert.match(out.evidence,/no source or runtime verification/);
});

test('candidate report rejects untrusted or inconsistent manifests without promoting pins',()=>{
  for (const input of [
    {...manifest(),baseCommit:'0'.repeat(40)}, {...manifest(),candidateCommit:'main'},
    manifest(['../other']), manifest(['/absolute']),manifest(['C:\\path']),
    manifest(['C:/Users/example/private']),manifest(['c:relative/file']),
    manifest(['valid/file','valid/file']),{...manifest(),token:'secret'},
    {...manifest(['changed']),candidateCommit:base},
  ]) assert.throws(()=>candidateReport(input),/Invalid change manifest/);
  assert.equal(upstreams.sources['ue-mcp'].commit,base);
});
