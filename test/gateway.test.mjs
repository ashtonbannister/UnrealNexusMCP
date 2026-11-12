import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../src/catalog.mjs';
import {Gateway} from '../src/gateway.mjs';
import {selectCapabilities} from '../src/packs.mjs';
import {normalizeResult} from '../src/results.mjs';
import {EditorQueue} from '../src/queue.mjs';

const catalog=loadCatalog();
const target={projectRoot:'C:/Projects/NexusDemo/NexusDemo.uproject',editorInstanceId:'PID1234-start-unique'};
const json=(body)=>({content:[{type:'text',text:JSON.stringify(body)}]});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const screenshot=(extra={})=>({content:[{type:'image',data:png,mimeType:'image/png'}],structuredContent:{success:true,operation:'execute',data:{width:1,height:1,view:'editor_viewport',sizeBytes:70,mimeType:'image/png',...extra}}});
function rewritePngCrc(bytes,offset) {
  const length=bytes.readUInt32BE(offset);let crc=0xffffffff;
  for(const byte of bytes.subarray(offset+4,offset+8+length)) {crc^=byte;for(let i=0;i<8;i++) crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;}
  bytes.writeUInt32BE((crc^0xffffffff)>>>0,offset+8+length);
}
function mutatedPng(mutate) {const bytes=Buffer.from(png,'base64');mutate(bytes);return bytes.toString('base64');}

