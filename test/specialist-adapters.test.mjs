import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import catalog from '../catalog/specialists.json' with { type: 'json' };
import patches from '../catalog/compatibility-patches.json' with { type: 'json' };
import { compileSchema } from '../src/validation.mjs';
import { buildSpecialistCall, createSpecialistAdapter, specialistNativeToolName } from '../src/specialist-adapters.mjs';

const operation = (id) => {
  const value = catalog.operations.find((op) => op.id === id);
  assert.ok(value, 'fixture operation exists: '+id);
  return value;
};
const shape = (properties,required=[]) => ({type:'object',properties,required});
const s={type:'string'},n={type:'number'},i={type:'integer'},b={type:'boolean'};
const schemas = {
  bp_compile:shape({asset_path:s,session_id:s,response_mode:s}),
  test_run:shape({testFilter:s,noTimeout:b,strict:b,expected_tests:{type:'array',items:s},allowed_skips:{type:'array',items:{type:'object'}}}),
  test_poll:shape({run_id:s,cancel:b}),
  pie_trace_start:shape({filename:s,directory:s,channels:s}),pie_trace_stop:shape({}),
  trace_open:shape({filePath:s},['filePath']),
  trace_get_top_scopes:shape({sessionId:s,startTime:n,endTime:n,startFrame:i,endFrame:i,
    threadFilter:s,includeGpu:b,sortBy:{type:'string',enum:['totalInclusive','count']},maxResults:i},['sessionId']),
  trace_get_frame_stats:shape({sessionId:s,frameType:{type:'string',enum:['game','render']},
    startFrame:i,endFrame:i,hitchThresholdMs:n,onlyHitches:b,maxResults:i},['sessionId']),
  trace_close:shape({sessionId:s},['sessionId']),
};
const claireonTools = () => [
  {name:'python_execute',inputSchema:shape({code:s,quiet:b,nexus_skip_auto_save:b},['code'])},
  {name:'tool_search',inputSchema:shape({tool_name:s})},
];
const haybaTools = () => [{name:'material_set_param',inputSchema:shape({
  instance_path:s,param_name:s,nexus_retry_policy:{type:'string',const:'never'},
  value:{anyOf:[n,{type:'array',items:n,minItems:1,maxItems:4},s]},
},['instance_path','param_name','value','nexus_retry_policy'])}];
const native = (data={},summary='native result',warnings=[]) => ({data,summary,warnings});
function requestPayload(args) {
  const match=args.code.match(/_nexus_payload = json\.loads\(base64\.b64decode\("([A-Za-z0-9+/=]+)"\)/);
  assert.ok(match,'fixed JSON payload is embedded once');
  return JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
}
function frameResult(payload,result,overrides={}) {
  const frame={version:1,id:payload.id,nonce:payload.nonce,probe:payload.probe,
    ok:true,unknown:false,native:result,error:null,...overrides};
  const line='NEXUS_RESULT_'+payload.nonce+':'+Buffer.from(JSON.stringify(frame)).toString('base64')+':END';
  return {content:[{type:'text',text:'<execute-result status="success">\n<logs>\n'+line+'\n</logs>\n</execute-result>'}]};
}
function claireon(handler=()=>native(),{tools=claireonTools(),probeTransform}={}) {
  const calls=[];
  const adapter=createSpecialistAdapter({provider:'claireon',tools,callTool:async(name,args,options)=>{
    const payload=requestPayload(args);
    calls.push({name,args,options,payload});
    assert.equal(name,'python_execute');
    assert.equal(args.quiet,true);
    assert.equal(args.nexus_skip_auto_save,true);
    if(payload.probe) {
      const fn=args.code.match(/claireon\.tool_search\(tool_name="([a-z_]+)"\)/)?.[1];
      assert.ok(fn && schemas[fn],'probe targets one reviewed inner callable');
      const value=native({deep_inspect:true,tool:{name:fn,input_schema:structuredClone(schemas[fn])}},'Deep inspect: '+fn);
      return frameResult(payload,probeTransform?probeTransform(value):value);
    }
    const result=await handler(payload,args,options);
    return result?.content ? result : frameResult(payload,result);
  }});
  return {adapter,calls};
}
const compileReceipt=(extra={},summary='ok: Compilation successful')=>native({
  asset_path:'/Game/Blueprints/BP_Vehicle.BP_Vehicle',session_id:'bp-owned',response_mode:'status',
  compile_log:[],compile_log_total_entries:0,compile_log_num_errors:0,compile_log_num_warnings:0,...extra,
},summary);
async function run(adapter,id,args=operation(id).example) {
  const op=operation(id);
  assert.equal(await adapter.supports(op),true);
  const call=buildSpecialistCall(op,args);
  assert.equal(adapter.validateCall(call),true);
  return adapter.call(call,10000);
}
const startTests={testFilter:'Vehicle.Smoke',expected_tests:['Vehicle.Smoke.Input'],allowed_skips:[]};
const accepted=()=>native({run_id:'run-owned',state:'awaiting_workers',total:1,completed:0,
  suggested_poll_after_seconds:5,poll_with:'test_poll'});
const terminal=()=>native({},'Tests completed successfully\nResults: 1 passed, 0 failed, 0 skipped, 0 not run\nStrict: PASSED -- 1 discovered, 1 reported, 0 allowlisted skip(s) observed.\n');

test('all thirteen specialist schemas/examples compile in the supported validator subset',()=>{
  assert.equal(catalog.operations.length,13);
  for(const op of catalog.operations) {
    assert.equal(compileSchema(op.parameters)(op.example),true);
    const planned=buildSpecialistCall(op,op.example);
    assert.equal(planned.name,specialistNativeToolName(op));
    assert.ok(op.requiredCompatibility);
  }
});

test('fixed recipes reject unknown public/Python names, raw caller code and altered routes',()=>{
  const op=operation('blueprint.compile.memory.asset');
  assert.throws(()=>buildSpecialistCall({...op,id:'python.execute'},{code:'print(1)'}),{code:'SPECIALIST_ROUTE_REFUSED'});
  assert.throws(()=>buildSpecialistCall(op,{...op.example,code:'import os'}),{code:'INVALID_ARGUMENTS'});
  assert.throws(()=>buildSpecialistCall({...op,route:{...op.route,fixed:{response_mode:'full'}}},op.example),{code:'SPECIALIST_ROUTE_REFUSED'});
  assert.throws(()=>buildSpecialistCall(op,{asset_path:'/Game/../Engine/Foo'}),{code:'INVALID_ARGUMENTS'});
  assert.throws(()=>buildSpecialistCall(operation('material.parameter.scalar.persisted'),{
    instance_path:'/Game/M/MI',param_name:'X',value:Infinity}),{code:'INVALID_ARGUMENTS'});
});

test('ordinary unpatched python_execute is refused before even a read-only capability probe',async()=>{
  const tools=claireonTools();delete tools[0].inputSchema.properties.nexus_skip_auto_save;
  const {adapter,calls}=claireon(()=>compileReceipt(),{tools});
  assert.equal(await adapter.supports(operation('blueprint.compile.memory.asset')),false);
  assert.equal(calls.length,0);
});

test('live deep inspection must return the exact function, types and satisfiable required fields',async()=>{
  for(const change of [
    (v)=>{v.data.tool.name='other';},
    (v)=>{v.data.tool.input_schema.properties.asset_path={type:'number'};},
    (v)=>{v.data.tool.input_schema.required=['new_required_argument'];},
    (v)=>{v.data.deep_inspect=false;},
  ]) {
    const {adapter,calls}=claireon(()=>compileReceipt(),{probeTransform:(v)=>{change(v);return v;}});
    assert.equal(await adapter.supports(operation('blueprint.compile.memory.asset')),false);
    assert.equal(calls.length,1);
    assert.equal(calls[0].payload.probe,true);
  }
});

test('compiler status comes from native status summary and structured diagnostics; content is preserved',async()=>{
  const png={type:'image',mimeType:'image/png',data:'AA=='};
  const {adapter,calls}=claireon((p)=>{
    const result=frameResult(p,compileReceipt({compile_log_num_warnings:101,compile_log_total_entries:101,
      compile_log:Array.from({length:100},(_,index)=>({severity:'warning',message:'bounded diagnostic '+index,node_guid:'node-'+index})),compile_log_truncated:true},
    'ok: Compilation successful (with warnings)'));
    result.content.push(png,{type:'text',text:'Native advisory retained.'});
    return result;
  });
  const result=await run(adapter,'blueprint.compile.memory.asset');
  assert.equal(result.structuredContent.phase,'compiled-memory-only');
  assert.equal(result.structuredContent.saved,false);
  assert.equal(result.structuredContent.native.data.compile_log_truncated,true);
  assert.ok(result.content.includes(png));
  assert.equal(calls[1].payload.args.response_mode,'status');
  assert.equal(calls[1].payload.args.asset_path,'/Game/Blueprints/BP_Vehicle');
  assert.equal(calls[1].args.code.includes('claireon.bp_compile('),true);
});

test('compiler unknown status, wrong target and missing diagnostics are unknown outcomes',async()=>{
  for(const value of [compileReceipt({},'ok: Compilation status unknown'),
    compileReceipt({asset_path:'/Game/Other.Other'}),compileReceipt({compile_log_num_errors:undefined})]) {
    const {adapter}=claireon(()=>value);
    await assert.rejects(run(adapter,'blueprint.compile.memory.asset'),{code:'SPECIALIST_OUTCOME_UNKNOWN'});
  }
});

test('known inner RuntimeError envelope preserves native error/diagnostic data',async()=>{
  const {adapter}=claireon((p)=>frameResult(p,compileReceipt({compile_log_num_errors:1,
    compile_log_total_entries:1,compile_log:[{severity:'error',message:'unconnected pin'}]},''),
  {ok:false,error:'Tool bp_compile failed: unconnected pin'}));
  const result=await run(adapter,'blueprint.compile.memory.asset');
  assert.equal(result.isError,true);
  assert.equal(result.structuredContent.ok,false);
  assert.match(result.structuredContent.error,/unconnected pin/);
  assert.equal(result.structuredContent.native.data.compile_log_num_errors,1);
});

test('outer errors, missing/duplicate/partial/spilled/wrong nonce frames fail closed',async()=>{
  const changes=[
    (r)=>{r.isError=true;},
    (r)=>{r.content=[];},
    (r)=>{r.content.push({...r.content[0]});},
    (r)=>{r.content[0].text=r.content[0].text.replace(':END',':EN');},
    (r)=>{r.content.push({type:'text',text:'<spilled stream="stdout"/>'});},
    (r)=>{r._meta={truncated:true};},
    (r)=>{r.content[0].text=r.content[0].text.replace(/NEXUS_RESULT_[a-f0-9]+:/,'NEXUS_RESULT_00000000000000000000000000000000:');},
  ];
  for(const change of changes) {
    const {adapter}=claireon((p)=>{const r=frameResult(p,compileReceipt());change(r);return r;});
    await assert.rejects(run(adapter,'blueprint.compile.memory.asset'),(e)=>{
      assert.equal(e.code,'SPECIALIST_OUTCOME_UNKNOWN');assert.ok(e.backendResult);return true;
    });
  }
});

test('unknown Python exceptions are not relabeled as native refusal or rollback',async()=>{
  const {adapter}=claireon((p)=>frameResult(p,null,{ok:false,unknown:true,error:'Watchdog timeout'}));
  await assert.rejects(run(adapter,'blueprint.compile.memory.asset'),{code:'SPECIALIST_OUTCOME_UNKNOWN'});
});

test('tampered generated code is rejected before dispatch and readiness is not consumed by preflight',async()=>{
  const {adapter,calls}=claireon(()=>compileReceipt());
  const op=operation('blueprint.compile.memory.asset');
  assert.equal(await adapter.supports(op),true);
  const call=buildSpecialistCall(op,op.example);
  assert.equal(adapter.validateCall(call),true);
  const tampered=structuredClone(call);tampered.arguments.code='import os';
  assert.throws(()=>adapter.validateCall(tampered),{code:'SPECIALIST_ROUTE_REFUSED'});
  assert.equal(calls.length,1);
  assert.equal(adapter.validateCall(call),true);
  assert.equal((await adapter.call(call,1000)).structuredContent.ok,true);
  await assert.rejects(adapter.call(call,1000),{code:'CAPABILITY_UNAVAILABLE'});
});

test('strict tests fix native strict/deadline and reject invalid skip policy',async()=>{
  const {adapter,calls}=claireon(()=>accepted());
  const result=await run(adapter,'automation.tests.run',startTests);
  assert.equal(result.structuredContent.phase,'accepted');
  assert.equal(calls[1].payload.args.strict,true);
  assert.equal(calls[1].payload.args.noTimeout,false);
  assert.deepEqual(adapter.ownedState().automationRun.expectedTests,startTests.expected_tests);
  assert.throws(()=>buildSpecialistCall(operation('automation.tests.run'),{
    ...startTests,allowed_skips:[{name:'Unrelated',reason:'not in selected set'}]}),{code:'INVALID_ARGUMENTS'});
  assert.throws(()=>buildSpecialistCall(operation('automation.tests.run'),{
    ...startTests,noTimeout:true}),{code:'INVALID_ARGUMENTS'});
});

test('test run ownership, progress and once-only native terminal verdict are distinguished',async()=>{
  let polls=0;
  const {adapter,calls}=claireon((p)=>{
    if(p.id==='automation.tests.run')return accepted();
    if(polls++===0)return native({run_id:'run-owned',state:'running',total:1,completed:0,suggested_poll_after_seconds:10});
    return terminal();
  });
  await run(adapter,'automation.tests.run',startTests);
  assert.equal(await adapter.supports(operation('automation.tests.run')),true);
  const second=buildSpecialistCall(operation('automation.tests.run'),startTests);
  assert.throws(()=>adapter.validateCall(second),{code:'RUN_ALREADY_OWNED'});
  assert.equal(calls.filter((c)=>!c.payload.probe).length,1);
  const progress=await run(adapter,'automation.tests.poll',{run_id:'run-owned'});
  assert.equal(progress.structuredContent.phase,'running');
  const done=await run(adapter,'automation.tests.poll',{run_id:'run-owned'});
  assert.equal(done.structuredContent.phase,'passed');
  assert.equal(done.structuredContent.gateReleased,true);
  assert.equal(adapter.ownedState().automationRun,null);
  assert.equal(await adapter.supports(operation('automation.tests.poll')),true);
  assert.throws(()=>adapter.validateCall(buildSpecialistCall(operation('automation.tests.poll'),{run_id:'run-owned'})),{code:'RUN_NOT_OWNED'});
});

test('test summaries without strict proof do not pass or clear locally owned state',async()=>{
  const {adapter}=claireon((p)=>p.id==='automation.tests.run'?accepted():native({},'Tests completed successfully'));
  await run(adapter,'automation.tests.run',startTests);
  await assert.rejects(run(adapter,'automation.tests.poll',{run_id:'run-owned'}),{code:'SPECIALIST_OUTCOME_UNKNOWN'});
  assert.equal(adapter.ownedState().automationRun.runId,'run-owned');
});

test('strict failure clears ownership only with its native terminal failure marker',async()=>{
  const failure=native({strict_failure:'execution',failed:['Vehicle.Smoke.Input'],discovered_count:1,reported_count:1},'');
  const {adapter}=claireon((p)=>p.id==='automation.tests.run'?accepted():frameResult(p,failure,{ok:false,error:'Strict run FAILED'}));
  await run(adapter,'automation.tests.run',startTests);
  const result=await run(adapter,'automation.tests.poll',{run_id:'run-owned'});
  assert.equal(result.isError,true);
  assert.equal(result.structuredContent.phase,'failed');
  assert.deepEqual(result.structuredContent.native.data.failed,['Vehicle.Smoke.Input']);
  assert.equal(adapter.ownedState().automationRun,null);
});

test('explicit test cancellation is never reported as a passing run',async()=>{
  const {adapter}=claireon((p)=>p.id==='automation.tests.run'?accepted():terminal());
  await run(adapter,'automation.tests.run',startTests);
  const result=await run(adapter,'automation.tests.poll',{run_id:'run-owned',cancel:true});
  assert.equal(result.structuredContent.phase,'cancelled');
  assert.equal(result.structuredContent.ok,false);
  assert.equal(result.structuredContent.gateReleased,true);
});

test('capture requires local ownership and a matching confirmed stop receipt',async()=>{
  const path='C:/Project/Saved/Profiling/nexus_capture_001.utrace';
  const {adapter,calls}=claireon((p)=>p.id==='insights.capture.start'
    ?native({status:'recording',trace_file_path:path,channels:p.args.channels,stat_named_events:true})
    :native({status:'stopped',trace_file_path:path,stat_named_events:true}));
  assert.equal(await adapter.supports(operation('insights.capture.stop')),true);
  assert.throws(()=>adapter.validateCall(buildSpecialistCall(operation('insights.capture.stop'),{})),{code:'CAPTURE_NOT_OWNED'});
  assert.equal(calls.filter((c)=>!c.payload.probe).length,0);
  await run(adapter,'insights.capture.start',{filename:'nexus_capture_001',channels:'cpu,frame,bookmark'});
  assert.equal(adapter.ownedState().capturePath,path);
  const result=await run(adapter,'insights.capture.stop');
  assert.equal(result.structuredContent.phase,'stopped');
  assert.equal(adapter.ownedState().capturePath,null);
});

test('trace readback distinguishes legitimate bounded pages and unterminated frame nulls',async()=>{
  const path='C:/Project/Saved/Profiling/nexus_capture_001.utrace';
  const {adapter}=claireon((p)=>{
    if(p.id==='insights.trace.open')return native({session_id:'trace-owned',trace_file:path,frame_count:100,duration_ms:null,capture_manifest:{gpu:false}});
    if(p.id==='insights.trace.scopes')return native({session_id:'trace-owned',scopes:[{name:'Tick',total_ms:8,avg_ms:4,call_count:2}],
      truncated:true,total_scopes_before_truncation:20,gpu_timelines_present:false,gpu_event_count:0},'bounded page',['GPU absent']);
    if(p.id==='insights.trace.frames')return native({session_id:'trace-owned',frames:[
      {frame_index:0,duration_ms:16,game_thread_ms:16},
      {frame_index:1,duration_ms:null,game_thread_ms:null,unterminated:true}],avg_ms:16,min_ms:16,max_ms:16,unterminated_frames:1},'frames',['Frame 1 was open']);
    return native({session_id:'trace-owned',closed:true});
  });
  await run(adapter,'insights.trace.open',{filePath:path});
  const scopes=await run(adapter,'insights.trace.scopes');
  assert.equal(scopes.structuredContent.truncated,true);
  assert.deepEqual(scopes.structuredContent.native.warnings,['GPU absent']);
  const frames=await run(adapter,'insights.trace.frames');
  assert.equal(frames.structuredContent.aggregates_scope,'returned-page-only');
  assert.equal(frames.structuredContent.native.data.unterminated_frames,1);
  assert.equal(frames.structuredContent.native.data.frames[1].duration_ms,null);
  await run(adapter,'insights.trace.close');
  assert.deepEqual(adapter.ownedState().traceSessions,[]);
});

test('query ranges, owned sessions and exact result session IDs are enforced',async()=>{
  assert.throws(()=>buildSpecialistCall(operation('insights.trace.scopes'),{
    ...operation('insights.trace.scopes').example,startTime:20,endTime:1}),{code:'INVALID_ARGUMENTS'});
  const {adapter,calls}=claireon(()=>native());
  assert.equal(await adapter.supports(operation('insights.trace.close')),true);
  assert.throws(()=>adapter.validateCall(buildSpecialistCall(operation('insights.trace.close'),{sessionId:'someone-elses'})),{code:'TRACE_NOT_OWNED'});
  assert.equal(calls.filter((c)=>!c.payload.probe).length,0);
});

function hayba(handler,{tools=haybaTools()}={}) {
  const calls=[];
  const adapter=createSpecialistAdapter({provider:'hayba',tools,callTool:async(name,args,options)=>{
    calls.push({name,args,options});
    assert.equal(name,'material_set_param');assert.equal(args.nexus_retry_policy,'never');
    return handler(args);
  }});
  return {adapter,calls};
}
const materialReceipt=(args,extra={})=>({content:[{type:'text',text:JSON.stringify({
  param:args.param_name,value:typeof args.value==='number'?args.value:typeof args.value==='string'?args.value:'(R=0.2,G=0.3,B=0.4,A=1.0)',
  observed_value:typeof args.value==='number'?args.value:typeof args.value==='string'?args.value:'(R=0.2,G=0.3,B=0.4,A=1.0)',
  verified:true,saved:true,dirty:false,...extra})},{type:'text',text:'Native advisory: validate appearance in viewport.'}]});

test('unpatched/deferred Hayba is held; no meta invocation or automatic pack loading',async()=>{
  for(const tools of [
    [{name:'hayba_invoke',inputSchema:shape({tool:s,via:s})}],
    (()=>{const t=haybaTools();delete t[0].inputSchema.properties.nexus_retry_policy;return t;})(),
    (()=>{const t=haybaTools();t[0].inputSchema.required=t[0].inputSchema.required.filter((s)=>s!=='nexus_retry_policy');return t;})(),
  ]) {
    const {adapter,calls}=hayba(materialReceipt,{tools});
    assert.equal(await adapter.supports(operation('material.parameter.scalar.persisted')),false);
    assert.equal(calls.length,0);
  }
});

test('typed Hayba variants preserve real readback/save receipt and reject bool/static-switch route',async()=>{
  for(const variant of ['scalar','vector','texture']) {
    const {adapter,calls}=hayba(materialReceipt);
    const result=await run(adapter,'material.parameter.'+variant+'.persisted');
    assert.equal(result.structuredContent.phase,'persisted');
    assert.equal(result.structuredContent.verified,true);
    assert.equal(result.structuredContent.saved,true);
    assert.equal(calls.length,1);
    assert.equal(result.content.length,2);
  }
  const op=operation('material.parameter.scalar.persisted');
  assert.throws(()=>buildSpecialistCall(op,{...op.example,value:true}),{code:'INVALID_ARGUMENTS'});
  const vector=operation('material.parameter.vector.persisted');
  assert.throws(()=>buildSpecialistCall(vector,{...vector.example,value:[1,2]}),{code:'INVALID_ARGUMENTS'});
  assert.throws(()=>buildSpecialistCall(op,{...op.example,nexus_retry_policy:'always'}),{code:'INVALID_ARGUMENTS'});
});

test('material native Ok is insufficient when verified or saved is false',async()=>{
  for(const extra of [{saved:false,dirty:true,save_error:'read-only'}, {verified:false,warning:'readback mismatch'}]) {
    const {adapter}=hayba((args)=>materialReceipt(args,extra));
    const result=await run(adapter,'material.parameter.scalar.persisted');
    assert.equal(result.isError,true);
    assert.equal(result.structuredContent.ok,false);
    assert.deepEqual(result.structuredContent.native.save_error,extra.save_error);
  }
});

test('material malformed/error receipts remain uncertain; unknown errors are not retried',async()=>{
  for(const handler of [
    ()=>({content:[{type:'text',text:'{"ok":true}'}]}),
    (args)=>{const r=materialReceipt(args);r.isError=true;return r;},
    (args)=>{const r=materialReceipt(args);r.content.push({...r.content[0]});return r;},
  ]) {
    const {adapter,calls}=hayba(handler);
    await assert.rejects(run(adapter,'material.parameter.scalar.persisted'),{code:'SPECIALIST_OUTCOME_UNKNOWN'});
    assert.equal(calls.length,1);
  }
  const {adapter,calls}=hayba(()=>{throw new Error('reply lost after save');});
  await assert.rejects(run(adapter,'material.parameter.scalar.persisted'),/reply lost/);
  assert.equal(calls.length,1);
});

test('per-call cancellation is forwarded and adapter close never performs implicit native cleanup',async()=>{
  const {adapter,calls}=claireon(()=>accepted());
  const controller=new AbortController();
  const op=operation('automation.tests.run');
  assert.equal(await adapter.supports(op,{signal:controller.signal,timeoutMs:1234}),true);
  await adapter.call(buildSpecialistCall(op,startTests),2000,{signal:controller.signal});
  assert.equal(calls[0].options.timeoutMs,1234);
  assert.equal(calls[1].options.timeoutMs,2000);
  controller.abort();
  assert.equal(calls[0].options.signal.aborted,true);
  assert.equal(calls[1].options.signal.aborted,true);
  const before=calls.length;
  await adapter.close();
  assert.equal(calls.length,before);
  assert.equal(adapter.ownedState().automationRun.runId,'run-owned');
  await assert.rejects(adapter.supports(op),{code:'SPECIALIST_CLOSED'});
});

test('compatibility patch byte hashes and hardening markers match the reviewed manifest',async()=>{
  for(const patch of patches.patches.filter((p)=>['claireon','hayba'].includes(p.provider))) {
    const body=await readFile(new URL('../'+patch.file,import.meta.url));
    assert.equal(createHash('sha256').update(body).digest('hex'),patch.sha256);
    assert.equal(patch.files.length,patch.provider==='claireon'?1:3);
    assert.match(body.toString(),new RegExp(patch.capabilityMarker.parameter));
    assert.ok(patch.files.every((f)=>/^[a-f0-9]{64}$/.test(f.beforeSha256)&&/^[a-f0-9]{64}$/.test(f.afterSha256)));
    if(patch.provider==='claireon')assert.equal((body.toString().match(/\+\s*if \(!bNexusSkipAutoSave\)/g)??[]).length,2);
    if(patch.provider==='hayba')assert.match(body.toString(),/\+  'material_set_param',/);
  }
});

test('generated Python parses and invokes one fixed callable with safe JSON decoding', (t)=>{
  const availability=spawnSync('python3',['--version'],{encoding:'utf8',timeout:3000,killSignal:'SIGKILL'});
  if(availability.status!==0){t.skip('Python unavailable or subprocess launch restricted; Node framing tests still run.');return;}
  const op=operation('automation.tests.run');
  const args={...startTests,expected_tests:['Vehicle.Smoke.\"; __import__(\"os\").system(\"unexpected\") #']};
  const call=buildSpecialistCall(op,args);
  const harness=`import ast, sys, json, types, io, contextlib\npayload=json.loads(sys.argv[1])\nast.parse(payload['code'])\ncalls=[]\ndef test_run(**kwargs):\n calls.append(kwargs)\n return {'data': {}, 'summary': 'fixture', 'warnings': []}\nsys.modules['claireon']=types.SimpleNamespace(test_run=test_run)\nout=io.StringIO()\nwith contextlib.redirect_stdout(out):\n exec(payload['code'], {})\nprint(json.dumps({'calls':calls,'stdout':out.getvalue()}))\n`;
  const result=spawnSync('python3',['-c',harness,JSON.stringify(call.arguments)],{encoding:'utf8',timeout:3000,killSignal:'SIGKILL'});
  assert.equal(result.status,0,result.stderr);
  const parsed=JSON.parse(result.stdout);
  assert.equal(parsed.calls.length,1);
  assert.deepEqual(parsed.calls[0].expected_tests,args.expected_tests);
  assert.equal(parsed.calls[0].strict,true);
  assert.match(parsed.stdout,/^NEXUS_RESULT_[a-f0-9]+:[A-Za-z0-9+/=]+:END\n$/);
});
