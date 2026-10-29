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
  for(const name of ['perf_stat','pie_pause','pie_resume','screenshot_viewport','log_tail','log_since','helper_list','actor_find','actor_get_properties','actor_set_property','exec_console','exec_python','actor_call_function','helper_call','input_key','input_mouse_move','input_mouse_button','input_axis','input_gamepad','input_xr_button','input_xr_pose','input_xr_clear','input_sequence','ui_menu_click','ui_find_window','ui_list_menus','read_viewport_ui','game_launch','game_attach','game_list','game_stop','perf_trace_start','perf_trace_stop','report_start','report_assert','report_note','report_caption','report_finish','perf_baseline_save','perf_baseline_compare']) assert.ok(blockedUap.has(name));
  const blockedUe=new Set(blocked.filter(e=>e.provider==='ue-mcp').map(e=>e.sourceEntry));
  for(const name of ['delete_asset','delete_asset_batch','rename_asset','move_asset']) assert.ok(blockedUe.has(name));
  const blockedHayba=new Set(blocked.filter(e=>e.provider==='hayba').map(e=>e.sourceEntry));
  for(const name of ['actor_call_function','actor_batch_spawn','actor_tag','actor_snap_to_socket','actor_duplicate']) assert.ok(blockedHayba.has(name));
  const blockedIvan=new Set(blocked.filter(e=>e.provider==='ivan-unreal-mcp').map(e=>e.sourceEntry));
  for(const name of ['console-run-command','python-execute','source-read','source-update','source-delete']) assert.ok(blockedIvan.has(name));
  const blockedEngineWire=new Set(blocked.filter(e=>e.provider==='enginewire').map(e=>e.sourceEntry));
  for(const name of ['system_control.package_project','system_control.package_status','system_control.launch_build']) assert.ok(blockedEngineWire.has(name));
  const blockedClaireon=new Set(blocked.filter(e=>e.provider==='claireon').map(e=>e.sourceEntry));
  for(const name of ['trace_get_threads','trace_get_session_info','trace_get_scope_details']) assert.ok(blockedClaireon.has(name));
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


