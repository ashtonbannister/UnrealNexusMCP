import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../src/catalog.mjs';
import {BackendPool} from '../src/backends.mjs';

const catalog=loadCatalog();
const target={projectRoot:'C:/Projects/NexusDemo/NexusDemo.uproject',editorInstanceId:'PID1234-start-unique'};
const provider='ue-mcp';
const never=()=>new Promise(()=>{});

function backend(overrides={}) {
  return {
    tools:new Set(['tools']),sourceCommit:catalog.upstreams.sources[provider].commit,
    identityVerified:true,target,supports:async()=>true,call:async()=>({content:[]}),
    close:async()=>{},...overrides,
  };
}
function pool(factory,closeTimeoutMs) {
  return new BackendPool(new Map([[provider,factory]]),catalog.upstreams.sources,target,closeTimeoutMs);
}

test('pool shutdown succeeds and repeats idempotently when cleanup is confirmed',async()=>{
  const p=pool(async()=>backend(),200);
  await p.get(provider);
  await p.close();
  await p.close();
  assert.deepEqual(p.status,[{provider,state:'ready'}]);
});

test('a close that never settles is bounded and reported as unconfirmed',async()=>{
  const p=pool(async()=>backend({close:never}),50);
  await p.get(provider);
  const started=Date.now();
  const first=p.close();
  await assert.rejects(first,{code:'BACKEND_CLEANUP_INCOMPLETE'});
  assert.ok(Date.now()-started<2000,'shutdown must not wait on the hung close');
  assert.deepEqual(p.status,[{provider,state:'ready',cleanup:'unconfirmed'}]);
  // Repeated shutdown returns the same memoized incomplete outcome, without retrying close.
  assert.equal(p.close(),first);
  await assert.rejects(p.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});

test('a rejecting close is reported as unconfirmed cleanup',async()=>{
  const p=pool(async()=>backend({close:async()=>{throw new Error('private detail');}}),200);
  await p.get(provider);
  await assert.rejects(p.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
  assert.deepEqual(p.status,[{provider,state:'ready',cleanup:'unconfirmed'}]);
});

test('a startup that never settles does not block shutdown and is reported unconfirmed',async()=>{
  const p=pool(never,50);
  const pending=p.get(provider).catch(()=>{});
  const started=Date.now();
  await assert.rejects(p.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
  assert.ok(Date.now()-started<2000,'shutdown must not wait on the hung startup');
  assert.deepEqual(p.status,[{provider,state:'starting',cleanup:'unconfirmed'}]);
  void pending; // Intentionally never settles; the process exits once the test completes.
});

test('a failed startup keeps its original error and does not make shutdown wait',async()=>{
  const p=pool(async()=>{throw Object.assign(new Error('no editor'),{code:'EDITOR_IDENTITY_UNCONFIRMED'});},200);
  await assert.rejects(p.get(provider),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
  await p.close();
  assert.deepEqual(p.status,[{provider,state:'failed'}]);
});

test('close timeout must be a bounded positive integer',()=>{
  for (const bad of [0,-1,1.5,'100',60001,Infinity]) {
    assert.throws(()=>pool(async()=>backend(),bad),{code:'INVALID_CONFIGURATION'});
  }
});