const assetReceipt=(paths,force=false)=>({success:true,force,results:paths.map(path=>({path,package:path,wasDirty:true,status:'saved',stillDirty:false})),savedCount:paths.length,notDirtyCount:0,failedCount:0,updated:true,rollbackPossible:false,rollbackNote:'A save has no inverse.'});
const levelReceipt=()=>({success:true,levelName:'Demo',levelPath:'/Game/Demo.Demo',levelPackage:'/Game/Demo',usesExternalActors:false,externalPackagesLoaded:0,landscapesMerged:0,savedCount:0,failedCount:0,skippedCount:1,deletedCount:0,saved:[],skipped:[{package:'/Game/Demo',saved:false,skipped:true}]});
function fixture(options={}) {
  const starts=[],calls=[],closes=[];
  const surfaces={
    'ue-mcp':new Set(['tools']),
    'enginewire':new Set(['unreal']),
    'unrealagentplayer':new Set(['pie_start','pie_stop','pie_status']),
  };
  const factories=new Map(Object.keys(surfaces).map(provider=>[provider,async()=>{
    starts.push(provider);
    return {tools:surfaces[provider],sourceCommit:catalog.upstreams.sources[provider].commit,
      identityVerified:true,target,supports:async()=>true,
      call:async(call)=>{
        calls.push({provider,call});
        if(options.reply) return options.reply(provider,call);
        if(provider==='enginewire') return screenshot();
        if(call.name==='pie_start') return json({ok:true,playing:true,phase:'Playing'});
        if(call.name==='pie_stop') return json({ok:true,stopped:true,phase:'NotPlaying'});
        if(call.name==='pie_status') return json({ok:true,phase:'NotPlaying',elapsed:0});
        if(call.arguments?.category==='asset' && call.arguments.method==='save') return json(assetReceipt(call.arguments.args.assetPaths,call.arguments.args.force ?? false));
        if(call.arguments?.category==='level' && call.arguments.method==='save') return json(levelReceipt());
        return json({success:true});
      },
      close:async()=>{closes.push(provider);},
    };
  }]));
  if(options.modifyFactories) options.modifyFactories(factories);
  const gateway=new Gateway(catalog,{target,allowWrites:true,
    enabledCapabilities:['pie.status','pie.start.viewport','pie.stop','screenshot.viewport.current','asset.save.exact','pcg.generation.wait'],
    backendFactories:factories,...options.config});
  return {gateway,starts,calls,closes,factories};
}
test('all capabilities and backends are off by default',async()=>{
  const g=new Gateway(catalog);
  assert.deepEqual(g.list(),[]);
  assert.deepEqual(g.status().requiredProviders,[]);
  assert.deepEqual(g.status().backends,[]);
  assert.throws(()=>g.plan('pie.status'),{code:'CAPABILITY_DISABLED'});
  await assert.rejects(g.execute('pie.status'),{code:'CAPABILITY_DISABLED'});
});
test('packs enable capabilities without creating loaders or silently enabling specialists',()=>{
  const g=new Gateway(catalog,{enabledPacks:['authoring-core','editor-observation']});
  assert.deepEqual(g.status().requiredProviders,['enginewire','ue-mcp']);
  assert.deepEqual(g.status().backends,[]);
  assert.ok(!g.list().some(x=>x.provider==='unrealagentplayer'));
  assert.equal(selectCapabilities(catalog,{enabledPacks:['material-strict']}).length,3);
  assert.throws(()=>selectCapabilities(catalog,{enabledPacks:['made-up']}),{code:'UNKNOWN_PACK'});
});
test('discovery and planning do not start providers; execution starts only its selected provider',async()=>{
  const {gateway:g,starts,calls}=fixture();
  g.list();g.describe('pie.status');const plan=g.plan('pie.start.viewport',{timeout:60});
  assert.equal(plan.dispatched,false);assert.deepEqual(starts,[]);
  await g.execute('screenshot.viewport.current');await g.execute('screenshot.viewport.current');
  assert.deepEqual(starts,['enginewire']);assert.equal(calls.length,2);
  await g.execute('asset.save.exact',{assetPaths:['/Game/A']});
  assert.deepEqual(starts,['enginewire','ue-mcp']);assert.ok(!starts.includes('unrealagentplayer'));
  await g.close();
});
test('disabled capabilities never load even an available factory',async()=>{
  const {gateway:g,starts}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']}});
  await assert.rejects(g.execute('pie.start.viewport'),{code:'CAPABILITY_DISABLED'});
  assert.deepEqual(starts,[]);
});
test('write and identity gates refuse before starting a backend',async()=>{
  const readOnly=fixture({config:{allowWrites:false}});
  await assert.rejects(readOnly.gateway.execute('pie.start.viewport'),{code:'WRITES_DISABLED'});
  assert.deepEqual(readOnly.starts,[]);
  const noTarget=fixture({config:{target:null}});
  await assert.rejects(noTarget.gateway.execute('pie.status'),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
  assert.deepEqual(noTarget.starts,[]);
});
test('call results keep images, metadata, warnings and structured payloads',async()=>{
  const result={...screenshot({warnings:['shader wait']}),_meta:{original:true}};
  result.content.unshift({type:'text',text:'Warning: not a rerender.'});
  const {gateway:g}=fixture({reply:()=>result});
  const out=await g.execute('screenshot.viewport.current');
  assert.deepEqual(out.content,result.content);
  assert.deepEqual(out.structuredContent,result.structuredContent);
  assert.equal(out._meta.original,true);
  assert.equal(out._meta['unreal-nexus/receipt'].outcome,'response_received');
  assert.equal(out.isError,undefined);
});
test('viewport capture without a received image is not a fulfilled image contract',async()=>{
  const {gateway:g}=fixture({reply:()=>json({success:true,path:'C:/Some.png'})});
  assert.equal((await g.execute('screenshot.viewport.current')).isError,true);
});
test('UAP JSON errors and unconfirmed lifecycle states remain failures',()=>{
  const op=catalog.get('pie.start.viewport');
  for(const body of [{ok:false,phase:'Starting',queued:true,error:'timeout'},
    {ok:true,phase:'Starting',playing:false},{ok:true,phase:'NotPlaying',playing:true},{ok:true,phase:'Playing'}]) {
    assert.equal(normalizeResult(op,json(body)).isError,true);
  }
  assert.equal(normalizeResult(catalog.get('pie.status'),{content:[{type:'text',text:'okay'}]}).isError,true);
});
test('PIE stop must report stopped and NotPlaying, not just transport success',()=>{
  for(const body of [{ok:true,phase:'Playing',stopped:false},{ok:true,phase:'NotPlaying'}]) {
    assert.equal(normalizeResult(catalog.get('pie.stop'),json(body)).isError,true);
  }
});
test('native UAP transport/runtime failure and missing lifecycle phase fence without retry',async()=>{
  for(const body of [{ok:false,error:{code:'UE_CONNECTION_RESET',message:'Socket closed'}},
    {ok:false,phase:'NotPlaying',error:{code:'PYTHON_RUNTIME',message:'Script failed after dispatch'}},
    {ok:true,playing:true}]) {
    const q=new EditorQueue();let calls=0;
    const run=()=>q.run(async()=>{calls++;return normalizeResult(catalog.get('pie.start.viewport'),json(body));},
      {effect:'lifecycle',timeoutMs:1000,operation:'pie.start.viewport',isUncertain:out=>out._meta['unreal-nexus/result-policy'].outcomeUnknown});
    const out=await run();assert.equal(out.isError,true);assert.equal(q.status.blocked,true);
    await assert.rejects(run(),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls,1);
  }
});
test('UE JSON envelope tolerates attribution prose and still rejects native failures',async()=>{
  const reply={content:[{type:'text',text:'Modal was answered; result follows.'},
    {type:'text',text:JSON.stringify({success:false,error:'read only',failed:['/Game/A']})},
    {type:'text',text:'Editor: NexusDemo PID1234'}]};
  const {gateway:g}=fixture({reply:()=>reply});
  const out=await g.execute('asset.save.exact',{assetPaths:['/Game/A']});
  assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
});
test('PCG wait requires generated for the exact requested run',async()=>{
  const args={actorPath:'/Game/A',componentName:'PCG',runId:7,timeoutSeconds:30};
  for(const state of ['cancelled','cleaned','not_started','idle','timed_out','generated']) {
    const {gateway:g}=fixture({reply:()=>json({success:true,state,runId:7,componentName:'PCG',lastRun:{id:7,state}})});
    const out=await g.execute('pcg.generation.wait',args);
    assert.equal(out.isError===true,state!=='generated');
  }
  const {gateway:g}=fixture({reply:()=>json({success:true,state:'generated',runId:8,lastRun:{id:8,state:'generated'}})});
  assert.equal((await g.execute('pcg.generation.wait',args)).isError,true);
});
test('concurrent work is serialized; one factory starts once',async()=>{
  let active=0,maxActive=0;
  const {gateway:g,starts}=fixture({reply:async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;return screenshot();}});
  await Promise.all([g.execute('screenshot.viewport.current'),g.execute('screenshot.viewport.current'),g.execute('screenshot.viewport.current')]);
  assert.equal(maxActive,1);assert.deepEqual(starts,['enginewire']);await g.close();
});
test('transport failure fences execution; no retry or other provider fallback',async()=>{
  const {gateway:g,starts,calls}=fixture({reply:()=>{throw new Error('transport lost');}});
  await assert.rejects(g.execute('screenshot.viewport.current'),{code:'EDITOR_OUTCOME_UNKNOWN'});
  await assert.rejects(g.execute('asset.save.exact',{assetPaths:['/Game/A']}),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(calls.length,1);assert.deepEqual(starts,['enginewire']);await g.close();
});
test('a backend revision mismatch or wrong editor refuses before tool dispatch',async()=>{
  for(const mismatch of ['revision','target','unverified','surface']) {
    let calls=0;
    const {gateway:g}=fixture({modifyFactories:m=>m.set('enginewire',async()=>({
      tools:new Set(mismatch==='surface'?[]:['unreal']),sourceCommit:mismatch==='revision'?'0'.repeat(40):catalog.upstreams.sources.enginewire.commit,
      identityVerified:mismatch!=='unverified',target:mismatch==='target'?{...target,editorInstanceId:'other'}:target,
      supports:async()=>true,call:async()=>{calls++;return screenshot();},close:async()=>{},
    }))});
    await assert.rejects(g.execute('screenshot.viewport.current'),{code:mismatch==='surface'?'BACKEND_SURFACE_MISMATCH':'BACKEND_ATTESTATION_FAILED'});
    assert.equal(calls,0);assert.equal(g.status().queue.blocked,false);await g.close();
  }
});
test('failed startup is never transparently retried',async()=>{
  let starts=0;const {gateway:g}=fixture({modifyFactories:m=>m.set('enginewire',async()=>{starts++;throw new Error('offline');})});
  await assert.rejects(g.execute('screenshot.viewport.current'));await assert.rejects(g.execute('screenshot.viewport.current'));
  assert.equal(starts,1);await g.close();
});
test('a queued request snapshots arguments before caller mutation',async()=>{
  let release;const {gateway:g,calls}=fixture({reply:async(provider,call)=>{
    if(provider==='enginewire') {await new Promise(r=>{release=r;});return screenshot();}
    return json(assetReceipt(call.arguments.args.assetPaths));
  }});
  const first=g.execute('screenshot.viewport.current');await new Promise(r=>setImmediate(r));
  const args={assetPaths:['/Game/Intended']};const second=g.execute('asset.save.exact',args);args.assetPaths[0]='/Game/Unexpected';
  release();await Promise.all([first,second]);assert.deepEqual(calls[1].call.arguments.args.assetPaths,['/Game/Intended']);await g.close();
});
test('close only closes loaded backends and disallows subsequent execution',async()=>{
  const {gateway:g,closes}=fixture();await g.execute('screenshot.viewport.current');await g.close();await g.close();
  assert.deepEqual(closes,['enginewire']);await assert.rejects(g.execute('screenshot.viewport.current'),{code:'GATEWAY_CLOSED'});
});
test('invalid host configuration is rejected',()=>{
  for(const timeoutMs of [0,99,1.5,Infinity,600001]) {
    assert.throws(()=>new Gateway(catalog,{timeoutMs}),{code:'INVALID_CONFIGURATION'});
  }
  assert.throws(()=>new Gateway(catalog,{target:{projectRoot:'',editorInstanceId:'x'}}),{code:'INVALID_CONFIGURATION'});
});

test('a public meta tool does not prove an inner capability is enabled',async()=>{
  let calls=0;const {gateway:g}=fixture({modifyFactories:m=>m.set('enginewire',async()=>({
    tools:new Set(['unreal']),sourceCommit:catalog.upstreams.sources.enginewire.commit,identityVerified:true,target,
    supports:async()=>false,call:async()=>{calls++;return screenshot();},close:async()=>{},
  }))});
  await assert.rejects(g.execute('screenshot.viewport.current'),{code:'CAPABILITY_UNAVAILABLE'});
  assert.equal(calls,0);assert.equal(g.status().queue.blocked,false);await g.close();
});
test('MCP manifest contains only enabled canonical names and immutable strict schemas',()=>{
  const {gateway:g,starts}=fixture({config:{enabledCapabilities:['asset.save.exact','pie.status']}});
  const tools=g.toolDefinitions();
  assert.deepEqual(tools.map(t=>t.name),['asset.save.exact','pie.status']);
  assert.equal(tools[0].inputSchema.additionalProperties,false);
  assert.equal(tools[0].annotations.destructiveHint,true);
  assert.equal(tools[1].annotations.readOnlyHint,true);
  assert.equal(tools[0].inputSchema,catalog.get('asset.save.exact').parameters);
  assert.deepEqual(starts,[]);
});

test('native PIE queued timeout fences future work while preserving the received result',async()=>{
  const native=json({ok:false,playing:false,phase:'Starting',queued:true,confirmed:false,error:'native timeout'});
  const q=new EditorQueue();let calls=0;
  const run=()=>q.run(async()=>{calls++;return normalizeResult(catalog.get('pie.start.viewport'),native);},
    {effect:'lifecycle',timeoutMs:1000,operation:'pie.start.viewport',isUncertain:out=>out._meta['unreal-nexus/result-policy'].outcomeUnknown});
  const result=await run();assert.equal(result.isError,true);assert.deepEqual(result.content,native.content);
  assert.equal(q.status.blocked,true);assert.equal(q.status.reason.code,'NATIVE_WORK_OUTSTANDING');
  await assert.rejects(run(),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls,1);
});
test('native incomplete PIE teardown also fences further work',async()=>{
  const q=new EditorQueue();const out=await q.run(async()=>normalizeResult(catalog.get('pie.stop'),json({ok:false,stopped:false,phase:'Ending'})),
    {effect:'lifecycle',timeoutMs:1000,operation:'pie.stop',isUncertain:result=>result._meta['unreal-nexus/result-policy'].outcomeUnknown});
  assert.equal(out.isError,true);assert.equal(q.status.blocked,true);
});
test('missing backend is a pre-dispatch refusal, not uncertainty for another provider',async()=>{
  const {gateway:g,calls}=fixture({modifyFactories:m=>m.delete('enginewire')});
  await assert.rejects(g.execute('screenshot.viewport.current'),{code:'BACKEND_UNAVAILABLE'});
  assert.equal(g.status().queue.blocked,false);await g.execute('asset.save.exact',{assetPaths:['/Game/A']});
  assert.deepEqual(calls.map(c=>c.provider),['ue-mcp']);await g.close();
});
test('execute rejects original accessors without invoking getters or starting a backend',async()=>{
  const {gateway:g,starts}=fixture();let read=0;
  await assert.rejects(g.execute('asset.save.exact',{
    get assetPaths(){read++;return ['/Game/A'];}
  }),{code:'INVALID_ARGUMENTS'});
  assert.equal(read,0);assert.deepEqual(starts,[]);
});
test('current viewport capture preserves a PIE source without claiming an editor-only image',async()=>{
  const native=screenshot({view:'pie_game',shaderWait:{remaining:3}});
  const {gateway:g}=fixture({reply:()=>native});
  const result=await g.execute('screenshot.viewport.current');
  assert.equal(result.structuredContent.data.view,'pie_game');
  assert.deepEqual(result.structuredContent.data.shaderWait,{remaining:3});
  assert.throws(()=>g.plan('screenshot.editor'),{code:'OPERATION_NOT_EXPOSED'});
});


test('UE malformed completion fences the editor and preserves the receipt, while a known refusal stays open',async()=>{
  for (const reply of [
    {content:[{type:'text',text:'unparseable completion'}]},
    {content:[{type:'text',text:'{}'}]},
    {content:[{type:'text',text:'{\"unexpected\":true}'}]},
    {content:[{type:'text',text:'{\"success\":\"true\"}'}]},
    {isError:true,content:[{type:'text',text:'{\"success\":false,\"dialogBlocking\":true,\"partiallyApplied\":true}'}]},
    {content:[{type:'text',text:'{}'},{type:'text',text:'{}'}]},
    {structuredContent:{success:true},content:[{type:'text',text:'{\"success\":false}'}]},
    {isError:true,content:[{type:'text',text:'Error [NOT_CONNECTED]: refused'},
      {type:'text',text:'{\"success\":true}'},{type:'text',text:'{\"success\":false}'}]},
  ]) {
    const {gateway:g,calls}=fixture({reply:()=>reply});
    const out=await g.execute('asset.save.exact',{assetPaths:['/Game/A']});
    assert.deepEqual(out.content,reply.content);
    assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.equal(g.status().queue.blocked,true);
    await assert.rejects(g.execute('asset.save.exact',{assetPaths:['/Game/A']}),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);
    await g.close();
  }
  const {gateway:g}=fixture({reply:()=>({isError:true,content:[{type:'text',text:'Error [NOT_CONNECTED]: refused'}]})});
  const out=await g.execute('asset.save.exact',{assetPaths:['/Game/A']});
  assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
  assert.equal(g.status().queue.blocked,false);
  await g.close();
});

test('backend contract refusal reports failed cleanup on shutdown',async()=>{
  const {gateway:g}=fixture({modifyFactories:m=>m.set('ue-mcp',async()=>({
    tools:new Set(['tools']),sourceCommit:'wrong',identityVerified:true,target,
    supports:async()=>true,call:async()=>json({success:true}),close:async()=>{throw new Error('cleanup failed');},
  }))});
  await assert.rejects(g.execute('asset.save.exact',{assetPaths:['/Game/A']}),{code:'BACKEND_ATTESTATION_FAILED'});
  assert.deepEqual(g.status().backends,[{provider:'ue-mcp',state:'failed',cleanup:'unconfirmed'}]);
  await assert.rejects(g.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});


test('current-level save stays held regardless of the separate host deletion grant',async()=>{
  for(const grant of [false,true]) {
    const {gateway:g,starts,calls}=fixture({config:{enabledCapabilities:['level.save.current'],allowLevelExternalPackageDeletion:grant}});
    assert.equal(g.plan('level.save.current',{}).dispatched,false);
    await assert.rejects(g.execute('level.save.current',{}),{code:'LEVEL_SAVE_TARGET_UNVERIFIED'});
    assert.equal(g.status().allowLevelExternalPackageDeletion,grant);
    assert.deepEqual(g.status().heldCapabilities,[{id:'level.save.current',reason:'native save cannot atomically verify the intended current level before mutation'}]);
    assert.throws(()=>g.plan('level.save.current',{allowOverride:true}),{code:'INVALID_ARGUMENTS'});
    assert.deepEqual(starts,[]);assert.deepEqual(calls,[]);await g.close();
  }
  const readOnly=fixture({config:{enabledCapabilities:['level.save.current'],allowWrites:false,allowLevelExternalPackageDeletion:true}});
  await assert.rejects(readOnly.gateway.execute('level.save.current',{}),{code:'WRITES_DISABLED'});
  assert.deepEqual(readOnly.starts,[]);await readOnly.gateway.close();
});
test('persisted PCG connection requires verified edge and explicit successful save receipt',async()=>{
  const args={assetPath:'/Game/PCG/Graph',sourceNode:'A',sourcePin:'Out',targetNode:'B',targetPin:'In'};
  const identity={assetPath:args.assetPath,sourceNodeName:args.sourceNode,targetNodeName:args.targetNode,
    sourcePinLabel:args.sourcePin,targetPinLabel:args.targetPin};
  for (const body of [
    {success:true,existed:true,created:false,edgeVerified:true,rollbackPossible:false},
    {success:true,created:true,existed:false,edgeVerified:true,saved:false,transient:true},
  ]) {
    const reply={...json({...identity,...body}),_meta:{'fixture/original':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},reply:()=>reply});
    const out=await g.execute('pcg.graph.connect.persisted',args);
    assert.equal(out.isError,true);
    assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].policy,'require-verified-persisted-pcg-edge');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
    assert.equal(g.status().queue.blocked,false);
    assert.equal(calls.length,1);
    await g.close();
  }
  const reply={...json({...identity,success:true,created:true,existed:false,edgeVerified:true,saved:true}),_meta:{'fixture/original':'preserved'}};
  const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},reply:()=>reply});
  const out=await g.execute('pcg.graph.connect.persisted',args);
  assert.notEqual(out.isError,true);assert.deepEqual(out.content,reply.content);
  assert.equal(out._meta['fixture/original'],'preserved');assert.equal(calls.length,1);
  await g.close();
});


