import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';
import {mapCandidateEvidence} from '../scripts/map-candidate-evidence.mjs';

test('maps exact evidence spans and distinguishes changed and ambiguous candidates',async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'nexus-evidence-map-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
  git('init','-q');await writeFile(path.join(root,'file.txt'),'header\nkeep one\nkeep two\nold value\n');
  git('add','file.txt');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','base');const base=git('rev-parse','HEAD');
  await writeFile(path.join(root,'file.txt'),'new line\nheader\nkeep one\nkeep two\nchanged value\n');
  git('add','file.txt');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','candidate');const candidate=git('rev-parse','HEAD');
  const sources={sources:{sample:{commit:base}}};const ledger={decisions:[{id:'stable',evidence:[{provider:'sample',path:'file.txt',lines:[2,3]}]},{id:'changed',evidence:[{provider:'sample',path:'file.txt',lines:[4,4]}]}]};
  const result=await mapCandidateEvidence({root,provider:'sample',candidateCommit:candidate},{sources,ledger});
  assert.deepEqual(result.spans.map(s=>({status:s.status,lines:s.candidateLines})),[{status:'unchanged-unique',lines:[3,4]},{status:'changed',lines:undefined}]);
  await writeFile(path.join(root,'file.txt'),'keep one\nkeep two\nkeep one\nkeep two\n');git('add','file.txt');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','ambiguous');
  const ambiguous=await mapCandidateEvidence({root,provider:'sample',candidateCommit:git('rev-parse','HEAD')},{sources,ledger});assert.equal(ambiguous.spans[0].status,'ambiguous');
  await assert.rejects(mapCandidateEvidence({root,provider:'sample',candidateCommit:'main'},{sources,ledger}),/Invalid repository/);
});
