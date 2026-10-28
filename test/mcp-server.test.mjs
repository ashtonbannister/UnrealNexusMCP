import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {request as httpRequest} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport,DEFAULT_INHERITED_ENV_VARS} from '@modelcontextprotocol/client/stdio';
import {startHttpServer} from '../src/http-server.mjs';
import {createMcpConnection} from '../src/transport-client.mjs';
import {MASTER_URI,ENABLED_GUIDANCE_URI,CATALOG_URI,STATUS_URI} from '../src/guidance.mjs';
import {createFixtureRuntime,FIXTURE_CAPABILITIES,FIXTURE_IMAGE} from './fixtures/nexus-server-runtime.mjs';

const fixturePath=fileURLToPath(new URL('./fixtures/nexus-server-stdio.mjs',import.meta.url));
const productionPath=fileURLToPath(new URL('../src/main.mjs',import.meta.url));
const productionConfig=fileURLToPath(new URL('../examples/config.example.json',import.meta.url));
const token='fixture-bearer-token-not-a-real-secret-123456789';
const controls=['nexus.status','nexus.describe','nexus.plan'];
const options={timeout:2500,maxTotalTimeout:2500,resetTimeoutOnProgress:false};
const call=(client,name,args={},extra={})=>client.request({method:'tools/call',
  params:{name,arguments:args}},{...options,...extra});
const toolError=(result,code)=>{
  assert.equal(result.isError,true);
  assert.equal(result.structuredContent.error,code);
};
async function makeClient(t,transport,mode='legacy') {
  const client=new Client({name:'nexus-front-door-test',version:'1'}, {
    versionNegotiation:{mode},inputRequired:{autoFulfill:false},capabilities:{},
  });
  t.after(()=>client.close());
  await client.connect(transport,options);
  return client;
}
async function stdioClient(t,mode='normal',writeMode='writes') {
  const transport=new StdioClientTransport({command:process.execPath,args:[fixturePath,mode,writeMode],
    env:Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key=>[key,undefined])),stderr:'pipe'});
  transport.stderr?.resume();
  return makeClient(t,transport);
}
async function httpFixture(t,configuration={}) {
  const runtime=await createFixtureRuntime(configuration);
  const endpoint=await startHttpServer(runtime,{host:'127.0.0.1',port:0,token});
  t.after(()=>endpoint.close());
  const url='http://127.0.0.1:'+endpoint.address.port+'/mcp';
  const client=(mode='legacy')=>makeClient(t,new StreamableHTTPClientTransport(new URL(url),{
    requestInit:{headers:{Authorization:'Bearer '+token}},
    reconnectionOptions:{maxRetries:0,initialReconnectionDelay:1000,maxReconnectionDelay:1000,reconnectionDelayGrowFactor:1},
  }),mode);
  return {runtime,endpoint,url,client};
}
async function waitUntil(predicate,timeoutMs=1200) {
  const deadline=performance.now()+timeoutMs;
  while(!predicate()) {
    assert.ok(performance.now()<deadline,'fixture state was not reached before deadline');
    await delay(10);
  }
}
async function raw(url,{method='POST',headers={},body=''}={}) {
  return new Promise((resolve,reject)=>{
    const req=httpRequest(url,{method,headers:{Authorization:'Bearer '+token,
      'content-type':'application/json',...headers}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });
    req.setTimeout(2500,()=>req.destroy(new Error('fixture HTTP deadline')));
    req.once('error',reject);req.end(body);
  });
}

test('production CLI loads the all-off example, serves guidance and shuts down without starting providers',async(t)=>{
  const transport=new StdioClientTransport({command:process.execPath,
    args:[productionPath,'--config',productionConfig],
    env:Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key=>[key,undefined])),stderr:'pipe'});
  transport.stderr?.resume();
  const client=await makeClient(t,transport);
  assert.equal(client.getServerVersion().name,'unreal-nexus');
  assert.deepEqual((await client.listTools({},options)).tools.map(tool=>tool.name),controls);
  assert.match((await client.readResource({uri:MASTER_URI},options)).contents[0].text,/Master skill guidance/);
  const status=(await call(client,'nexus.status')).structuredContent;
  assert.equal(status.allowWrites,false);
  assert.deepEqual(status.enabledCapabilities,[]);
  assert.deepEqual(status.requiredProviders,[]);
  assert.deepEqual(status.backends,[]);
  assert.deepEqual(status.sourceAndIdentityEvidence,{});
  let processClosed=false;
  client.onclose=()=>{processClosed=true;};
  await client.close();
  assert.equal(processClosed,true,'stdio EOF caused actual child-process closure');
});