test('persisted PCG success receipts must match all requested identities or fence',async()=>{
  const args={assetPath:'/Game/PCG/Graph',sourceNode:'A',sourcePin:'Out',targetNode:'B',targetPin:'In'};
  const identity={assetPath:args.assetPath,sourceNodeName:args.sourceNode,targetNodeName:args.targetNode,
    sourcePinLabel:args.sourcePin,targetPinLabel:args.targetPin};
  for(const altered of [
    {assetPath:'/Game/PCG/Other'}, {sourceNodeName:'Other'}, {targetNodeName:'Other'},
    {sourcePinLabel:'out'}, {targetPinLabel:'Other'}, {sourceNodeName:undefined},
  ]) {
    const reply={...json({...identity,...altered,success:true,created:true,existed:false,edgeVerified:true,saved:true}),_meta:{'fixture/original':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},reply:()=>reply});
    const out=await g.execute('pcg.graph.connect.persisted',args);
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.equal(g.status().queue.blocked,true);
    await assert.rejects(g.execute('pcg.graph.connect.persisted',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);await g.close();
  }
});


test('PCG failure receipts fence ambiguous mutations but retain correlated save failures and proven pin refusals',async()=>{
  const args={assetPath:'/Game/PCG/Graph',sourceNode:'A',sourcePin:'Out',targetNode:'B',targetPin:'In'};
  const identity={assetPath:args.assetPath,sourceNodeName:args.sourceNode,targetNodeName:args.targetNode,
    sourcePinLabel:args.sourcePin,targetPinLabel:args.targetPin};
  const applied={...identity,success:false,created:true,existed:false,edgeVerified:true,saved:false,saveError:'read-only',error:'not written'};
  for(const [body,unknown] of [
    [applied,false],
    [{...applied,assetPath:'/Game/PCG/Other'},true],
    [{success:false,error:'Failed to connect pins - connection may already exist or be incompatible'},true],
    [{success:false,error:"AddEdge returned success but no UPCGEdge was found on 'A.Out' -> 'B.In'."},true],
    [{success:false,error:'some other native refusal'},true],
    [{success:false,error:'No suitable output pin found on source node'},false],
    [{success:false,error:'No suitable input pin found on target node'},false],
    [{success:false,error:'No suitable input pin found on target node',created:true},true],
  ]) {
    const reply={...json(body),_meta:{'fixture/original':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},reply:()=>reply});
    const out=await g.execute('pcg.graph.connect.persisted',args);
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,unknown);
    assert.equal(g.status().queue.blocked,unknown);assert.equal(calls.length,1);
    if(unknown) await assert.rejects(g.execute('pcg.graph.connect.persisted',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);await g.close();
  }
  for(const code of ['NOT_CONNECTED','INVALID_PARAMS']) {
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},
      reply:()=>({isError:true,content:[{type:'text',text:'Error ['+code+']: refused'}]})});
    const out=await g.execute('pcg.graph.connect.persisted',args);
    assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
    assert.equal(g.status().queue.blocked,false);assert.equal(calls.length,1);await g.close();
  }
});


