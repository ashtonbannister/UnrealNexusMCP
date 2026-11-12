import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateQualificationManifest} from '../scripts/qualification-evidence.mjs';
import {loadCatalog} from '../src/catalog.mjs';
import compatibility from '../catalog/compatibility-patches.json' with {type:'json'};

const sha='a'.repeat(64), commit='b'.repeat(40);
const providerPin=loadCatalog().upstreams.sources['ue-mcp'].commit;
function manifest() {return {schema_version:1,run_id:'test',status:'not-run',nexus_commit:null,lockfile_sha256:null,
  platform:{},project:{},profile:{enabled_operations:['actor.inspect.editor'],transport:null,providers:[]},target:{},reviewer:null,qualification_scope:null,
  cases:[{operation:'actor.inspect.editor',case:'read',applicability:'applicable',outcome:'not-run',provider_pin:null,loaded_artifact_sha256:null,target_identity:null,dispatch_count:null,receipt_artifact:null,receipt_sha256:null,preconditions:[],before_artifacts:[],after_artifacts:[],owned_resources:[],cleanup_actions:[],unresolved:[],reason:null}]};}
function passing() {const m=manifest();Object.assign(m,{status:'pass',nexus_commit:commit,lockfile_sha256:sha,
  platform:{os:'Windows',architecture:'x64',engine_build:'fixture',compiler_sdk:'fixture',node:'24',python:'3'},
  project:{revision:'fixture',disposable_copy_id:'fixture',baseline_manifest_sha256:sha},target:{project_identity:'fixture',editor_pid:1,editor_start_epoch:'fixture'},reviewer:'fixture',qualification_scope:'fixture'});
  Object.assign(m.profile,{transport:'stdio',providers:['ue-mcp']});Object.assign(m.cases[0],{outcome:'pass',case_kind:'positive',provider:'ue-mcp',provider_pin:providerPin,loaded_artifact_sha256:sha,target_identity:'fixture',dispatch_count:1,receipt_artifact:'receipts/case.json',receipt_sha256:sha});return m;}

test('not-run evidence is accepted structurally without inventing qualification',()=>{
  const result=validateQualificationManifest(manifest());assert.equal(result.valid,true);
});
test('a claimed passing record needs environment, target, receipt and no unresolved cleanup',()=>{
  const m=passing();assert.equal(validateQualificationManifest(m).valid,true);
  m.cases[0].unresolved=['held input'];m.cases[0].receipt_artifact='../outside.json';m.target.editor_start_epoch=null;
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('unresolved')));assert.ok(result.errors.some(e=>e.includes('receipt')));assert.ok(result.errors.some(e=>e.includes('target identity')));
});
test('a failed or blocked case cannot silently be treated as a complete pass',()=>{
  const m=passing();m.cases[0].outcome='blocked';m.cases[0].reason=null;
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('reason')));assert.ok(result.errors.some(e=>e.includes('all recorded cases')));
});
test('unknown and disabled operation identities fail closed',()=>{
  const m=manifest();m.cases[0].operation='arbitrary.raw';
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('unknown')));assert.ok(result.errors.some(e=>e.includes('not enabled')));
});


test('pass needs applicable dispatched positive evidence for every enabled operation',()=>{
  const m=passing();m.cases[0].applicability='not-applicable';m.cases[0].dispatch_count=0;
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('applicability')));assert.ok(result.errors.some(e=>e.includes('dispatched positive')));
});
test('passing case must identify the selected provider and exact pinned revision',()=>{
  const m=passing();m.profile.providers=['enginewire'];m.cases[0].provider='enginewire';m.cases[0].provider_pin=commit;
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('selected operation provider')));assert.ok(result.errors.some(e=>e.includes('provider lock')));
});
test('a partial profile cannot claim a full pass when an enabled operation has no positive case',()=>{
  const m=passing();m.profile.enabled_operations.push('screenshot.viewport.current');m.profile.providers.push('enginewire');
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('dispatched positive')));
});


test('a partial run with a passing case still requires environment and target provenance',()=>{
  const m=passing();m.status='not-run';m.platform.engine_build=null;m.target.editor_start_epoch=null;
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('platform.engine_build')));assert.ok(result.errors.some(e=>e.includes('target identity')));
});


