import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createMcpConnection} from '../src/transport-client.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/transport-stdio.mjs',import.meta.url));
const stdio = (mode = 'normal',more = {}) => ({type:'stdio',command:process.execPath,
  args:[fixturePath,mode],...more});
const expected = (args,calls = 1) => ({
  content:[{type:'text',text:'fixture receipt'},
    {type:'image',data:'AA==',mimeType:'image/png'},
    {type:'audio',data:'AA==',mimeType:'audio/wav'},
    {type:'resource',resource:{uri:'fixture://receipt',mimeType:'text/plain',text:'retained'}}],
  structuredContent:{arguments:args,calls},_meta:{'fixture/receipt':'unchanged'},
});
const connect = async (t,config,options = {}) => {
  const connection = await createMcpConnection(config,{timeoutMs:2000,...options});
  t.after(()=>connection.close().catch(()=>{}));
  return connection;
};

test('stdio connects once, pages tools and preserves complete multimodal tool results',async(t)=>{
  const c=await connect(t,stdio());
  assert.equal(c.serverInfo.name,'nexus-protocol-fixture');
  assert.ok(Number.isInteger(c.pid));
  assert.deepEqual(c.capabilities,{tools:{}});
  assert.deepEqual((await c.listTools()).map((tool)=>tool.name),['echo','refusal']);
  assert.deepEqual(await c.callTool('echo',{number:42}),expected({number:42}));
  assert.deepEqual(await c.callTool('refusal',{}),{...expected({},2),isError:true});
  assert.equal(c.closed,false,'a normal tool-level refusal is still a received result');
  await c.close();
  await c.close();
  assert.equal(c.closed,true);
  await assert.rejects(c.callTool('echo',{}),{code:'BACKEND_CLOSED'});
});

test('stdio explicitly controls inheritance instead of spreading process.env or SDK defaults',async(t)=>{
  const key='NEXUS_TRANSPORT_TEST_PARENT';
  const before=process.env[key];
  process.env[key]='known-test-sentinel';
  t.after(()=>{ if(before===undefined) delete process.env[key]; else process.env[key]=before; });
  const isolated=await connect(t,stdio('normal',{env:{NEXUS_TRANSPORT_TEST_EXPLICIT:'given'}}));
  const keys=[key,'NEXUS_TRANSPORT_TEST_EXPLICIT','HOME','PATH'];
  const out=await isolated.callTool('env',{keys});
  assert.deepEqual(JSON.parse(out.content[0].text),{NEXUS_TRANSPORT_TEST_EXPLICIT:'given'});
  const inherited=await connect(t,stdio('normal',{inheritEnv:[key],env:{NEXUS_TRANSPORT_TEST_EXPLICIT:'given'}}));
  const withOptIn=await inherited.callTool('env',{keys});
  assert.deepEqual(JSON.parse(withOptIn.content[0].text),{
    [key]:'known-test-sentinel',NEXUS_TRANSPORT_TEST_EXPLICIT:'given',
  });
});

test('listTools refuses duplicate names, cycling cursors and page/tool caps',async(t)=>{
  for (const [mode,options,code] of [
    ['duplicate-tools',{},'BACKEND_DUPLICATE_TOOL'],
    ['cursor-cycle',{},'BACKEND_CURSOR_CYCLE'],
    ['empty-cursor',{},'BACKEND_CURSOR_CYCLE'],
    ['too-many-pages',{maxPages:3},'BACKEND_PAGE_LIMIT'],
    ['normal',{maxTools:1},'BACKEND_TOOL_LIMIT'],
  ]) {
    const c=await connect(t,stdio(mode));
    await assert.rejects(c.listTools(options),{code});
    assert.equal(c.closed,true);
  }
});

test('startup has an independent bound and pre-aborted startup never spawns',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(createMcpConnection(stdio(),{signal:controller.signal}),{code:'BACKEND_CANCELLED'});
  const started=performance.now();
  await assert.rejects(createMcpConnection(stdio('hang-initialize'),{
    timeoutMs:1000,startupTimeoutMs:150,
  }),{code:'BACKEND_TIMEOUT'});
  assert.ok(performance.now()-started<1000);
});