test('typed Hayba records remain separate from same-named legacy records and enforce group boundaries',()=>{
  const valid=copy();
  const group=valid.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal'];
  const typed=structuredClone(valid.entries.find(e=>e.provider==='hayba' && e.surface==='material-typed-wrapper-literal'));
  const legacy=valid.entries.find(e=>e.provider==='hayba' && e.surface===undefined);
  typed.sourceEntry=legacy.sourceEntry;
  valid.entries.push(typed);group.entryCount++;
  assert.equal(validateCapabilityCoverage({ledger:valid}).status,'partial-unreviewed');
  const duplicate=structuredClone(valid);duplicate.entries.push(structuredClone(typed));
  assert.throws(()=>validateCapabilityCoverage({ledger:duplicate}),/duplicate source record/);
  const sharedFile=copy();const sharedGroup=structuredClone(sharedFile.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal']);
  sharedGroup.sources=[{path:sharedFile.sources.hayba.path,sha256:sharedFile.sources.hayba.sha256}];
  sharedGroup.sourceCount=1;sharedGroup.entryCount=0;sharedGroup.unmatchedSources=[sharedFile.sources.hayba.path];sharedGroup.unmatchedSourceCount=1;
  sharedFile.sources.hayba.additionalSourceGroups['test-surface']=sharedGroup;
  assert.equal(validateCapabilityCoverage({ledger:sharedFile}).status,'partial-unreviewed');
  const conflictingHash=structuredClone(sharedFile);conflictingHash.sources.hayba.additionalSourceGroups['test-surface'].sources[0].sha256='0'.repeat(64);
  assert.throws(()=>validateCapabilityCoverage({ledger:conflictingHash}),/invalid source path or hash/);
  const badPath=copy();const badRow=badPath.entries.find(e=>e.surface==='material-typed-wrapper-literal');
  badRow.sourcePath=badPath.sources.hayba.path;
  assert.throws(()=>validateCapabilityCoverage({ledger:badPath}),/unknown group record source/);
  const unmatched=copy();unmatched.entries.find(e=>e.surface==='material-typed-wrapper-literal').sourcePath=
    unmatched.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal'].unmatchedSources[0];
  assert.throws(()=>validateCapabilityCoverage({ledger:unmatched}),/unknown group record source/);
  const wrongPin=copy();wrongPin.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal'].commit='0'.repeat(40);
  assert.throws(()=>validateCapabilityCoverage({ledger:wrongPin}),/invalid additional source group/);
  const wrongCount=copy();wrongCount.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal'].entryCount++;
  assert.throws(()=>validateCapabilityCoverage({ledger:wrongCount}),/additional source group count mismatch/);
  const missingSource=copy();const index=missingSource.entries.findIndex(e=>e.surface==='material-typed-wrapper-literal');
  missingSource.entries.splice(index,1);missingSource.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal'].entryCount--;
  assert.throws(()=>validateCapabilityCoverage({ledger:missingSource}),/unaccounted group source/);
});


test('custom material handlers retain separately scoped registry and helper evidence',()=>{
  const ledger=copy();const group=ledger.sources.hayba.additionalSourceGroups['material-custom-handler'];
  const rows=ledger.entries.filter(e=>e.provider==='hayba' && e.surface==='material-custom-handler');
  assert.equal(rows.length,6);assert.equal(group.supportingSources.length,2);
  assert.ok(rows.every(e=>e.disposition==='unreviewed' && e.canonicalRouteReferences.length===0));
  assert.equal(validateCapabilityCoverage({ledger}).status,'partial-unreviewed');
  const badRole=copy();badRole.sources.hayba.additionalSourceGroups['material-custom-handler'].supportingSources[0].role='unrelated';
  assert.throws(()=>validateCapabilityCoverage({ledger:badRole}),/invalid custom handler evidence/);
  const badPath=copy();badPath.entries.find(e=>e.surface==='material-custom-handler').registryPath='mcp-tools/hayba-mcp/src/tools/material/material-stats.ts';
  assert.throws(()=>validateCapabilityCoverage({ledger:badPath}),/invalid custom handler evidence/);
  const badHash=copy();badHash.sources.hayba.additionalSourceGroups['material-custom-handler'].supportingSources[1].sha256='0'.repeat(64);
  assert.throws(()=>validateCapabilityCoverage({ledger:badHash}),/custom handler source reconciliation mismatch/);
  const invented=copy();const inventedGroup=invented.sources.hayba.additionalSourceGroups['material-custom-handler'];
  const oldPath=inventedGroup.sources[0].path;inventedGroup.sources[0].path='mcp-tools/hayba-mcp/src/tools/material/invented.ts';
  invented.entries.find(e=>e.surface==='material-custom-handler' && e.sourcePath===oldPath).sourcePath=inventedGroup.sources[0].path;
  assert.throws(()=>validateCapabilityCoverage({ledger:invented}),/custom handler source reconciliation mismatch/);
  const wrongBlob=copy();wrongBlob.sources.hayba.additionalSourceGroups['material-custom-handler'].sources[0].gitBlobSha1='0'.repeat(40);
  assert.throws(()=>validateCapabilityCoverage({ledger:wrongBlob}),/custom handler source reconciliation mismatch/);
  const missingBlob=copy();const missingCustom=missingBlob.sources.hayba.additionalSourceGroups['material-custom-handler'].sources[0];
  const missingOriginal=missingBlob.sources.hayba.additionalSourceGroups['material-typed-wrapper-literal'].sources.find(s=>s.path===missingCustom.path);
  delete missingCustom.gitBlobSha1;delete missingOriginal.gitBlobSha1;
  assert.throws(()=>validateCapabilityCoverage({ledger:missingBlob}),/custom handler source reconciliation mismatch/);
  const dup=copy();const support=dup.sources.hayba.additionalSourceGroups['material-custom-handler'].supportingSources;support.push({...support[0]});
  assert.throws(()=>validateCapabilityCoverage({ledger:dup}),/invalid supporting source/);
});


test('Claireon automation and trace declarations remain source-scoped internal records',()=>{
  const ledger=copy(), surface='internal-automation-trace-declaration';
  const rows=ledger.entries.filter(e=>e.provider==='claireon' && e.surface===surface);
  assert.deepEqual(new Set(rows.map(e=>e.sourceEntry)),new Set(['test_run','test_poll','pie_trace_start','pie_trace_stop']));
  for(const name of ['test_run','pie_trace_start','pie_trace_stop']) assert.equal(rows.find(e=>e.sourceEntry===name).disposition,'blocked');
  assert.equal(rows.find(e=>e.sourceEntry==='test_poll').disposition,'unreviewed');
  assert.ok(rows.every(e=>e.canonicalRouteReferences.length===0));
  assert.equal(ledger.entries.find(e=>e.provider==='claireon' && e.sourceEntry==='trace_open').disposition,'blocked');
  assert.equal(validateCapabilityCoverage({ledger}).status,'partial-unreviewed');
  const incorrect=copy();incorrect.entries.find(e=>e.provider==='claireon' && e.surface===surface).categoryLine=0;
  assert.throws(()=>validateCapabilityCoverage({ledger:incorrect}),/invalid internal declaration evidence/);
  const wrongSource=copy();wrongSource.entries.find(e=>e.provider==='claireon' && e.surface===surface).sourcePath='Source/Claireon/Private/ClaireonServer.cpp';
  assert.throws(()=>validateCapabilityCoverage({ledger:wrongSource}),/unknown group record source/);
});
