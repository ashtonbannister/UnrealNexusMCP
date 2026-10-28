import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeOutcomeUnknown,MAX_NATIVE_OUTCOME_TEXT_BYTES} from '../src/native-outcomes.mjs';

const text=value=>({type:'text',text:typeof value==='string'?value:JSON.stringify(value)});
const result=(value,more={})=>({content:[text(value)],...more});

test('UE post-send timeout machine tail fences even when outer task code is generic',()=>{
  const receipt={isError:true,content:[text('Error [TASK_FAILED]: Bridge call timed out'),
    text('MACHINE_ERROR='+JSON.stringify({code:'BRIDGE_TIMEOUT',outcome:'unknown',operationId:'42',method:'save_asset'})),
    text('Editor: fixture PID123')]};
  const before=structuredClone(receipt);
  assert.equal(nativeOutcomeUnknown('ue-mcp',receipt),true);
  assert.deepEqual(receipt,before,'the original native receipt is retained unchanged');
});

test('UE connection-loss and timeout dispatcher prefixes conservatively fence without a machine tail',()=>{
  for (const code of ['CONNECTION_LOST','BRIDGE_TIMEOUT']) {
    assert.equal(nativeOutcomeUnknown('ue-mcp',result('Error ['+code+']: interrupted',{isError:true})),true);
  }
});

test('UE executor timeout and shutdown normal JSON responses remain uncertain',()=>{
  for (const reason of ['timeout','shutting_down']) {
    const payload={success:false,error:'native executor message',reason};
    assert.equal(nativeOutcomeUnknown('ue-mcp',{content:[text('Modal notice'),text(payload),text('Editor: fixture')]}),true);
    assert.equal(nativeOutcomeUnknown('ue-mcp',{content:[],structuredContent:payload}),true);
  }
});

test('UE ordinary refused calls are failures but are not marked uncertain by this helper',()=>{
  for (const code of ['NOT_CONNECTED','ASSET_LOCKED','WRITE_BLOCKED','INVALID_PARAMS','TASK_FAILED','NOT_FOUND']) {
    assert.equal(nativeOutcomeUnknown('ue-mcp',result('Error ['+code+']: refused',{isError:true})),false);
  }
  assert.equal(nativeOutcomeUnknown('ue-mcp',result({success:false,error:'initializing',reason:'not_ready'})),false);
  assert.equal(nativeOutcomeUnknown('ue-mcp',result('MACHINE_ERROR='+JSON.stringify({code:'NOT_CONNECTED',outcome:'failed'}))),false);
});

test('outcome recognition does not recursively scan asset data or match arbitrary diagnostic prose',()=>{
  const asset={success:true,actor:{reason:'timeout',success:false},
    log:'Error [CONNECTION_LOST]: sample text',errorSamples:['MACHINE_ERROR={"outcome":"unknown"}']};
  assert.equal(nativeOutcomeUnknown('ue-mcp',result(asset)),false);
  assert.equal(nativeOutcomeUnknown('ue-mcp',result('Warning: Error [BRIDGE_TIMEOUT]: old log',{isError:true})),false);
  assert.equal(nativeOutcomeUnknown('ue-mcp',result('Error [CONNECTION_LOST]: asset string')),false);
  assert.equal(nativeOutcomeUnknown('ue-mcp',result({success:true,reason:'timeout'})),false);
});

test('malformed native machine-error markers fail closed rather than proving a harmless refusal',()=>{
  for (const invalid of ['{broken','[]','null','{}','{"code":3}']) {
    assert.equal(nativeOutcomeUnknown('ue-mcp',result('MACHINE_ERROR='+invalid)),true);
  }
});

test('uncertainty inspection is bounded and ignores image payload bytes',()=>{
  assert.equal(nativeOutcomeUnknown('ue-mcp',result('x'.repeat(MAX_NATIVE_OUTCOME_TEXT_BYTES+1))),true);
  assert.equal(nativeOutcomeUnknown('ue-mcp',{content:Array.from({length:257},()=>text('x'))}),true);
  assert.equal(nativeOutcomeUnknown('ue-mcp',{content:[{type:'text',text:5}]}),true);
  assert.equal(nativeOutcomeUnknown('ue-mcp',{content:[{type:'image',data:'x'.repeat(MAX_NATIVE_OUTCOME_TEXT_BYTES+1),mimeType:'image/png'}]}),false);
});

test('Hayba contained faults and restart-required quarantine fence even a returned refusal',()=>{
  const payload={id:'fixture',ok:false,code:'native_fault_contained',error:'fault contained',
    editor_health:{editor_unsafe:true},data:{ok:false,policy_code:'HCR-NATIVE-001',mutation_status:'unknown',may_have_executed:true}};
  assert.equal(nativeOutcomeUnknown('hayba',result(payload)),true);
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:false,code:'editor_unsafe_restart_required'})),true);
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:false,mutation_status:'unknown',may_have_executed:true})),true);
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:false,data:{mutation_status:'unknown',may_have_executed:true}})),true);
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:false,crash_guarded:'caught native fault'})),true);
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:true,editor_unsafe:true})),true);
});

test('Hayba regular refusals and nested actor fields do not masquerade as health quarantine',()=>{
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:false,code:'invalid_params',error:'bad input'})),false);
  assert.equal(nativeOutcomeUnknown('hayba',result({ok:true,data:{actor:{editor_unsafe:true,code:'native_fault_contained'}}})),false);
  assert.equal(nativeOutcomeUnknown('hayba',result('A log mentions native_fault_contained')),false);
});

test('markers from one reviewed provider are not universal error contracts',()=>{
  assert.equal(nativeOutcomeUnknown('enginewire',result('Error [CONNECTION_LOST]: interrupted',{isError:true})),false);
  assert.equal(nativeOutcomeUnknown('claireon',result({ok:false,code:'native_fault_contained'})),false);
  assert.equal(nativeOutcomeUnknown('ue-mcp',result({ok:false,code:'native_fault_contained'})),false);
  assert.equal(nativeOutcomeUnknown('hayba',result('MACHINE_ERROR={broken')),false);
});
