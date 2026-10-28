import assert from 'node:assert/strict';
import {loadCatalog} from '../src/catalog.mjs';
import decisions from '../catalog/decisions.json' with {type:'json'};
import packs from '../catalog/packs.json' with {type:'json'};
import upstreams from '../catalog/upstreams.lock.json' with {type:'json'};

const catalog=loadCatalog();
const statuses=new Set(['selected','adapter-required','conditional','preserve','hold']);
for(const [id,source] of Object.entries(upstreams.sources)) {
  assert.match(source.commit,/^[a-f0-9]{40}$/,id);
  assert.ok(source.repository.startsWith('https://github.com/'),id);
}
for(const decision of decisions.decisions) {
  assert.ok(statuses.has(decision.status),decision.id);
  assert.ok(decision.scope && decision.evidence.length,decision.id);
  if(decision.status!=='selected') assert.equal(decision.operations.length,0,decision.id);
  for(const evidence of decision.evidence) {
    const source=upstreams.sources[evidence.provider];
    assert.ok(source,evidence.provider);
    assert.ok(!evidence.path.startsWith('/') && !evidence.path.split('/').includes('..'));
    const [start,end]=evidence.lines;
    assert.ok(Number.isInteger(start)&&Number.isInteger(end)&&start>0&&end>=start);
    assert.equal(evidence.url,source.repository+'/blob/'+source.commit+'/'+evidence.path+'#L'+start+'-L'+end);
  }
}
const packIds=new Set(),members=new Set();
for(const pack of packs.packs) {
  assert.ok(!packIds.has(pack.id),'Duplicate pack '+pack.id);packIds.add(pack.id);
  if(pack.status==='adapter-required') assert.equal(pack.operations.length,0);
  for(const id of pack.operations) {catalog.get(id);assert.ok(!members.has(id),'Overlapping pack member '+id);members.add(id);}
}
assert.equal(members.size,catalog.size,'Every executable capability must be assigned to one pack');
for(const op of catalog.list()) catalog.validate(op.id,op.example);
console.log(JSON.stringify({
  operations:catalog.size,decisions:decisions.decisions.length,
  selectedGroups:decisions.decisions.filter(d=>d.status==='selected').length,
  excludedDefaultCandidates:decisions.decisions.reduce((n,d)=>n+d.excludedDefaults.length,0),
  sourcePins:Object.keys(upstreams.sources).length,liveUnrealQualification:'pending',
},null,2));
