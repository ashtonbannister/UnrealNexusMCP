import test from 'node:test';
import assert from 'node:assert/strict';
import {Catalog,loadCatalog} from '../src/catalog.mjs';
import operations from '../catalog/operations.json' with {type:'json'};
import upstreams from '../catalog/upstreams.lock.json' with {type:'json'};
import decisions from '../catalog/decisions.json' with {type:'json'};
import {buildCall} from '../src/routing.mjs';

const catalog=loadCatalog();
test('all 29 exposed operations have a selected decision, source pin and valid example',()=>{
  assert.equal(catalog.size,29);
  for(const op of catalog.list()) {
    assert.equal(catalog.validate(op.id,op.example),op);
    assert.match(catalog.describe(op.id).source.commit,/^[a-f0-9]{40}$/);
    assert.ok(op.postconditions.length);
    assert.ok(buildCall(op,op.example).name);
  }
});
test('excluded, internal and unadapted names have no escape route',()=>{
  for(const id of ['python_execute','unreal','pcg_wire','blueprint.compile_memory','material_set_param','trace_open']) {
    assert.throws(()=>catalog.get(id),{code:'OPERATION_NOT_EXPOSED'});
  }
});
test('fixed selectors, aliases and arbitrary provider/function fields are rejected',()=>{
  const bad=[
    ['pie.start.viewport',{mode:'Simulate'}],['pie.start.viewport',{wait:false}],
    ['pie.start.viewport',{map_path:"/Game/Map"}],['pie.stop',{timeout:10}],
    ['level.save.current',{commitDeletes:true}],
    ['asset.save.exact',{assetPath:'all'}],['asset.save.exact',{assetPaths:[]}],
    ['asset.save.exact',{assetPaths:['/Game/A','/Game/A']}],
    ['screenshot.pie',{filename:'../overwrite.png',pieInstance:1}],
    ['screenshot.pie',{filename:'ok.png',pieInstance:1,target:'editor'}],
    ['actor.inspect.editor',{actorPath:'/Game/A',world:'pie'}],
    ['pcg.generation.execute',{actorPath:'/Game/A',componentName:'Other'}],
    ['pcg.generation.execute',{actorPath:'/Game/A',wait:true}],
    ['pie.status',{provider:'enginewire',tool:'execute_python'}],
  ];
  for(const [id,args] of bad) assert.throws(()=>catalog.validate(id,args),{code:'INVALID_ARGUMENTS'});
});
test('explicit world, player, pin and run identity are required',()=>{
  for(const [id,args] of [
    ['screenshot.pie',{filename:'a.png'}],
    ['actor.inspect.pie',{actorPath:'/Game/A'}],
    ['input.action.once',{action_path:'/Game/Input'}],
    ['pcg.generation.wait',{actorPath:'/Game/A',componentName:'PCG',timeoutSeconds:30}],
    ['pcg.graph.connect.persisted',{assetPath:'/Game/A',sourceNode:'A',targetNode:'B'}],
  ]) assert.throws(()=>catalog.validate(id,args),{code:'INVALID_ARGUMENTS'});
});
test('numeric arguments reject nonfinite, coerced, fractional world and out-of-range values',()=>{
  for(const timeout of [NaN,Infinity,-Infinity,0,91,'60']) {
    assert.throws(()=>catalog.validate('pie.start.viewport',{timeout}),{code:'INVALID_ARGUMENTS'});
  }
  for(const pieInstance of [-1,0.5,'1',Infinity]) {
    assert.throws(()=>catalog.validate('screenshot.pie',{filename:'a.png',pieInstance}),{code:'INVALID_ARGUMENTS'});
  }
});
test('native envelopes select exactly the pinned reviewed public surface',()=>{
  assert.deepEqual(buildCall(catalog.get('pie.start.viewport'),{timeout:60}),
    {name:'pie_start',arguments:{timeout:60,mode:'PlayInViewport',wait:true}});
  assert.deepEqual(buildCall(catalog.get('asset.save.exact'),{assetPaths:['/Game/A']}),
    {name:'tools',arguments:{action:'call',category:'asset',method:'save',args:{assetPaths:['/Game/A']}}});
  assert.deepEqual(buildCall(catalog.get('screenshot.viewport.current'),{}),
    {name:'unreal',arguments:{operation:'execute',tool:'control_editor',action:'screenshot',
      params:{mode:'editor_viewport',returnBase64:true,keepFile:false,waitForShaders:true}}});
});
test('catalogue data and fixed selectors cannot be mutated through describe',()=>{
  assert.throws(()=>{catalog.describe('pie.start.viewport').route.fixed.wait=false;},TypeError);
  assert.equal(catalog.get('pie.start.viewport').route.fixed.wait,true);
});
test('duplicate semantic contracts and sorted-equivalent native routes are rejected',()=>{
  const doc=structuredClone(operations), ds=structuredClone(decisions);
  const duplicate=structuredClone(doc.operations[0]); duplicate.id='pie.second';
  doc.operations.push(duplicate);
  ds.decisions.find(d=>d.id===duplicate.decision).operations.push(duplicate.id);
  assert.throws(()=>new Catalog(doc,upstreams,ds),/Duplicate semantic contract/);
  duplicate.contract='different-contract';
  duplicate.route.fixed={wait:true,mode:'PlayInViewport'};
  assert.throws(()=>new Catalog(doc,upstreams,ds),/Duplicate native route/);
});
test('unimplemented adapter or nonselected winner cannot become executable',()=>{
  const doc=structuredClone(operations), ds=structuredClone(decisions);
  ds.decisions.find(d=>d.id===doc.operations[0].decision).status='adapter-required';
  assert.throws(()=>new Catalog(doc,upstreams,ds),/selection evidence/);
  doc.operations[0].route.kind='raw-python';
  assert.throws(()=>new Catalog(doc,upstreams,decisions),/Unimplemented/);
});
test('specialist variants stay distinct and cannot remove their compatibility requirement',()=>{
  const doc=structuredClone(operations);
  const op=doc.operations.find(o=>o.id==='blueprint.compile.memory.asset');
  assert.equal(catalog.get('blueprint.compile.memory.session').route.tool,op.route.tool);
  delete op.requiredCompatibility;
  assert.throws(()=>new Catalog(doc,upstreams,decisions),/compatibility requirement/);
});
test('search is bounded and returns canonical entries only',()=>{
  assert.ok(catalog.search('PCG').every(x=>typeof x.id==='string'));
  assert.throws(()=>catalog.search('',0),{code:'INVALID_SEARCH'});
  assert.throws(()=>catalog.search('x'.repeat(257)),{code:'INVALID_SEARCH'});
});
