import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCapabilityCoverage} from '../scripts/validate-capability-coverage.mjs';
import coverage from '../catalog/capability-coverage.json' with {type:'json'};
import lock from '../catalog/upstreams.lock.json' with {type:'json'};

const copy = () => structuredClone(coverage);

test('the partial ledger is checked without claiming semantic or native qualification',()=>{
  const result=validateCapabilityCoverage();
  assert.equal(result.status,'partial-unreviewed');
  assert.ok(result.records>0);
  assert.match(result.limitation,/not verified/);
});

test('duplicate source entries, changed pins and recorded hashes are refused',()=>{
  const duplicate=copy();duplicate.entries.push(structuredClone(duplicate.entries[0]));
  assert.throws(()=>validateCapabilityCoverage({ledger:duplicate}),/duplicate source record/);
  const pin=copy();pin.sources['ue-mcp'].commit='0'.repeat(40);
  assert.throws(()=>validateCapabilityCoverage({ledger:pin}),/commit mismatch/);
  const hash=copy();hash.sources['ue-mcp'].sha256='0'.repeat(64);
  assert.throws(()=>validateCapabilityCoverage({ledger:hash}),/recorded source hash mismatch/);
  const drive=copy();drive.sources.enginewire.path='C:/private/data.json';
  assert.throws(()=>validateCapabilityCoverage({ledger:drive}),/invalid source path/);
  const changedLock=structuredClone(lock);changedLock.sources['ue-mcp'].commit='1'.repeat(40);
  assert.throws(()=>validateCapabilityCoverage({lock:changedLock}),/commit mismatch/);
});

test('invented or cross-provider canonical selections are refused',()=>{
  const invalid=copy();const row=invalid.entries.find(e=>e.canonicalRouteReferences?.length);
  row.canonicalRouteReferences=['made.up'];
  assert.throws(()=>validateCapabilityCoverage({ledger:invalid}),/invalid selected route/);
  const cross=copy();const other=cross.entries.find(e=>e.provider==='enginewire' && e.canonicalRouteReferences?.length);
  other.canonicalRouteReferences=['asset.save.exact'];
  assert.throws(()=>validateCapabilityCoverage({ledger:cross}),/invalid selected route/);
  const same=copy();const wrong=same.entries.find(e=>e.provider==='ue-mcp' && e.sourceEntry==='save_asset');
  wrong.canonicalRouteReferences=['actor.inspect.editor'];
  assert.throws(()=>validateCapabilityCoverage({ledger:same}),/invalid selected route/);
  const sameCategory=copy();const start=sameCategory.entries.find(e=>e.provider==='ue-mcp' && e.sourceEntry==='pie_inject_input_start');
  start.canonicalRouteReferences=['input.action.hold.stop'];
  assert.throws(()=>validateCapabilityCoverage({ledger:sameCategory}),/invalid selected route/);
  const local=copy();const native=local.entries.find(e=>e.provider==='ue-mcp' && e.sourceEntry==='execute_pcg_graph');
  native.canonicalRouteReferences=['pcg.generation.wait'];
  assert.throws(()=>validateCapabilityCoverage({ledger:local}),/invalid selected route/);
  for (const [provider,sourceEntry,id] of [
    ['hayba','mesh_extract','material.parameter.scalar.persisted'],
    ['claireon','tool_search','blueprint.compile.memory.asset'],
  ]) {
    const specialist=copy();const row=specialist.entries.find(e=>e.provider===provider && e.sourceEntry===sourceEntry);
    row.disposition='selected-route-slice-other-semantics-unreviewed';row.canonicalRouteReferences=[id];
    assert.throws(()=>validateCapabilityCoverage({ledger:specialist}),/invalid selected route/);
  }
});

test('unreviewed records and incomplete counts cannot be relabeled complete',()=>{
  const relabel=copy();relabel.status='complete';
  assert.throws(()=>validateCapabilityCoverage({ledger:relabel}),/explicitly partial/);
  const unjustified=copy();const row=unjustified.entries.find(e=>e.disposition==='unreviewed');
  row.canonicalRouteReferences=['asset.save.exact'];
  assert.throws(()=>validateCapabilityCoverage({ledger:unjustified}),/disposition\/route mismatch/);
  const missing=copy();missing.entries.pop();
  assert.throws(()=>validateCapabilityCoverage({ledger:missing}),/count mismatch/);
});


test('blocked source records require owner, reason, reopening condition and pinned evidence without route claims',()=>{
  const blocked=coverage.entries.filter(e=>e.disposition==='blocked');
  const blockedUap=new Set(blocked.filter(e=>e.provider==='unrealagentplayer').map(e=>e.sourceEntry));
  for(const name of ['actor_find','actor_get_properties','actor_set_property','exec_console','exec_python','actor_call_function','helper_call','input_key','input_mouse_move','input_mouse_button','input_axis','input_gamepad','input_xr_button','input_xr_pose','input_xr_clear','input_sequence','game_launch','game_attach','game_stop','perf_trace_start','perf_trace_stop','report_start','report_assert','report_note','report_caption','report_finish','perf_baseline_save','perf_baseline_compare']) assert.ok(blockedUap.has(name));
  assert.equal(validateCapabilityCoverage().status,'partial-unreviewed');
  for (const change of [
    row=>{row.blockReason='';}, row=>{row.reopeningCondition='';},
    row=>{row.sourceEvidence=[];}, row=>{row.sourceEvidence[0].commit='0'.repeat(40);},
    row=>{row.sourceEvidence[0].path='../outside';}, row=>{row.sourceEvidence[0].lines=[2,1];},
  ]) {
    const ledger=copy(); change(ledger.entries.find(e=>e.disposition==='blocked'));
    assert.throws(()=>validateCapabilityCoverage({ledger}),/invalid blocked evidence/);
  }
  const contradictory=copy();contradictory.entries.find(e=>e.disposition==='blocked').canonicalRouteReferences=['actor.inspect.editor'];
  assert.throws(()=>validateCapabilityCoverage({ledger:contradictory}),/disposition\/route mismatch/);
});