test('canonical stdio discovery exposes bounded tools, resources and workflow without backend startup',async(t)=>{
  const client=await stdioClient(t);
  const tools=await client.listTools({},options);
  assert.deepEqual(tools.tools.map(tool=>tool.name),[...controls,...FIXTURE_CAPABILITIES]);
  assert.ok(tools.tools.every(tool=>tool.inputSchema.additionalProperties===false));
  assert.ok(!tools.tools.some(tool=>['tools','unreal','pie_start','execute_python'].includes(tool.name)));
  const resources=await client.listResources({},options);
  assert.deepEqual(resources.resources.map(resource=>resource.uri),[MASTER_URI,ENABLED_GUIDANCE_URI,CATALOG_URI,STATUS_URI]);
  const master=await client.readResource({uri:MASTER_URI},options);
  assert.match(master.contents[0].text,/Master skill guidance/);
  assert.match(master.contents[0].text,/Never.*bypass a refusal/s);
  const enabled=await client.readResource({uri:ENABLED_GUIDANCE_URI},options);
  assert.match(enabled.contents[0].text,/## 0\. Governing contract/);
  assert.match(enabled.contents[0].text,/## 2\. Confirmed PIE lifecycle/);
  assert.doesNotMatch(enabled.contents[0].text,/## 10\./);
  const catalog=await client.readResource({uri:CATALOG_URI},options);
  assert.deepEqual(JSON.parse(catalog.contents[0].text).map(op=>op.id),FIXTURE_CAPABILITIES);
  assert.deepEqual((await client.listResourceTemplates({},options)).resourceTemplates,[]);
  assert.deepEqual((await client.listPrompts({},options)).prompts.map(prompt=>prompt.name),['nexus_workflow']);
  const prompt=await client.getPrompt({name:'nexus_workflow',arguments:{capability:'pie.status'}},options);
  assert.match(prompt.messages[0].content.text,/"id": "pie.status"/);
  assert.match(prompt.messages[0].content.text,/## 0\. Governing contract/);
  const describe=await call(client,'nexus.describe',{id:'pie.status'});
  assert.equal(describe.structuredContent.provider,'unrealagentplayer');
  assert.match(describe.structuredContent.source.commit,/^[a-f0-9]{40}$/);
  const plan=await call(client,'nexus.plan',{id:'asset.save.exact',arguments:{assetPaths:['/Game/Exact']}});
  assert.equal(plan.structuredContent.dispatched,false);
  assert.deepEqual(plan.structuredContent.call.arguments.args.assetPaths,['/Game/Exact']);
  const status=await call(client,'nexus.status');
  assert.deepEqual(status.structuredContent.fixture.starts,[]);
  assert.deepEqual(status.structuredContent.fixture.calls,[]);
});

test('canonical stdio calls select only their provider and retain image, warnings and source receipt',async(t)=>{
  const client=await stdioClient(t);
  const pie=await call(client,'pie.status');
  assert.notEqual(pie.isError,true);
  assert.equal(pie._meta['unreal-nexus/receipt'].provider,'unrealagentplayer');
  let status=(await call(client,'nexus.status')).structuredContent;
  assert.deepEqual(status.fixture.starts,['unrealagentplayer']);
  const image=await call(client,'screenshot.viewport.current');
  assert.deepEqual(image.content,FIXTURE_IMAGE.content);
  assert.deepEqual(image.structuredContent,FIXTURE_IMAGE.structuredContent);
  assert.equal(image._meta['fixture/receipt'],'retained');
  assert.equal(image._meta['unreal-nexus/receipt'].outcome,'response_received');
  assert.notEqual((await call(client,'asset.save.exact',{assetPaths:['/Game/Exact']})).isError,true);
  status=(await call(client,'nexus.status')).structuredContent;
  assert.deepEqual(status.fixture.starts,['unrealagentplayer','enginewire','ue-mcp']);
  assert.equal(status.fixture.calls.length,3);
});

test('front door refuses raw/disabled/invalid tools and returns correct missing-resource protocol error',async(t)=>{
  const client=await stdioClient(t);
  toolError(await call(client,'unreal',{tool:'python'}),'OPERATION_NOT_EXPOSED');
  toolError(await call(client,'pie.stop'),'CAPABILITY_DISABLED');
  toolError(await call(client,'asset.save.exact',{assetPaths:['/Game/Exact'],saveAll:true}),'INVALID_ARGUMENTS');
  const status=(await call(client,'nexus.status')).structuredContent;
  assert.deepEqual(status.fixture.starts,[]);
  assert.equal(status.queue.blocked,false);
  const unknown='unreal-nexus://unknown/resource';
  await assert.rejects(client.readResource({uri:unknown},options),error=>{
    assert.equal(error.code,-32602);assert.deepEqual(error.data,{uri:unknown});return true;
  });
  await assert.rejects(client.getPrompt({name:'not-a-workflow'},options),{code:-32602});
  await assert.rejects(client.request({method:'tools/list',params:{cursor:'not-a-page'}},options),{code:-32602});
});

test('write authority is checked before a stdio backend starts',async(t)=>{
  const client=await stdioClient(t,'normal','read-only');
  toolError(await call(client,'asset.save.exact',{assetPaths:['/Game/Exact']}),'WRITES_DISABLED');
  assert.deepEqual((await call(client,'nexus.status')).structuredContent.fixture.starts,[]);
  assert.notEqual((await call(client,'pie.status')).isError,true);
});

test('authenticated HTTP serves the same canonical tools and workflow resources',async(t)=>{
  const f=await httpFixture(t);const client=await f.client();
  assert.deepEqual((await client.listTools({},options)).tools.map(tool=>tool.name),[...controls,...FIXTURE_CAPABILITIES]);
  assert.match((await client.readResource({uri:MASTER_URI},options)).contents[0].text,/Master skill guidance/);
  assert.match((await client.getPrompt({name:'nexus_workflow',arguments:{capability:'pie.status'}},options)).messages[0].content.text,/pie.status/);
  assert.deepEqual(f.runtime.state.starts,[]);
  assert.notEqual((await call(client,'pie.status')).isError,true);
  assert.deepEqual(f.runtime.state.starts,['unrealagentplayer']);
});

test('HTTP validates bearer, host/origin, path, content type and request-body cap before dispatch',async(t)=>{
  const f=await httpFixture(t);
  const cases=[
    [{headers:{Authorization:''}},401],
    [{headers:{Authorization:'Bearer wrong-token'}},401],
    [{headers:{Origin:'https://not-local.example'}},403],
    [{headers:{Host:'not-local.example'}},403],
    [{headers:{'content-type':'text/plain'},body:'not JSON'},415],
    [{body:JSON.stringify({padding:'x'.repeat(1024*1024)})},413],
  ];
  for(const [request,status] of cases) {
    const response=await raw(f.url,request);
    assert.equal(response.status,status);
    assert.ok(!response.text.includes(token));
  }
  assert.equal((await raw(f.url.replace('/mcp','/not-mcp'))).status,404);
  assert.deepEqual(f.runtime.state.starts,[]);
  assert.deepEqual(f.runtime.state.calls,[]);
});

test('HTTP rejects non-loopback exposure and weak tokens before listening',async()=>{
  const runtime=await createFixtureRuntime();
  try {
    await assert.rejects(startHttpServer(runtime,{host:'0.0.0.0',port:0,token}));
    await assert.rejects(startHttpServer(runtime,{host:'127.0.0.1',port:0,token:'short'}));
  } finally {await runtime.close();}
});

test('separate HTTP clients share one serialized editor queue and lazy backend instance',async(t)=>{
  const f=await httpFixture(t,{mode:'delay'});
  const a=await f.client(),b=await f.client();
  const results=await Promise.all([call(a,'pie.status'),call(b,'pie.status')]);
  assert.ok(results.every(result=>result.isError!==true));
  assert.equal(f.runtime.state.maxActive,1);
  assert.deepEqual(f.runtime.state.starts,['unrealagentplayer']);
  assert.equal(f.runtime.state.calls.length,2);
});

test('uncertain backend failure stays fenced across HTTP requests and hides private diagnostics',async(t)=>{
  const f=await httpFixture(t,{mode:'throw'});
  const a=await f.client(),b=await f.client();
  const first=await call(a,'pie.start.viewport');
  toolError(first,'EDITOR_OUTCOME_UNKNOWN');
  assert.ok(!JSON.stringify(first).includes('fixture-private-detail'));
  assert.equal((await call(b,'nexus.status')).structuredContent.queue.blocked,true);
  toolError(await call(b,'screenshot.viewport.current'),'EDITOR_OUTCOME_UNKNOWN');
  assert.equal(f.runtime.state.calls.length,1);
  assert.deepEqual(f.runtime.state.starts,['unrealagentplayer']);
});

test('a returned UE native timeout receipt fences later HTTP calls without losing its original machine block',async(t)=>{
  const f=await httpFixture(t,{mode:'native-timeout'});
  const a=await f.client(),b=await f.client();
  const first=await call(a,'asset.save.exact',{assetPaths:['/Game/Exact']});
  assert.equal(first.isError,true);
  assert.equal(first._meta['unreal-nexus/receipt'].outcome,'outcome_unknown');
  assert.equal(first.content[0].text,'Error [TASK_FAILED]: fixture native deadline');
  assert.deepEqual(JSON.parse(first.content[1].text.slice('MACHINE_ERROR='.length)),
    {code:'BRIDGE_TIMEOUT',outcome:'unknown',operationId:'fixture-native-42',method:'save_assets'});
  assert.equal((await call(b,'nexus.status')).structuredContent.queue.blocked,true);
  toolError(await call(b,'screenshot.viewport.current'),'EDITOR_OUTCOME_UNKNOWN');
  assert.equal(f.runtime.state.calls.length,1);
  assert.deepEqual(f.runtime.state.starts,['ue-mcp']);
});

test('modern HTTP cancellation reaches the backend and fences new requests without claiming rollback',async(t)=>{
  const f=await httpFixture(t,{mode:'late'});
  const a=await f.client({pin:'2026-07-28'}),b=await f.client();
  const controller=new AbortController();
  const pending=call(a,'pie.start.viewport',{}, {signal:controller.signal});
  const rejected=assert.rejects(pending);
  await waitUntil(()=>f.runtime.state.calls.length===1);
  controller.abort();await rejected;
  await waitUntil(()=>f.runtime.state.aborts===1 && f.runtime.gateway.status().queue.blocked);
  assert.equal((await call(b,'nexus.status')).structuredContent.queue.blocked,true);
  toolError(await call(b,'screenshot.viewport.current'),'EDITOR_OUTCOME_UNKNOWN');
  await waitUntil(()=>f.runtime.state.completed===1);
  assert.equal(f.runtime.state.calls.length,1,'a cancelled call is never replayed');
  assert.deepEqual(f.runtime.state.starts,['unrealagentplayer']);
});

test('closing the original legacy HTTP request reaches the backend and preserves the shared uncertainty fence',async(t)=>{
  const f=await httpFixture(t,{mode:'late'});
  // Legacy notifications/cancelled on a separate stateless request cannot find
  // the original request. Nexus's client additionally closes its transport.
  const a=await createMcpConnection({type:'streamable-http',url:f.url,
    headers:{Authorization:'Bearer '+token}},{timeoutMs:2500});
  t.after(()=>a.close().catch(()=>{}));
  const b=await f.client();
  const controller=new AbortController();
  const pending=a.callTool('pie.start.viewport',{}, {signal:controller.signal});
  const rejected=assert.rejects(pending,{code:'BACKEND_CANCELLED'});
  await waitUntil(()=>f.runtime.state.calls.length===1);
  controller.abort();await rejected;
  await waitUntil(()=>f.runtime.state.aborts===1 && f.runtime.gateway.status().queue.blocked);
  assert.equal((await call(b,'nexus.status')).structuredContent.queue.blocked,true);
  toolError(await call(b,'screenshot.viewport.current'),'EDITOR_OUTCOME_UNKNOWN');
  await waitUntil(()=>f.runtime.state.completed===1);
  assert.equal(f.runtime.state.calls.length,1);
});