test('contradictory PCG MCP error and success receipt fences despite matching identity',async()=>{
  const args={assetPath:'/Game/PCG/Graph',sourceNode:'A',sourcePin:'Out',targetNode:'B',targetPin:'In'};
  const body={assetPath:args.assetPath,sourceNodeName:args.sourceNode,targetNodeName:args.targetNode,
    sourcePinLabel:args.sourcePin,targetPinLabel:args.targetPin,success:true,created:true,existed:false,edgeVerified:true,saved:true};
  const reply={...json(body),isError:true,_meta:{'fixture/original':'preserved'}};
  const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},reply:()=>reply});
  const out=await g.execute('pcg.graph.connect.persisted',args);
  assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
  assert.equal(out._meta['fixture/original'],'preserved');
  assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
  assert.equal(g.status().queue.blocked,true);
  await assert.rejects(g.execute('pcg.graph.connect.persisted',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(calls.length,1);await g.close();
});


test('malformed or contradictory PCG success shapes fence despite matched identity',async()=>{
  const args={assetPath:'/Game/PCG/Graph',sourceNode:'A',sourcePin:'Out',targetNode:'B',targetPin:'In'};
  const identity={assetPath:args.assetPath,sourceNodeName:args.sourceNode,targetNodeName:args.targetNode,
    sourcePinLabel:args.sourcePin,targetPinLabel:args.targetPin};
  for(const body of [
    {created:true,existed:false,saved:true},
    {created:true,existed:false,edgeVerified:false,saved:true},
    {existed:false,edgeVerified:true,saved:true},
    {created:true,edgeVerified:true,saved:true},
    {created:true,existed:true,edgeVerified:true,saved:true},
    {created:true,existed:false,edgeVerified:true},
    {created:true,existed:false,edgeVerified:true,saved:false},
    {created:true,existed:false,edgeVerified:true,saved:true,transient:true},
    {created:true,existed:false,edgeVerified:true,saved:true,transient:false},
    {created:false,existed:true,edgeVerified:true,rollbackPossible:false,transient:true},
    {created:false,existed:true,edgeVerified:true,rollbackPossible:false,transient:false},
    {created:false,existed:true,edgeVerified:true,rollbackPossible:false,saved:true},
    {created:false,existed:true,edgeVerified:true},
  ]) {
    const reply={...json({...identity,success:true,...body}),_meta:{'fixture/original':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.graph.connect.persisted']},reply:()=>reply});
    const out=await g.execute('pcg.graph.connect.persisted',args);
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.equal(g.status().queue.blocked,true);
    await assert.rejects(g.execute('pcg.graph.connect.persisted',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);await g.close();
  }
});


test('PIE capture is held before backend startup even with write authority',async()=>{
  const args={filename:'nexus-frame.png',pieInstance:1};
  const {gateway:g,starts,calls}=fixture({config:{enabledCapabilities:['screenshot.pie'],allowWrites:true}});
  assert.equal(g.plan('screenshot.pie',args).dispatched,false);
  assert.deepEqual(g.status().heldCapabilities,[{id:'screenshot.pie',reason:'native output ownership and target identity unverified'}]);
  await assert.rejects(g.execute('screenshot.pie',args),{code:'PIE_SCREENSHOT_OUTPUT_UNVERIFIED'});
  assert.deepEqual(starts,[]);assert.deepEqual(calls,[]);
  assert.throws(()=>g.plan('screenshot.pie',{...args,allowPieScreenshotOverwrite:true}),{code:'INVALID_ARGUMENTS'});
  await g.close();
});


test('exact asset save fences ambiguous aliases and malformed receipt evidence',async()=>{
  const args={assetPaths:['/Game/A.A','/Game/B.B']};
  const valid={success:true,force:false,results:[{path:'/Game/A.A',package:'/Game/A',wasDirty:true,status:'saved',stillDirty:false},{path:'/Game/B.B',package:'/Game/B',wasDirty:true,status:'saved',stillDirty:false}],savedCount:2,notDirtyCount:0,failedCount:0,updated:true,rollbackPossible:false,rollbackNote:'A save has no inverse.'};
  const ok=fixture({config:{enabledCapabilities:['asset.save.exact']},reply:()=>json(valid)});
  assert.notEqual((await ok.gateway.execute('asset.save.exact',args)).isError,true);
  assert.equal(ok.gateway.status().queue.blocked,false);await ok.gateway.close();
  // Native deduplicates same-package aliases. A shorter receipt cannot prove
  // whether a second path was an alias or an omitted input, so do not guess.
  const aliasArgs={assetPaths:['/Game/A.A','/Game/A.B']};
  const aliasReceipt={...valid,results:[valid.results[0]],savedCount:1};
  const alias=fixture({config:{enabledCapabilities:['asset.save.exact']},reply:()=>json(aliasReceipt)});
  const aliasOut=await alias.gateway.execute('asset.save.exact',aliasArgs);
  assert.equal(aliasOut._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
  await assert.rejects(alias.gateway.execute('asset.save.exact',aliasArgs),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(alias.calls.length,1);await alias.gateway.close();
  for(const body of [
    {success:true},
    {...valid,force:true},
    {...valid,error:'contradictory error'},
    {...valid,updated:false},
    {...valid,rollbackPossible:true},
    {...valid,results:[{...valid.results[0],path:'/Game/Other'},valid.results[1]]},
    {...valid,failedCount:1},
    {...valid,savedCount:3},
    {...valid,results:[{...valid.results[0],status:'failed'},valid.results[1]]},
  ]) {
    const reply={...json(body),_meta:{'fixture/original':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['asset.save.exact']},reply:()=>reply});
    const out=await g.execute('asset.save.exact',args);
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    await assert.rejects(g.execute('asset.save.exact',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);await g.close();
  }
});

function saveReceiptQueue(id,args,reply) {
  const queue=new EditorQueue(),calls=[];
  return {queue,calls,run:()=>queue.run(async()=>{calls.push(id);return normalizeResult(catalog.get(id),reply,args);},
    {effect:'write',timeoutMs:1000,operation:id,isUncertain:out=>out._meta['unreal-nexus/result-policy'].outcomeUnknown})};
}

test('current-level save requires coherent counts and package receipt rows',async()=>{
  const valid={...levelReceipt(),deletedCount:1,deleted:[{package:'/Game/Demo/__ExternalActors__/A',emptyPackage:true,deleted:true}],rollbackPossible:false,rollbackNote:'The previous package files cannot be restored.'};
  const ok=saveReceiptQueue('level.save.current',{},json(valid));
  assert.notEqual((await ok.run()).isError,true);assert.equal(ok.queue.status.blocked,false);
  const neverOnDisk={...valid,deleted:[{package:'/Game/Demo/__ExternalActors__/A',emptyPackage:true,deleted:false,neverOnDisk:true}]};
  const clean=saveReceiptQueue('level.save.current',{},json(neverOnDisk));
  assert.notEqual((await clean.run()).isError,true);assert.equal(clean.queue.status.blocked,false);
  const written={...levelReceipt(),saved:[{package:'/Game/Demo',saved:true}],savedCount:1,skipped:undefined,skippedCount:0,rollbackPossible:false,rollbackNote:'The previous package files cannot be restored.'};
  const saved=saveReceiptQueue('level.save.current',{},json(written));
  assert.notEqual((await saved.run()).isError,true);assert.equal(saved.queue.status.blocked,false);
  for(const body of [
    {success:true},
    {...valid,levelPackage:undefined},
    {...valid,failedCount:1},
    {...valid,deletedCount:2},
    {...valid,deleted:[{package:'/Game/A',deleted:true}]},
    {...valid,deleted:[{package:'/Game/A',emptyPackage:true,deleted:false}]},
    {...valid,skipped:[],skippedCount:0},
    {...valid,error:'contradictory error'},
    {...valid,rollbackPossible:true},
    {...valid,rollbackNote:undefined},
    {...levelReceipt(),rollbackPossible:false,rollbackNote:'unexpected'},
    {...valid,saved:[{package:'/Game/A',saved:true}],savedCount:0},
    {...valid,saved:[{package:'/Game/Demo/__ExternalActors__/A',saved:true}],savedCount:1},
  ]) {
    const reply={...json(body),_meta:{'fixture/original':'preserved'}};
    const {queue,calls,run}=saveReceiptQueue('level.save.current',{},reply);
    const out=await run();
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    await assert.rejects(run(),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);
  }
  const contradictory={...json(valid),isError:true};
  const conflict=saveReceiptQueue('level.save.current',{},contradictory);
  const out=await conflict.run();
  assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
  assert.equal(conflict.queue.status.blocked,true);
});

test('reported native partial save failures stay visible as failures without retry',async()=>{
  for(const [id,args,body] of [
    ['asset.save.exact',{assetPaths:['/Game/A']},{success:false,force:false,results:[{path:'/Game/A',package:'/Game/A',wasDirty:true,status:'failed',stillDirty:true,reason:'read only'}],savedCount:0,notDirtyCount:0,failedCount:1,updated:false,unchanged:true,rollbackPossible:false,rollbackNote:'A save has no inverse.',error:'1 of 1 packages did not reach disk. The first: /Game/A: read only'}],
    ['level.save.current',{}, {...levelReceipt(),success:false,skipped:undefined,skippedCount:0,failedCount:1,failed:[{package:'/Game/Demo',saved:false,error:'read only'}],error:'read only'}],
  ]) {
    const reply={...json(body),_meta:{'fixture/original':'preserved'}};
    const {queue,calls,run}=saveReceiptQueue(id,args,reply);
    const out=await run();
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);
    assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
    assert.equal(queue.status.blocked,false);assert.equal(calls.length,1);
  }
});


test('source-shaped save preflight refusals remain known failures',async()=>{
  const path='/Game/A';
  for (const [id,args,body] of [
    ['asset.save.exact',{assetPaths:[path]},{success:false,error:"1 of 1 assetPaths cannot be saved, so nothing was written. The first: '/Game/A' - not loaded",refused:[{path,status:'refused',reason:'not loaded'}]}],
    ['level.save.current',{},{success:false,error:'Play In Editor is running; stop it before saving the level. Saving during PIE is what produced an unexplained failure before.'}],
  ]) {
    const {queue,calls,run}=saveReceiptQueue(id,args,json(body));
    const out=await run();
    assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
    assert.equal(queue.status.blocked,false);assert.equal(calls.length,1);
  }
});

test('unrecognized or contradictory save failures fence subsequent editor work',async()=>{
  for (const [id,args,body] of [
    ['asset.save.exact',{assetPaths:['/Game/A']},{success:false,error:'unexpected native failure'}],
    ['asset.save.exact',{assetPaths:['/Game/A']},{success:false,error:"1 of 1 assetPaths cannot be saved, so nothing was written. The first: '/Game/B' - not loaded",refused:[{path:'/Game/B',status:'refused',reason:'not loaded'}]}],
    ['asset.save.exact',{assetPaths:['/Game/A']},{success:false,error:"1 of 1 assetPaths cannot be saved, so nothing was written. The first: '/Game/Other' - wrong reason",refused:[{path:'/Game/A',status:'refused',reason:'not loaded'}]}],
    ['asset.save.exact',{assetPaths:['/Game/A']},{success:false,force:false,results:[{path:'/Game/B',package:'/Game/B',wasDirty:true,status:'failed',stillDirty:true,reason:'read only'}],savedCount:0,notDirtyCount:0,failedCount:1,error:'save failed'}],
    ['asset.save.exact',{assetPaths:['/Game/A']},{success:false,force:false,results:[{path:'/Game/A',package:'/Game/A',wasDirty:true,status:'failed',stillDirty:true,reason:'read only'}],savedCount:0,notDirtyCount:0,failedCount:1,updated:false,unchanged:true,rollbackPossible:false,rollbackNote:'A save has no inverse.',error:'wrong package detail'}],
    ['level.save.current',{}, {...levelReceipt(),success:false,skipped:undefined,skippedCount:0,failedCount:1,failed:[{package:'/Game/Demo',saved:false,error:'read only'}],error:'wrong detail'}],
    ['level.save.current',{},{success:false,error:'The editor world has no current level to save'}],
    ['level.save.current',{}, {...levelReceipt(),success:false,failedCount:1,failed:[{package:'/Game/Demo',saved:false,error:'read only'}],error:'save failed'}],
  ]) {
    const reply={...json(body),_meta:{'fixture/original':'preserved'}};
    const {queue,calls,run}=saveReceiptQueue(id,args,reply);
    const out=await run();
    assert.equal(out.isError,true);assert.deepEqual(out.content,reply.content);assert.equal(out._meta['fixture/original'],'preserved');
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    await assert.rejects(run(),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);
  }
});


test('actor discovery preserves native page and fixes editor world',async()=>{
  const args={nameFilter:'NexusTest_',limit:10};
  const page={success:true,worldName:'Untitled_1',actors:[{label:'NexusTest_Cone',path:'/Temp/Untitled_1.Actor'}],count:1,returnedActors:1,total:1,totalKnown:true,hasMore:false,streamingSkipped:128};
  const f=fixture({config:{enabledCapabilities:['actor.list.editor']},reply:()=>json(page)});
  const out=await f.gateway.execute('actor.list.editor',args);assert.notEqual(out.isError,true);
  assert.deepEqual(out.content,json(page).content);assert.equal(f.calls.length,1);
  assert.deepEqual(f.calls[0].call.arguments.args,{...args,world:'editor'});await f.gateway.close();
});

test('actor placement fixes editor scope and fences an uncorrelated receipt',async()=>{
  const args={actorClass:'/Script/Engine.StaticMeshActor',label:'NexusTest',location:{x:1,y:2,z:3},staticMesh:'/Engine/BasicShapes/Cube.Cube'};
  const good={success:true,created:true,existed:false,actorLabel:args.label,actorClass:args.actorClass};
  const refusal=fixture({config:{enabledCapabilities:['actor.place.editor']},reply:()=>({isError:true,content:[{type:'text',text:'Error [INVALID_PARAMS]: refused before dispatch'}]})});
  const refused=await refusal.gateway.execute('actor.place.editor',args);assert.equal(refused.isError,true);assert.equal(refused._meta['unreal-nexus/result-policy'].outcomeUnknown,false);await refusal.gateway.close();
  const success=fixture({config:{enabledCapabilities:['actor.place.editor']},reply:()=>json(good)});
  const out=await success.gateway.execute('actor.place.editor',args);assert.notEqual(out.isError,true);
  assert.equal(success.calls.length,1);assert.deepEqual(success.calls[0].call.arguments.args,{...args,world:'editor',onConflict:'error'});await success.gateway.close();
  for(const body of [{...good,actorLabel:'Wrong'},{...good,created:false},{success:false,error:'failed'}]){
    const f=fixture({config:{enabledCapabilities:['actor.place.editor']},reply:()=>json(body)});
    const result=await f.gateway.execute('actor.place.editor',args);assert.equal(result.isError,true);
    assert.equal(result._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    await assert.rejects(f.gateway.execute('actor.place.editor',args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(f.calls.length,1);await f.gateway.close();
  }
});

test('actor inspection fences a missing or different native actor identity',async()=>{
  for(const id of ['actor.inspect.editor','actor.inspect.pie']) {
    const args={actorPath:'/Game/Expected',...(id==='actor.inspect.pie'?{pieInstance:1}:{})};
    for(const body of [{success:true},{success:true,actorPath:'/Game/Wrong',path:'/Game/Wrong'},
      {success:true,actorPath:'/Game/Expected',path:'/Game/Wrong'},
      {success:true,actorPath:'/game/expected',path:'/game/expected'}]) {
      const receipt={...json(body),_meta:{'fixture/original':'retained'}};
      const {gateway:g,calls}=fixture({config:{enabledCapabilities:[id]},reply:()=>receipt});
      const out=await g.execute(id,args);
      assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
      assert.deepEqual(out.content,receipt.content);assert.equal(out._meta['fixture/original'],'retained');
      await assert.rejects(g.execute(id,args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
    }
    const spaced={...args,actorPath:'/Game/Expected '};
    const normalized=fixture({config:{enabledCapabilities:[id]},reply:()=>json({success:true,actorPath:'/Game/Expected',path:'/Game/Expected'})});
    const spacedOut=await normalized.gateway.execute(id,spaced);
    assert.equal(spacedOut._meta['unreal-nexus/result-policy'].outcomeUnknown,true);await normalized.gateway.close();
    const {gateway:g}=fixture({config:{enabledCapabilities:[id]},reply:()=>json({success:true,actorPath:args.actorPath,path:args.actorPath})});
    const out=await g.execute(id,args);assert.notEqual(out.isError,true);
    // A matching path is not proof of resolved world or PIE instance.
    assert.match(out._meta['unreal-nexus/result-policy'].note,/not independent proof/);await g.close();
  }
});

test('generated PCG wait fences contradictory run or component receipts',async()=>{
  const args={actorPath:'/Game/A',componentName:'PCG',runId:7,timeoutSeconds:30};
  const valid={success:true,state:'generated',runId:7,componentName:'PCG',lastRun:{id:7,state:'generated'}};
  for(const changes of [{componentName:'Other'},{componentName:undefined},{runId:8},
    {lastRun:{id:8,state:'generated'}},{actorPath:'/Game/Wrong'}]) {
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>json({...valid,...changes})});
    const out=await g.execute('pcg.generation.wait',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    await assert.rejects(g.execute('pcg.generation.wait',args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
  const {gateway:g}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>json(valid)});
  const out=await g.execute('pcg.generation.wait',args);assert.notEqual(out.isError,true);
  // The native waiter omits actorPath; matching the component does not attest the actor.
  assert.equal(Object.hasOwn(JSON.parse(out.content[0].text),'actorPath'),false);await g.close();
});


test('non-generated PCG waits fence contradictory reported targets without fencing valid supersession',async()=>{
  const args={actorPath:'/Game/A',componentName:'PCG',runId:7,timeoutSeconds:30};
  const cancelled={success:true,state:'cancelled',runId:7,componentName:'PCG',lastRun:{id:8,state:'generated'}};
  for(const changes of [{componentName:'Other'},{componentName:undefined},{actorPath:'/Game/Wrong'},{runId:8},{runId:undefined},
    {state:'cleaned',lastRun:{id:8,state:'generated'}},{state:'cleaned',lastRun:{id:7,state:'cancelled'}},
    {state:'idle',lastRun:{id:7,state:'idle'}},{lastRun:undefined}]) {
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>json({...cancelled,...changes})});
    const out=await g.execute('pcg.generation.wait',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    await assert.rejects(g.execute('pcg.generation.wait',args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
  for(const body of [cancelled]) {
    const {gateway:g}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>json(body)});
    const out=await g.execute('pcg.generation.wait',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);assert.equal(g.status().queue.blocked,false);await g.close();
  }
});


test('viewport capture validates bounded native PNG framing and metadata without claiming full decode',async()=>{
  const valid=screenshot();
  for(const change of [
    r=>{r.content[0].data='!';},
    r=>{const truncated=Buffer.from(r.content[0].data,'base64').subarray(0,33);r.content[0].data=truncated.toString('base64');r.structuredContent.data.sizeBytes=truncated.length;},
    r=>{const broken=Buffer.from(r.content[0].data,'base64');broken[broken.length-1]^=1;r.content[0].data=broken.toString('base64');},
    r=>{delete r.structuredContent.data.view;},
    r=>{r.structuredContent.data.width=2;},
    r=>{r.structuredContent.data.sizeBytes++;},
    r=>{r.content[0].mimeType='image/jpeg';},
    r=>{r.content.push({...r.content[0]});},
    r=>{r.isError=true;},
  ]) {
    const reply=structuredClone(valid);change(reply);
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>reply});
    const out=await g.execute('screenshot.viewport.current');assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);assert.deepEqual(out.content,reply.content);
    await assert.rejects(g.execute('screenshot.viewport.current'),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
  const {gateway:g}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>valid});
  const out=await g.execute('screenshot.viewport.current');assert.notEqual(out.isError,true);assert.deepEqual(out.content,valid.content);await g.close();
});


test('viewport capture requires the source-backed requested or default downscale box',async()=>{
  const image=(encoded,width,size)=>({content:[{type:'image',data:encoded,mimeType:'image/png'}],
    structuredContent:{success:true,operation:'execute',data:{width,height:1,view:'editor_viewport',sizeBytes:size,mimeType:'image/png'}}});
  const two=image('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII=',2,68);
  const wide=image('iVBORw0KGgoAAAANSUhEUgAABkEAAAABCAYAAABpGglqAAAAHUlEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAwKEBGQUAAbO4gGQAAAAASUVORK5CYII=',1601,86);
  for(const [reply,args] of [[two,{resolution:'1x1'}],[wide,{}]]) {
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>reply});
    const out=await g.execute('screenshot.viewport.current',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);assert.deepEqual(out.content,reply.content);
    await assert.rejects(g.execute('screenshot.viewport.current',args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
  for(const resolution of ['2x1','10x10']) {
    const {gateway:g}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>two});
    const out=await g.execute('screenshot.viewport.current',{resolution});assert.notEqual(out.isError,true);await g.close();
  }
});


test('PCG wait failure fences contradictory reported target but allows omitted preflight identity',async()=>{
  const args={actorPath:'/Game/A',componentName:'PCG',runId:7,timeoutSeconds:30};
  const failure={success:false,state:'timed_out',runId:7,error:'The generation did not finish.'};
  for(const change of [{runId:8},{componentName:'Other'},{actorPath:'/Game/Wrong'}]) {
    const reply=json({...failure,...change});
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>reply});
    const out=await g.execute('pcg.generation.wait',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);assert.deepEqual(out.content,reply.content);
    await assert.rejects(g.execute('pcg.generation.wait',args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
  for(const reply of [json({success:false,error:'preflight refusal'})]) {
    const {gateway:g}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>reply});
    const out=await g.execute('pcg.generation.wait',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);await g.close();
  }
});


test('viewport backend errors fence because native timeout can follow dispatch',async()=>{
  for(const text of ['Error [TIMEOUT]: Request timed out','Error: backend refused']) {
    const reply={isError:true,content:[{type:'text',text}],_meta:{original:'kept'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>reply});
    const out=await g.execute('screenshot.viewport.current');
    assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.deepEqual(out.content,reply.content);assert.equal(out._meta.original,'kept');
    await assert.rejects(g.execute('screenshot.viewport.current'),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
});


test('viewport screenshot validates bounded scanlines and accepts static Adam7',async()=>{
  const badZlib=mutatedPng(b=>{b[41]^=1;rewritePngCrc(b,33);});
  const excessive=mutatedPng(b=>{b.writeUInt32BE(2049,16);b.writeUInt32BE(2048,20);rewritePngCrc(b,8);});
  const adam7=mutatedPng(b=>{b[28]=1;rewritePngCrc(b,8);});
  for(const [encoded,width,height,args] of [[badZlib,1,1,{}],[excessive,2049,2048,{resolution:'2049x2048'}]]) {
    const reply=screenshot({width,height});reply.content[0].data=encoded;
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>reply});
    const out=await g.execute('screenshot.viewport.current',args);assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);assert.deepEqual(out.content,reply.content);
    await assert.rejects(g.execute('screenshot.viewport.current',args),{code:'EDITOR_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);await g.close();
  }
  const reply=screenshot();reply.content[0].data=adam7;
  const {gateway:g}=fixture({config:{enabledCapabilities:['screenshot.viewport.current']},reply:()=>reply});
  const out=await g.execute('screenshot.viewport.current');assert.notEqual(out.isError,true);assert.deepEqual(out.content,reply.content);await g.close();
});


test('current-viewport manifest discloses focus side effect without requiring write authority',async()=>{
  const {gateway:g,calls}=fixture({config:{enabledCapabilities:['screenshot.viewport.current'],allowWrites:false}});
  const tool=g.toolDefinitions()[0];
  assert.equal(tool.annotations.readOnlyHint,false);assert.equal(tool.annotations.destructiveHint,false);
  assert.match(tool.description,/foreground/);
  const out=await g.execute('screenshot.viewport.current');assert.notEqual(out.isError,true);assert.equal(calls.length,1);await g.close();
});


test('PCG execute correlates the acknowledged actor, component, run and seed before releasing the queue',async()=>{
  const args={actorPath:'/Game/Expected',seed:42};
  const valid={success:true,updated:true,actorPath:args.actorPath,componentName:'PCG',runId:7,
    lastRun:{id:7,state:'generating'},seed:42};
  for(const body of [
    {success:true}, {...valid,actorPath:'/Game/Wrong'}, {...valid,componentName:''},
    {...valid,runId:0}, {...valid,lastRun:{id:8,state:'generating'}},
    {...valid,lastRun:{id:7,state:'unknown'}}, {...valid,seed:43}, {success:false,error:'unknown failure'},
  ]) {
    const receipt={...json(body),_meta:{'fixture/original':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.generation.execute']},reply:()=>receipt});
    const out=await g.execute('pcg.generation.execute',args);
    assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.deepEqual(out.content,receipt.content);assert.equal(out._meta['fixture/original'],'preserved');
    await assert.rejects(g.execute('pcg.generation.execute',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);await g.close();
  }
  const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.generation.execute']},reply:()=>json(valid)});
  const out=await g.execute('pcg.generation.execute',args);
  assert.notEqual(out.isError,true);assert.equal(g.status().queue.blocked,false);assert.equal(calls.length,1);await g.close();
});


test('native hold routes refuse before startup until local ownership is established',async()=>{
  const argsById={
    'input.action.hold.start':{action_path:'/Game/Input/IA_Move.IA_Move',client_id:0,pie_instance:1,injection_id:'hold-1'},
    'input.action.hold.update':{injection_id:'hold-1',value_x:0,value_y:1,value_z:0},
    'input.action.hold.stop':{injection_id:'hold-1'},
  };
  const ids=Object.keys(argsById);
  const {gateway:g,starts,calls}=fixture({config:{enabledCapabilities:ids,allowWrites:true}});
  for(const id of ids) {
    assert.equal(g.plan(id,argsById[id]).dispatched,false);
    await assert.rejects(g.execute(id,argsById[id]),{code:'INPUT_HOLD_OWNERSHIP_UNVERIFIED'});
    assert.throws(()=>g.plan(id,{...argsById[id],allowOverride:true}),{code:'INVALID_ARGUMENTS'});
  }
  assert.deepEqual(starts,[]);assert.deepEqual(calls,[]);
  const held=g.status().heldCapabilities;
  assert.equal(held.length,ids.length);
  assert.deepEqual(new Set(held.map(item=>item.id)),new Set(ids));
  assert.ok(held.every(item=>item.reason==='native hold ownership and local-only routing unverified'));
  await g.close();
});

test('one-shot input requires a correlated local native receipt and fences uncertain responses',async()=>{
  const args={action_path:'/Game/Input/IA_Move.IA_Move',client_id:0,pie_instance:1};
  const valid={success:true,action:args.action_path,value_type:'Axis1D',
    idempotencyObservable:false,idempotencyNote:'Each call injects a frame.',
    rollbackPossible:false,rollbackNote:'An injected frame cannot be undone.'};
  for(const body of [
    {success:true}, {...valid,action:'/Game/Other'}, {...valid,value_type:'Bad'},
    {...valid,relayed:true}, {...valid,rollbackPossible:true},
    {...valid,idempotencyObservable:true}, {success:false,error:'native failure'},
  ]) {
    const reply={...json(body),_meta:{'fixture/original':'retained'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['input.action.once']},reply:()=>reply});
    const out=await g.execute('input.action.once',args);
    assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.deepEqual(out.content,reply.content);assert.equal(out._meta['fixture/original'],'retained');
    await assert.rejects(g.execute('input.action.once',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);await g.close();
  }
  const {gateway:g,calls}=fixture({config:{enabledCapabilities:['input.action.once']},reply:()=>json(valid)});
  const out=await g.execute('input.action.once',args);assert.notEqual(out.isError,true);
  assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
  assert.equal(calls.length,1);await g.close();
  const refusal=fixture({config:{enabledCapabilities:['input.action.once']},reply:()=>({isError:true,content:[{type:'text',text:'Error [NOT_CONNECTED]: refused'}]})});
  assert.equal((await refusal.gateway.execute('input.action.once',args))._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
  assert.equal(refusal.gateway.status().queue.blocked,false);await refusal.gateway.close();
});


test('material vector mutation stays held without a correlatable native receipt',async()=>{
  let starts=0;
  const g=new Gateway(catalog,{target,allowWrites:true,enabledCapabilities:['material.parameter.vector.persisted'],
    backendFactories:new Map([['hayba',async()=>{starts++;throw new Error('must not start');}]])});
  const args=catalog.get('material.parameter.vector.persisted').example;
  assert.equal(g.plan('material.parameter.vector.persisted',args).dispatched,false);
  await assert.rejects(g.execute('material.parameter.vector.persisted',args),{code:'MATERIAL_VECTOR_RECEIPT_UNVERIFIED'});
  assert.equal(starts,0);
  assert.equal(g.status().heldCapabilities[0].id,'material.parameter.vector.persisted');
  await g.close();
});


test('automation start and trace capture routes stay held before backend startup',async()=>{
  let starts=0;
  const ids=['automation.tests.run','insights.capture.start','insights.capture.stop','insights.trace.open'];
  const g=new Gateway(catalog,{target,allowWrites:true,enabledCapabilities:[...ids,'automation.tests.poll','insights.trace.close'],
    backendFactories:new Map([['claireon',async()=>{starts++;throw new Error('must not start');}]])});
  for(const id of ids) {
    const args=catalog.get(id).example;
    assert.equal(g.plan(id,args).dispatched,false);
    await assert.rejects(g.execute(id,args),{code:id==='automation.tests.run'?'AUTOMATION_RUN_OWNERSHIP_UNVERIFIED':id==='insights.trace.open'?'TRACE_READER_OWNERSHIP_UNVERIFIED':'TRACE_CAPTURE_OWNERSHIP_UNVERIFIED'});
  }
  assert.equal(starts,0);
  assert.deepEqual(new Set(g.status().heldCapabilities.map(item=>item.id)),new Set(ids));
  assert.ok(!g.status().heldCapabilities.some(item=>item.id==='automation.tests.poll'));
  assert.ok(!g.status().heldCapabilities.some(item=>item.id==='insights.trace.close'));
  await g.close();
});


test('PCG waiter timeout or state-read failure preserves receipt and fences subsequent work',async()=>{
  const args={actorPath:'/Game/A',componentName:'PCG',runId:7,timeoutSeconds:1};
  for (const body of [
    {success:false,state:'timed_out',runId:7,componentName:'PCG',lastRun:{id:7,state:'generating'},error:'The generation did not finish within 1s.'},
    {success:false,state:'timed_out',runId:7,error:'get_pcg_generation_state failed'},
  ]) {
    const receipt={...json(body),_meta:{'fixture/native':'preserved'}};
    const {gateway:g,calls}=fixture({config:{enabledCapabilities:['pcg.generation.wait']},reply:()=>receipt});
    const out=await g.execute('pcg.generation.wait',args);
    assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.equal(out._meta['fixture/native'],'preserved');
    assert.deepEqual(out.content,receipt.content);
    assert.equal(g.status().queue.blocked,true);
    await assert.rejects(g.execute('pcg.generation.wait',args),{code:'EDITOR_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);
    await g.close();
  }
});


test('both Blueprint compile forms stay held before backend startup',async()=>{
  let starts=0;
  const ids=['blueprint.compile.memory.asset','blueprint.compile.memory.session'];
  const g=new Gateway(catalog,{target,allowWrites:true,enabledCapabilities:ids,
    backendFactories:new Map([['claireon',async()=>{starts++;throw new Error('must not start');}]])});
  for(const id of ids) {
    const args=catalog.get(id).example;
    assert.equal(g.plan(id,args).dispatched,false);
    await assert.rejects(g.execute(id,args),{code:'BLUEPRINT_SESSION_OWNERSHIP_UNVERIFIED'});
    assert.throws(()=>g.plan(id,{...args,allowOverride:true}),{code:'INVALID_ARGUMENTS'});
  }
  assert.equal(starts,0);
  assert.deepEqual(new Set(g.status().heldCapabilities.map(item=>item.id)),new Set(ids));
  await g.close();
});


test('PIE lifecycle and status stay held before provider startup',async()=>{
  let starts=0;
  const ids=['pie.start.viewport','pie.stop','pie.status'];
  const g=new Gateway(catalog,{target,allowWrites:true,enabledCapabilities:ids,
    backendFactories:new Map([['unrealagentplayer',async()=>{starts++;throw new Error('must not start');}]])});
  for(const id of ids) {
    const args=catalog.get(id).example;
    assert.equal(g.plan(id,args).dispatched,false);
    await assert.rejects(g.execute(id,args),{code:'PIE_LIFECYCLE_OWNERSHIP_UNVERIFIED'});
    assert.throws(()=>g.plan(id,{...args,allowOverride:true}),{code:'INVALID_ARGUMENTS'});
  }
  assert.equal(starts,0);
  assert.deepEqual(new Set(g.status().heldCapabilities.map(item=>item.id)),new Set(ids));
  await g.close();
});


test('UAP Ending and unrecognized Stopping phases both remain uncertain',()=>{
  const op=catalog.get('pie.stop');
  for(const phase of ['Ending','Stopping']) {
    const native=json({ok:false,stopped:false,phase});
    const out=normalizeResult(op,native);
    assert.equal(out.isError,true);
    assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    assert.deepEqual(out.content,native.content);
  }
  const status=normalizeResult(catalog.get('pie.status'),json({ok:true,phase:'Stopping'}));
  assert.equal(status.isError,true);
  assert.equal(status._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
  assert.notEqual(normalizeResult(catalog.get('pie.status'),json({ok:true,phase:'Ending'})).isError,true);
});


test('material scalar mutation stays held without source-backed readback identity',async()=>{
  let starts=0;
  const id='material.parameter.scalar.persisted';
  const g=new Gateway(catalog,{target,allowWrites:true,enabledCapabilities:[id],
    backendFactories:new Map([['hayba',async()=>{starts++;throw new Error('must not start');}]])});
  const args=catalog.get(id).example;
  assert.equal(g.plan(id,args).dispatched,false);
  await assert.rejects(g.execute(id,args),{code:'MATERIAL_SCALAR_RECEIPT_UNVERIFIED'});
  assert.throws(()=>g.plan(id,{...args,allowOverride:true}),{code:'INVALID_ARGUMENTS'});
  assert.equal(starts,0);
  assert.equal(g.status().heldCapabilities[0].id,id);
  await g.close();
});


test('material texture mutation stays held without source-backed target and readback identity',async()=>{
  let starts=0;
  const id='material.parameter.texture.persisted';
  const g=new Gateway(catalog,{target,allowWrites:true,enabledCapabilities:[id],
    backendFactories:new Map([['hayba',async()=>{starts++;throw new Error('must not start');}]])});
  const args=catalog.get(id).example;
  assert.equal(g.plan(id,args).dispatched,false);
  await assert.rejects(g.execute(id,args),{code:'MATERIAL_TEXTURE_RECEIPT_UNVERIFIED'});
  assert.throws(()=>g.plan(id,{...args,allowOverride:true}),{code:'INVALID_ARGUMENTS'});
  assert.equal(starts,0);
  assert.equal(g.status().heldCapabilities[0].id,id);
  await g.close();
});


test('asset preflight refusal preserves normalized input multiplicity',async()=>{
  const row={path:'/Game/A',status:'refused',reason:'not loaded'};
  const body={success:false,refused:[row,row],error:"2 of 2 assetPaths cannot be saved, so nothing was written. The first: '/Game/A' - not loaded"};
  const reply={...json(body),_meta:{'fixture/original':'retained'}};
  const wrong=fixture({config:{enabledCapabilities:['asset.save.exact']},reply:()=>reply});
  const bad=await wrong.gateway.execute('asset.save.exact',{assetPaths:['/Game/A','/Game/B']});
  assert.equal(bad.isError,true);assert.deepEqual(bad.content,reply.content);
  assert.equal(bad._meta['fixture/original'],'retained');
  assert.equal(bad._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
  await assert.rejects(wrong.gateway.execute('asset.save.exact',{assetPaths:['/Game/A','/Game/B']}),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(wrong.calls.length,1);await wrong.gateway.close();
  const alias=fixture({config:{enabledCapabilities:['asset.save.exact']},reply:()=>reply});
  const known=await alias.gateway.execute('asset.save.exact',{assetPaths:['/Game/A','/Game/A ']});
  assert.equal(known.isError,true);assert.equal(known._meta['unreal-nexus/result-policy'].outcomeUnknown,false);
  assert.equal(alias.gateway.status().queue.blocked,false);assert.equal(alias.calls.length,1);await alias.gateway.close();
  const unicode=fixture({config:{enabledCapabilities:['asset.save.exact']},reply:()=>json({
    success:false,refused:[row],error:"1 of 1 assetPaths cannot be saved, so nothing was written. The first: '/Game/A' - not loaded"})});
  const ambiguous=await unicode.gateway.execute('asset.save.exact',{assetPaths:['/Game/A\u00a0']});
  assert.equal(ambiguous._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
  assert.equal(unicode.gateway.status().queue.blocked,true);await unicode.gateway.close();
});