test('request cancellation invalidates connection and does not claim editor rollback',async(t)=>{
  const c=await connect(t,stdio());
  const controller=new AbortController();
  const request=c.callTool('delayed',{delayMs:200},{signal:controller.signal});
  setTimeout(()=>controller.abort(),25);
  await assert.rejects(request,{code:'BACKEND_CANCELLED'});
  assert.equal(c.closed,true);
  await assert.rejects(c.callTool('echo',{}));
});

test('pre-aborted request is not sent and leaves healthy connection usable',async(t)=>{
  const c=await connect(t,stdio());
  const controller=new AbortController();controller.abort();
  await assert.rejects(c.callTool('echo',{}, {signal:controller.signal}),{code:'BACKEND_CANCELLED'});
  assert.equal(c.closed,false);
  assert.deepEqual(await c.callTool('echo',{}),expected({},1));
});

test('close is bounded and reports incomplete cleanup instead of claiming success',async(t)=>{
  const c=await connect(t,stdio('linger-on-close'),{closeTimeoutMs:30});
  const started=performance.now();
  await assert.rejects(c.close(),{code:'BACKEND_CLOSE_TIMEOUT'});
  assert.ok(performance.now()-started<200);
  assert.equal(c.closed,true);
});

test('invalid configuration is refused before transport starts',async()=>{
  for (const config of [null,{}, {type:'automatic'},stdio('normal',{env:{BAD:5}}),
    stdio('normal',{inheritEnv:['BAD=VALUE']}),{type:'streamable-http',url:'file:///tmp/test'},
    {type:'streamable-http',url:'http://name:secret@127.0.0.1/mcp'},
    {type:'sse',url:'http://127.0.0.1/mcp#fragment'}]) {
    await assert.rejects(createMcpConnection(config),{code:'INVALID_TRANSPORT_CONFIGURATION'});
  }
  for (const options of [{timeoutMs:0},{startupTimeoutMs:Infinity},{closeTimeoutMs:0},{signal:{}}]) {
    await assert.rejects(createMcpConnection(stdio(),options),{code:'INVALID_TRANSPORT_CONFIGURATION'});
  }
});

// Minimal actual MCP wire server. HTTP counters let tests distinguish a late
// editor-like side effect from a timeout or retries; no SDK mocks are involved.
async function httpFixture(t,{legacy = false,dropBackground = false} = {}) {
  const state={posts:0,gets:0,calls:0,completed:0,cancellations:0,redirected:0,headers:[],streams:new Set()};
  let legacyStream;
  const server=createServer(async(req,res)=>{
    if (req.method==='GET') {
      state.gets++;
      if (!legacy && !dropBackground) { res.writeHead(405);res.end();return; }
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});
      state.streams.add(res);res.on('close',()=>state.streams.delete(res));
      if (legacy) { legacyStream=res;res.write('retry: 1\nevent: endpoint\ndata: /messages\n\n'); }
      else { res.write('retry: 1\n\n');setTimeout(()=>res.end(),20); }
      return;
    }
    if(req.url==='/redirect-target') { state.redirected++;res.writeHead(500);res.end();return; }
    if(req.method==='DELETE') { res.writeHead(405);res.end();return; }
    state.posts++;
    state.headers.push(req.headers.authorization);
    let text='';for await(const chunk of req) text+=chunk;
    const message=JSON.parse(text);
    if (!('id' in message)) {
      if(message.method==='notifications/cancelled') state.cancellations++;
      res.writeHead(202);res.end();return;
    }
    const send=(result)=>{
      const reply=JSON.stringify({jsonrpc:'2.0',id:message.id,result});
      if(legacy) {
        res.writeHead(202);res.end();
        if(!legacyStream.destroyed) legacyStream.write('event: message\ndata: '+reply+'\n\n');
      } else if(!res.destroyed) {
        res.writeHead(200,{'content-type':'application/json','mcp-session-id':'fixture-session'});res.end(reply);
      }
    };
    if(message.method==='initialize') {
      send({protocolVersion:message.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'http-fixture',version:'1'}});
    } else if(message.method==='tools/list') {
      send({tools:[{name:'fixture',inputSchema:{type:'object'}}]});
    } else if(message.method==='tools/call') {
      state.calls++;
      const name=message.params.name;
      if(name==='fail-http') { res.writeHead(500);res.end('known-server-test-secret');return; }
      if(name==='unauthorized') { res.writeHead(401);res.end();return; }
      if(name==='redirect') { res.writeHead(307,{location:'/redirect-target'});res.end();return; }
      if(name==='drop-sse') {
        res.writeHead(200,{'content-type':'text/event-stream'});
        res.end('id: receipt-for-unsafe-resume\nretry: 1\n\n');return;
      }
      if(name==='drop-legacy') {
        res.writeHead(202);res.end();legacyStream.end();return;
      }
      if(name==='delayed') {
        setTimeout(()=>{ state.completed++;send(expected(message.params.arguments,state.calls)); },100);
      } else { state.completed++;send(expected(message.params.arguments,state.calls)); }
    } else { res.writeHead(400);res.end(); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(async()=>{
    for (const stream of state.streams) stream.destroy();
    server.closeAllConnections();
    await new Promise((resolve)=>server.close(resolve));
  });
  return {state,url:'http://127.0.0.1:'+server.address().port+(legacy?'/sse':'/mcp')};
}

