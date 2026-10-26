import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorQueue} from '../src/queue.mjs';

const options=(operation='test')=>({effect:'write',timeoutMs:1000,operation});
test('queue serializes calls and applies admission limit',async()=>{
  const q=new EditorQueue({maxPending:2}); let release; const order=[];
  const first=q.run(async()=>{order.push('first-start');await new Promise(r=>{release=r;});order.push('first-end');},options());
  const second=q.run(async()=>{order.push('second');},options());
  await assert.rejects(q.run(async()=>{},options()),{code:'QUEUE_FULL'});
  await new Promise(r=>setImmediate(r)); assert.deepEqual(order,['first-start']);
  release(); await Promise.all([first,second]);
  assert.deepEqual(order,['first-start','first-end','second']);
  assert.equal(q.status.pending,0);
});
test('transport failure fences pending/future work without retry',async()=>{
  const q=new EditorQueue(); let calls=0;
  const first=q.run(async()=>{calls++;throw Object.assign(new Error('lost'),{code:'DISCONNECTED'});},options('mutate'));
  const next=q.run(async()=>{calls++;},options('other'));
  await assert.rejects(first,{code:'EDITOR_OUTCOME_UNKNOWN'});
  await assert.rejects(next,{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(calls,1); assert.equal(q.status.blocked,true);
  assert.equal(q.status.reason.code,'DISCONNECTED');
});
test('timeout does not imply cancellation or permit more work',async()=>{
  const q=new EditorQueue(); let finish; let completed=false;
  await assert.rejects(q.run(async()=>{await new Promise(r=>{finish=r;});completed=true;},
    {...options('slow'),timeoutMs:10}),{code:'EDITOR_OUTCOME_UNKNOWN'});
  assert.equal(completed,false); assert.equal(q.status.blocked,true);
  finish(); await new Promise(r=>setImmediate(r)); assert.equal(completed,true);
  await assert.rejects(q.run(async()=>{},options()),{code:'EDITOR_OUTCOME_UNKNOWN'});
});
test('returned native error is not silently retried and is different from transport loss',async()=>{
  const q=new EditorQueue();
  assert.deepEqual(await q.run(async()=>({isError:true}),options()),{isError:true});
  assert.equal(q.status.blocked,false);
});
test('invalid queue capacity is refused',()=>{
  for(const maxPending of [0,-1,1.5,Infinity,1025]) {
    assert.throws(()=>new EditorQueue({maxPending}),{code:'INVALID_CONFIGURATION'});
  }
});

test('pre-dispatch preparation refusal retains its error and permits unrelated work',async()=>{
  const q=new EditorQueue();let calls=0;
  await assert.rejects(q.run(async()=>{calls++;}, {
    ...options(),prepare:async()=>{throw Object.assign(new Error('not installed'),{code:'BACKEND_UNAVAILABLE'});}
  }),{code:'BACKEND_UNAVAILABLE'});
  assert.equal(q.status.blocked,false);
  await q.run(async()=>{calls++;},options());
  assert.equal(calls,1);
});
test('late preparation cannot dispatch after preparation deadline',async()=>{
  const q=new EditorQueue();let finish;let calls=0;
  await assert.rejects(q.run(async()=>{calls++;},{
    ...options(),timeoutMs:10,prepare:()=>new Promise(r=>{finish=r;})
  }),{code:'BACKEND_PREPARATION_TIMEOUT'});
  assert.equal(q.status.blocked,false);
  finish({});await new Promise(r=>setImmediate(r));
  assert.equal(calls,0);
  await q.run(async()=>{calls++;},options());
  assert.equal(calls,1);
});
