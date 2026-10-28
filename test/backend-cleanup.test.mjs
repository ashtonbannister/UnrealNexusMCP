import test from 'node:test';
import assert from 'node:assert/strict';
import {BackendPool} from '../src/backends.mjs';
import {createRuntime} from '../src/runtime.mjs';
import {parseConfig} from '../src/config.mjs';
import {markCleanupIncomplete} from '../src/errors.mjs';

const target={projectRoot:'/project/Demo.uproject',editorInstanceId:'epoch'};
const sources={fixture:{commit:'reviewed'}};
const valid=close=>({tools:new Set(),sourceCommit:'reviewed',identityVerified:true,target,
  supports:async()=>true,call:async()=>{},close});

test('shutdown during pending startup reports unconfirmed cleanup and closes a late backend',async()=>{
  let resolve,closes=0;
  const pool=new BackendPool(new Map([['fixture',()=>new Promise(r=>{resolve=r;})]]),sources,target,{cleanupTimeoutMs:25});
  const started=pool.get('fixture');
  await new Promise(r=>setImmediate(r));
  const shutdown=pool.close();
  await assert.rejects(shutdown,{code:'BACKEND_CLEANUP_INCOMPLETE'});
  await assert.rejects(pool.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
  assert.deepEqual(pool.status,[{provider:'fixture',state:'starting',cleanup:'unconfirmed'}]);
  resolve(valid(async()=>{closes++;}));
  await assert.rejects(started,{code:'GATEWAY_CLOSED'});
  assert.equal(closes,1);
  await assert.rejects(pool.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});

test('invalid late backend with a hanging close keeps its refusal and cleanup warning',async()=>{
  let closeCalls=0;
  const pool=new BackendPool(new Map([['fixture',async()=>({...valid(()=>{closeCalls++;return new Promise(()=>{});}),sourceCommit:'wrong'})]]),sources,target,{cleanupTimeoutMs:25});
  await assert.rejects(pool.get('fixture'),{code:'BACKEND_ATTESTATION_FAILED'});
  assert.deepEqual(pool.status,[{provider:'fixture',state:'failed',cleanup:'unconfirmed'}]);
  await assert.rejects(pool.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
  await assert.rejects(pool.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
  assert.equal(closeCalls,1);
});

test('identity refusal survives a bounded hanging close without dispatch or restart',async()=>{
  let connects=0,calls=0,closes=0;
  const cfg=parseConfig({version:1,target:{projectRoot:'/project/Demo.uproject',processId:123},allowWrites:true,
    timeoutMs:300,enabledCapabilities:['actor.inspect.editor'],backends:{'ue-mcp':{sourceRoot:'/source',transport:{type:'stdio',command:'node'}}}});
  const runtime=await createRuntime(cfg,{
    processInspector:async()=>({editorInstanceId:'epoch'}),resolvePath:async p=>p,
    sourceVerifier:async(_p,_cfg,source)=>({commit:source.commit}),
    connect:async()=>{connects++;return {listTools:async()=>[{name:'tools'}],
      callTool:async()=>{calls++;},close:async()=>{closes++;await new Promise(()=>{});}};},
    probeFactory:()=>({attestIdentity:async()=>({identityVerified:false,target:{}})}),
  });
  for(let i=0;i<2;i++) await assert.rejects(runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/A'}),{code:'BACKEND_ATTESTATION_FAILED'});
  assert.equal(connects,1);assert.equal(calls,0);assert.equal(closes,1);
  assert.equal(runtime.status().queue.blocked,false);
  assert.deepEqual(runtime.status().backends,[{provider:'ue-mcp',state:'failed',cleanup:'unconfirmed'}]);
  for(let i=0;i<2;i++) await assert.rejects(runtime.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});


test('backend without a close method is refused and cleanup remains unconfirmed',async()=>{
  let calls=0;
  const backend={...valid(undefined),call:async()=>{calls++;}};
  const pool=new BackendPool(new Map([['fixture',async()=>backend]]),sources,target,{cleanupTimeoutMs:25});
  await assert.rejects(pool.get('fixture'),{code:'BACKEND_ATTESTATION_FAILED'});
  assert.equal(calls,0);
  assert.deepEqual(pool.status,[{provider:'fixture',state:'failed',cleanup:'unconfirmed'}]);
  await assert.rejects(pool.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});


test('cleanup uncertainty survives sanitizing a non-Nexus startup error',async()=>{
  const cfg=parseConfig({version:1,target:{projectRoot:'/project/Demo.uproject',processId:123},allowWrites:true,
    timeoutMs:300,enabledCapabilities:['actor.inspect.editor'],backends:{'ue-mcp':{sourceRoot:'/source',transport:{type:'stdio',command:'node'}}}});
  const runtime=await createRuntime(cfg,{
    processInspector:async()=>({editorInstanceId:'epoch'}),resolvePath:async p=>p,
    sourceVerifier:async(_p,_cfg,source)=>({commit:source.commit}),
    connect:async()=>{throw markCleanupIncomplete(new Error('private transport detail'));},
  });
  await assert.rejects(runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/A'}),{code:'BACKEND_PREPARATION_FAILED'});
  assert.equal(runtime.status().queue.blocked,false);
  assert.deepEqual(runtime.status().backends,[{provider:'ue-mcp',state:'failed',cleanup:'unconfirmed'}]);
  await assert.rejects(runtime.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});