test('owned PIE qualification requires all compatibility markers',()=>{
  const m=passing();
  const v1=compatibility.patches.find(p=>p.id==='uap-nexus-no-replay-v1');
  const v3=compatibility.patches.find(p=>p.id==='uap-nexus-queued-status-v3');
  const v4=compatibility.patches.find(p=>p.id==='uap-nexus-owned-pie-v4');
  m.profile.enabled_operations=['pie.start.viewport'];m.profile.providers=['unrealagentplayer'];
  Object.assign(m.cases[0],{operation:'pie.start.viewport',provider:'unrealagentplayer',provider_pin:v4.baseCommit,
    compatibility_patch:v4.id,patch_sha256:v4.sha256,live_marker:structuredClone(v4.capabilityMarker),
    no_replay_marker:structuredClone(v1.capabilityMarker),strict_status_marker:structuredClone(v3.capabilityMarker)});
  assert.equal(validateQualificationManifest(m).valid,true);
  for(const field of ['live_marker','no_replay_marker','strict_status_marker']) {
    const bad=structuredClone(m);delete bad.cases[0][field];assert.equal(validateQualificationManifest(bad).valid,false);
  }
});


test('profile rejects unknown, duplicate, and unrelated provider claims',()=>{
  const m=passing();m.profile.providers=['ue-mcp','ue-mcp','unknown','enginewire'];
  const result=validateQualificationManifest(m);assert.equal(result.valid,false);
  assert.ok(result.errors.some(e=>e.includes('unknown provider')));assert.ok(result.errors.some(e=>e.includes('duplicate provider')));assert.ok(result.errors.some(e=>e.includes('exactly match')));
});


test('qualification CLI bounds manifest bytes and rejects malformed UTF-8',()=>{
  const dir=mkdtempSync(join(tmpdir(),'nexus-qualification-'));
  const path=join(dir,'manifest.json');
  const run=()=>spawnSync(process.execPath,['scripts/qualification-evidence.mjs',path],{encoding:'utf8'});
  try {
    writeFileSync(path,JSON.stringify(manifest()));
    assert.equal(run().status,0);
    writeFileSync(path,Buffer.alloc(1024*1024+1,0x20));
    const oversized=run();assert.equal(oversized.status,2);assert.match(oversized.stderr,/Could not read or parse manifest/);
    writeFileSync(path,Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xff,0x22,0x7d]));
    const malformed=run();assert.equal(malformed.status,2);assert.match(malformed.stderr,/Could not read or parse manifest/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('queued-aware status qualification requires its patch and no-replay marker',()=>{
  const m=passing();const v1=compatibility.patches.find(p=>p.id==='uap-nexus-no-replay-v1');
  const v3=compatibility.patches.find(p=>p.id==='uap-nexus-queued-status-v3');
  m.profile.enabled_operations=['pie.status'];m.profile.providers=['unrealagentplayer'];
  Object.assign(m.cases[0],{operation:'pie.status',provider:'unrealagentplayer',provider_pin:v3.baseCommit,
    compatibility_patch:v3.id,patch_sha256:v3.sha256,live_marker:structuredClone(v3.capabilityMarker),no_replay_marker:structuredClone(v1.capabilityMarker)});
  assert.equal(validateQualificationManifest(m).valid,true);
  delete m.cases[0].no_replay_marker;
  assert.equal(validateQualificationManifest(m).valid,false);
});


test('material v2 qualification requires the fixed native marker',()=>{
  const m=passing();const patch=compatibility.patches.find(p=>p.id==='hayba-nexus-material-receipt-v2');
  m.profile.enabled_operations=['material.parameter.scalar.persisted'];m.profile.providers=['hayba'];
  Object.assign(m.cases[0],{operation:'material.parameter.scalar.persisted',provider:'hayba',provider_pin:patch.baseCommit,
    compatibility_patch:patch.id,patch_sha256:patch.sha256,live_marker:structuredClone(patch.capabilityMarker)});
  assert.equal(validateQualificationManifest(m).valid,true);
  m.cases[0].live_marker.value=1;
  assert.equal(validateQualificationManifest(m).valid,false);
});