test('Streamable HTTP sends explicit headers and preserves full result',async(t)=>{
  const f=await httpFixture(t);
  const c=await connect(t,{type:'streamable-http',url:f.url,headers:{Authorization:'Bearer known-test-token'}});
  assert.deepEqual((await c.listTools()).map((tool)=>tool.name),['fixture']);
  assert.deepEqual(await c.callTool('fixture',{a:1}),expected({a:1}));
  assert.ok(f.state.headers.every((value)=>value==='Bearer known-test-token'));
  assert.equal(f.state.calls,1);
});

test('Streamable HTTP never retries 401, 500 or redirects and errors do not echo secrets',async(t)=>{
  for(const name of ['fail-http','unauthorized','redirect']) {
    const f=await httpFixture(t);
    const c=await connect(t,{type:'streamable-http',url:f.url});
    await assert.rejects(c.callTool(name,{}),(error)=>{
      assert.ok(!String(error).includes('known-server-test-secret'));
      assert.match(error.code,/^BACKEND_/);return true;
    });
    await delay(30);
    assert.equal(f.state.calls,1);
    assert.equal(f.state.redirected,0);
    assert.equal(c.closed,true);
  }
});

test('HTTP timeout can finish late but never replays or reopens the connection',async(t)=>{
  const f=await httpFixture(t);
  const c=await connect(t,{type:'streamable-http',url:f.url});
  await assert.rejects(c.callTool('delayed',{},{timeoutMs:30}),{code:'BACKEND_TIMEOUT'});
  await delay(130);
  assert.equal(f.state.calls,1);
  assert.equal(f.state.completed,1,'simulated backend work is not rolled back by client timeout');
  assert.equal(c.closed,true);
  await assert.rejects(c.callTool('fixture',{}));
  assert.equal(f.state.calls,1);
});

test('Streamable HTTP does not resume a dropped POST SSE response',async(t)=>{
  const f=await httpFixture(t);
  const c=await connect(t,{type:'streamable-http',url:f.url});
  await assert.rejects(c.callTool('drop-sse',{}));
  await delay(40);
  assert.equal(f.state.calls,1);
  assert.equal(f.state.gets,1,'only the initial optional notification GET, no resume');
  assert.equal(c.closed,true);
});

test('Streamable HTTP does not reconnect a closed background stream',async(t)=>{
  const f=await httpFixture(t,{dropBackground:true});
  const c=await connect(t,{type:'streamable-http',url:f.url});
  await delay(100);
  assert.equal(f.state.gets,1);
  assert.equal(c.closed,true);
});

test('legacy SSE is explicit, works, and does not automatically reconnect',async(t)=>{
  const f=await httpFixture(t,{legacy:true});
  const c=await connect(t,{type:'sse',url:f.url});
  assert.deepEqual(await c.callTool('fixture',{}),expected({}));
  await assert.rejects(c.callTool('drop-legacy',{}));
  await delay(60);
  assert.equal(f.state.gets,1);
  assert.equal(f.state.calls,2);
  assert.equal(c.closed,true);
});
