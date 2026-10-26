import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../src/catalog.mjs';
import {Gateway} from '../src/gateway.mjs';
import {selectCapabilities} from '../src/packs.mjs';

const catalog=loadCatalog();
const target={projectRoot:'C:/Projects/NexusDemo/NexusDemo.uproject',editorInstanceId:'PID1234-start-unique'};
const json=(body)=>({content:[{type:'text',text:JSON.stringify(body)}]});
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
        if(provider==='enginewire') return {content:[{type:'image',data:'AAAA',mimeType:'image/png'}]};
        if(call.name==='pie_start') return json({ok:true,playing:true,phase:'Playing'});
        if(call.name==='pie_stop') return json({ok:true,stopped:true,phase:'NotPlaying'});
        if(call.name==='pie_status') return json({ok:true,phase:'NotPlaying',elapsed:0});
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
  assert.throws(()=>selectCapabilities(catalog,{enabledPacks:['material-strict']}),{code:'ADAPTER_REQUIRED'});
  assert.throws(()=>selectCapabilities(catalog,{enabledPacks:['made-up']}),{code:'UNKNOWN_PACK'});
});
test('discovery and planning do not start providers; execution starts only its selected provider',async()=>{
  const {gateway:g,starts,calls}=fixture();
  g.list();g.describe('pie.status');const plan=g.plan('pie.start.viewport',{timeout:60});
  assert.equal(plan.dispatched,false);assert.deepEqual(starts,[]);
  await g.execute('pie.status');
  await g.execute('pie.status');
  assert.deepEqual(starts,['unrealagentplayer']);
  assert.equal(calls.length,2);
  await g.execute('screenshot.viewport.current');
  assert.deepEqual(starts,['unrealagentplayer','enginewire']);
  assert.ok(!starts.includes('ue-mcp'));
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
  const result={content:[{type:'text',text:'Warning: not a rerender.'},{type:'image',data:'AAAA',mimeType:'image/png'}],
    structuredContent:{width:1280,height:720,warnings:['shader wait']},_meta:{original:true}};
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
test('UAP JSON errors and unconfirmed lifecycle states remain failures',async()=>{
  for(const body of [
    {ok:false,phase:'Starting',queued:true,error:'timeout'},
    {ok:true,phase:'Starting',playing:false},
    {ok:true,phase:'NotPlaying',playing:true},
    {ok:true,phase:'Playing'},
  ]) {
    const {gateway:g,calls}=fixture({reply:()=>json(body)});
    assert.equal((await g.execute('pie.start.viewport')).isError,true);
    assert.equal(calls.length,1);
  }
  const {gateway:g}=fixture({reply:()=>({content:[{type:'text',text:'okay'}]})});
  assert.equal((await g.execute('pie.status')).isError,true);
});
test('PIE stop must report stopped and NotPlaying, not just transport success',async()=>{
  for(const body of [{ok:true,phase:'Playing',stopped:false},{ok:true,phase:'NotPlaying'}]) {
    const {gateway:g}=fixture({reply:()=>json(body)});
    assert.equal((await g.execute('pie.stop')).isError,true);
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
    const {gateway:g}=fixture({reply:()=>json({success:true,state,runId:7,lastRun:{id:7,state}})});
    const out=await g.execute('pcg.generation.wait',args);
    assert.equal(out.isError===true,state!=='generated');
  }
  const {gateway:g}=fixture({reply:()=>json({success:true,state:'generated',runId:8,lastRun:{id:8,state:'generated'}})});
  assert.equal((await g.execute('pcg.generation.wait',args)).isError,true);
});
test('concurrent work is serialized; one factory starts once',async()=>{
  let active=0,maxActive=0;
  const {gateway:g,starts}=fixture({reply:async()=>{
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(r=>setTimeout(r,5));active--;
    return json({ok:true,phase:'NotPlaying'});
  }});
  await Promise.all([g.execute('pie.status'),g.execute('pie.status'),g.execute('pie.status')]);
  assert.equal(maxActive,1);assert.deepEqual(starts,['unrealagentplayer']);
});
test('transport failure fences execution; no retry or other provider fallback',async()=>{
  const {gateway:g,starts,calls}=fixture({reply:()=>{throw new Error('transport lost');}});
  await assert.rejects(g.execute('pie.start.viewport'),{code:'EDITOR_OUTCOME_UNKNOWN'});
  await assert.rejects(g.execute('screenshot.viewport.current'),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(calls.length,1);assert.deepEqual(starts,['unrealagentplayer']);
});
test('a backend revision mismatch or wrong editor refuses before tool dispatch',async()=>{
  for(const mismatch of ['revision','target','unverified','surface']) {
    let calls=0;
    const {gateway:g}=fixture({modifyFactories:(m)=>m.set('unrealagentplayer',async()=>({
      tools:new Set(mismatch==='surface'?[]:['pie_status']),
      sourceCommit:mismatch==='revision'?'0'.repeat(40):catalog.upstreams.sources.unrealagentplayer.commit,
      identityVerified:mismatch!=='unverified',
      target:mismatch==='target'?{...target,editorInstanceId:'other'}:target,
      supports:async()=>true,
      call:async()=>{calls++;return json({ok:true,phase:'NotPlaying'});},
    }))});
    await assert.rejects(g.execute('pie.status'),{
      code:mismatch==='surface'?'BACKEND_SURFACE_MISMATCH':'BACKEND_ATTESTATION_FAILED'
    });
    assert.equal(calls,0);assert.equal(g.status().queue.blocked,false);
  }
});
test('failed startup is never transparently retried',async()=>{
  let starts=0;
  const {gateway:g}=fixture({modifyFactories:(m)=>m.set('unrealagentplayer',async()=>{starts++;throw new Error('offline');})});
  await assert.rejects(g.execute('pie.status'));
  await assert.rejects(g.execute('pie.status'));
  assert.equal(starts,1);
});
test('a queued request snapshots arguments before caller mutation',async()=>{
  let release;
  const {gateway:g,calls}=fixture({reply:async(provider)=>{
    if(provider==='unrealagentplayer') await new Promise(r=>{release=r;});
    return provider==='unrealagentplayer'?json({ok:true,phase:'NotPlaying'}):json({success:true});
  }});
  const first=g.execute('pie.status');
  await new Promise(r=>setImmediate(r));
  const args={assetPaths:['/Game/Intended']};
  const second=g.execute('asset.save.exact',args);args.assetPaths[0]='/Game/Unexpected';
  release();await Promise.all([first,second]);
  assert.deepEqual(calls[1].call.arguments.args.assetPaths,['/Game/Intended']);
});
test('close only closes loaded backends and disallows subsequent execution',async()=>{
  const {gateway:g,closes}=fixture();
  await g.execute('pie.status');await g.close();await g.close();
  assert.deepEqual(closes,['unrealagentplayer']);
  await assert.rejects(g.execute('pie.status'),{code:'GATEWAY_CLOSED'});
});
test('invalid host configuration is rejected',()=>{
  for(const timeoutMs of [0,99,1.5,Infinity,600001]) {
    assert.throws(()=>new Gateway(catalog,{timeoutMs}),{code:'INVALID_CONFIGURATION'});
  }
  assert.throws(()=>new Gateway(catalog,{target:{projectRoot:'',editorInstanceId:'x'}}),{code:'INVALID_CONFIGURATION'});
});

test('a public meta tool does not prove an inner capability is enabled',async()=>{
  let calls=0;
  const {gateway:g}=fixture({modifyFactories:(m)=>m.set('unrealagentplayer',async()=>({
    tools:new Set(['pie_status']),sourceCommit:catalog.upstreams.sources.unrealagentplayer.commit,
    identityVerified:true,target,supports:async()=>false,
    call:async()=>{calls++;return json({ok:true,phase:'NotPlaying'});},
  }))});
  await assert.rejects(g.execute('pie.status'),{code:'CAPABILITY_UNAVAILABLE'});
  assert.equal(calls,0);
  assert.equal(g.status().queue.blocked,false);
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
  const {gateway:g,calls}=fixture({reply:()=>native});
  const result=await g.execute('pie.start.viewport');
  assert.equal(result.isError,true);
  assert.equal(result._meta['unreal-nexus/receipt'].outcome,'outcome_unknown');
  assert.deepEqual(result.content,native.content);
  assert.equal(g.status().queue.blocked,true);
  assert.equal(g.status().queue.reason.code,'NATIVE_WORK_OUTSTANDING');
  await assert.rejects(g.execute('asset.save.exact',{assetPaths:['/Game/A']}),{code:'EDITOR_OUTCOME_UNKNOWN'});
  await assert.rejects(g.execute('pie.stop'),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(calls.length,1);
});
test('native incomplete PIE teardown also fences further work',async()=>{
  const {gateway:g}=fixture({reply:()=>json({ok:false,stopped:false,phase:'Stopping'})});
  assert.equal((await g.execute('pie.stop')).isError,true);
  assert.equal(g.status().queue.blocked,true);
});
test('missing backend is a pre-dispatch refusal, not uncertainty for another provider',async()=>{
  const {gateway:g,calls}=fixture({modifyFactories:m=>m.delete('unrealagentplayer')});
  await assert.rejects(g.execute('pie.status'),{code:'BACKEND_UNAVAILABLE'});
  assert.equal(g.status().queue.blocked,false);
  await g.execute('screenshot.viewport.current');
  assert.deepEqual(calls.map(c=>c.provider),['enginewire']);
});
test('execute rejects original accessors without invoking getters or starting a backend',async()=>{
  const {gateway:g,starts}=fixture();let read=0;
  await assert.rejects(g.execute('asset.save.exact',{
    get assetPaths(){read++;return ['/Game/A'];}
  }),{code:'INVALID_ARGUMENTS'});
  assert.equal(read,0);assert.deepEqual(starts,[]);
});
test('current viewport capture preserves a PIE source without claiming an editor-only image',async()=>{
  const native={content:[{type:'image',data:'AAAA',mimeType:'image/png'}],
    structuredContent:{view:'pie_game',width:1280,height:720,shaderWait:{remaining:3}}};
  const {gateway:g}=fixture({reply:()=>native});
  const result=await g.execute('screenshot.viewport.current');
  assert.equal(result.structuredContent.view,'pie_game');
  assert.deepEqual(result.structuredContent.shaderWait,{remaining:3});
  assert.throws(()=>g.plan('screenshot.editor'),{code:'OPERATION_NOT_EXPOSED'});
});
