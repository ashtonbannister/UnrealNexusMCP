import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough, Writable} from 'node:stream';
import {createWindowsProcessInspector} from '../src/windows-process-inspector.mjs';

function fixture(reply) {
  const requests=[];let starts=0,kills=0;
  const spawnProcess=()=>{
    starts++;
    const child=new EventEmitter();
    child.stdout=new PassThrough();child.stderr=new PassThrough();
    let closed=false;
    const finish=()=>{if(!closed){closed=true;queueMicrotask(()=>child.emit('close',0));}};
    child.stdin=new Writable({
      write(chunk,_encoding,callback) {
        const line=chunk.toString().trim();requests.push(line);
        callback();
        const [id,kind,pid,port]=line.split(':');
        reply?.({child,id,kind,pid:Number(pid),port:port===undefined?undefined:Number(port),count:requests.length});
      },
      final(callback){callback();finish();},
    });
    child.kill=()=>{kills++;finish();return true;};
    return child;
  };
  return {spawnProcess,requests,get starts(){return starts;},get kills(){return kills;}};
}
function answer({child,id,pid},change={}) {
  const row={processId:pid,startTicks:'638123456789000000',
    executablePath:'C:\\Engine\\UnrealEditor.exe',commandLine:'"C:\\Engine\\UnrealEditor.exe" "D:\\Game.uproject"'};
  const snapshot={beforeTicks:'638123456789000009',process:row,afterTicks:'638123456789000009'};
  child.stdout.write(JSON.stringify({id,ok:true,snapshot,...change})+'\n');
}
test('worker serializes independent requests and closes after use',async()=>{
  const f=fixture(request=>answer(request));
  const worker=createWindowsProcessInspector({spawnProcess:f.spawnProcess,timeoutMs:1000});
  const [a,b]=await Promise.all([worker.inspect(100),worker.inspect(101)]);
  assert.equal(a.processId,100);assert.equal(b.processId,101);
  assert.equal(f.starts,1);assert.equal(f.requests.length,2);
  await worker.close();await worker.close();
  await assert.rejects(worker.inspect(100),{code:'IDENTITY_UNPROVEN'});
});
test('crossed responses stop the worker and are never retried',async()=>{
  const f=fixture(request=>answer(request,{id:'0000000000000000'}));
  const worker=createWindowsProcessInspector({spawnProcess:f.spawnProcess,timeoutMs:1000});
  await assert.rejects(worker.inspect(100),{code:'IDENTITY_UNPROVEN'});
  await assert.rejects(worker.inspect(100),{code:'IDENTITY_UNPROVEN'});
  assert.equal(f.starts,1);assert.equal(f.requests.length,1);assert.equal(f.kills,1);
  await worker.close();
});
test('a timeout fails the worker rather than replaying an inspection',async()=>{
  const f=fixture();
  const worker=createWindowsProcessInspector({spawnProcess:f.spawnProcess,timeoutMs:100});
  await assert.rejects(worker.inspect(100),{code:'IDENTITY_UNPROVEN'});
  await assert.rejects(worker.inspect(100),{code:'IDENTITY_UNPROVEN'});
  assert.equal(f.starts,1);assert.equal(f.requests.length,1);await worker.close();
});
test('invalid PIDs fail before creating a helper',async()=>{
  const f=fixture();
  const worker=createWindowsProcessInspector({spawnProcess:f.spawnProcess,timeoutMs:100});
  await assert.rejects(worker.inspect(-1),{code:'IDENTITY_UNPROVEN'});
  assert.equal(f.starts,0);await worker.close();
});


test('unconfirmed worker shutdown is reported and triggers termination',async()=>{
  let kills=0;
  const spawnProcess=()=>{
    const child=new EventEmitter();
    child.stdout=new PassThrough();child.stderr=new PassThrough();
    child.stdin=new Writable({
      write(chunk,_encoding,callback){const [id,,pid]=chunk.toString().trim().split(':');callback();answer({child,id,pid:Number(pid)});},
      final(callback){callback();},
    });
    child.kill=()=>{kills++;queueMicrotask(()=>child.emit('close',0));return true;};
    return child;
  };
  const worker=createWindowsProcessInspector({spawnProcess,timeoutMs:1000,closeTimeoutMs:100});
  await worker.inspect(100);
  await assert.rejects(worker.close(),{code:'PROCESS_INSPECTOR_CLOSE_TIMEOUT'});
  assert.equal(kills,1);
});


test('listener checks require exactly the selected owner and reject remote endpoints',async()=>{
  let owners=[100];
  const f=fixture(({child,id,kind,port})=>{
    assert.equal(kind,'l');assert.equal(port,12345);
    child.stdout.write(JSON.stringify({id,ok:true,owners})+'\n');
  });
  const worker=createWindowsProcessInspector({spawnProcess:f.spawnProcess,timeoutMs:1000});
  assert.deepEqual(await worker.inspectListener('http://127.0.0.1:12345',100),
    {processId:100,port:12345,method:'windows-tcp-owner'});
  owners=[100,101];
  await assert.rejects(worker.inspectListener('http://127.0.0.1:12345',100),{code:'IDENTITY_UNPROVEN'});
  owners=[];
  await assert.rejects(worker.inspectListener('http://127.0.0.1:12345',100),{code:'IDENTITY_UNPROVEN'});
  await assert.rejects(worker.inspectListener('http://example.com:12345',100),{code:'IDENTITY_UNPROVEN'});
  assert.equal(f.starts,1);assert.equal(f.requests.length,3);await worker.close();
});
