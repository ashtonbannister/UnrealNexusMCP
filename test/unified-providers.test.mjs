import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport,DEFAULT_INHERITED_ENV_VARS} from '@modelcontextprotocol/client/stdio';
import {startHttpServer} from '../src/http-server.mjs';
import {createUnifiedFixtureRuntime} from './fixtures/unified-nexus.mjs';
import {providerTools,providerReceipt,providerResource,providerResourceTemplate,providerPrompt,
  providerElicitation} from './fixtures/unified-provider.mjs';

const frontDoor = fileURLToPath(new URL('./fixtures/unified-nexus.mjs',import.meta.url));
const options = {timeout:10000,maxTotalTimeout:10000,resetTimeoutOnProgress:false};
const providers = ['ue-mcp','enginewire'];
const call = (client,name,args={}) => client.request({method:'tools/call',params:{name,arguments:args}},options);
const list = async client => (await client.request({method:'tools/list',params:{}},options)).tools;
const namespaced = (provider,tool) => ({...tool,name:`${provider}__${tool.name}`});
const resourceUri = (provider,uri) => `unreal-nexus-provider://${provider}/${uri}`;

async function makeClient(transport, mode = 'legacy') {
  const client = new Client({name:'unified-nexus-integration',version:'1'},
    {versionNegotiation:{mode},inputRequired:{autoFulfill:false},capabilities:{elicitation:{form:{}}}});
  await client.connect(transport,options);
  return client;
}

async function stdioClient(t) {
  const transport = new StdioClientTransport({command:process.execPath,args:[frontDoor],
    env:Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key=>[key,undefined])),stderr:'pipe'});
  transport.stderr?.resume();
  const client = await makeClient(transport,'auto');
  t.after(()=>client.close());
  return client;
}

async function httpClient(t,configuration={}) {
  const runtime = await createUnifiedFixtureRuntime(configuration);
  const token = 'unified-integration-fixture-token-not-a-secret';
  const endpoint = await startHttpServer(runtime,{host:'127.0.0.1',port:0,token});
  let client;
  t.after(async()=>{await client?.close();await endpoint.close();});
  client = await makeClient(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${endpoint.address.port}/mcp`),{
    requestInit:{headers:{Authorization:`Bearer ${token}`}},
    reconnectionOptions:{maxRetries:0,initialReconnectionDelay:1000,maxReconnectionDelay:1000,reconnectionDelayGrowFactor:1},
  }),'auto');
  return {client,runtime};
}

test('one stdio Nexus registration exposes complete paginated provider contracts and reuses canonical connections',async t=>{
  const client = await stdioClient(t);
  const tools = await list(client);
  for (const provider of providers) {
    assert.deepEqual(tools.filter(tool=>tool.name.startsWith(`${provider}__`)),
      providerTools(provider).map(tool=>namespaced(provider,tool)));
  }
  assert.equal(new Set(tools.map(tool=>tool.name)).size,tools.length,'no colliding public names');
  assert.ok(tools.some(tool=>tool.name === 'actor.inspect.editor'),'existing canonical name is retained');

  const resources = (await client.request({method:'resources/list',params:{}},options)).resources;
  const templates = (await client.request({method:'resources/templates/list',params:{}},options)).resourceTemplates;
  const prompts = (await client.request({method:'prompts/list',params:{}},options)).prompts;
  for (const provider of providers) {
    const resource = providerResource(provider);
    const template = providerResourceTemplate(provider);
    const uri = resourceUri(provider,resource.uri);
    assert.deepEqual(resources.find(entry=>entry.uri === uri),{...resource,uri});
    assert.deepEqual(templates.find(entry=>entry.uriTemplate === resourceUri(provider,template.uriTemplate)),
      {...template,uriTemplate:resourceUri(provider,template.uriTemplate)});
    assert.deepEqual(prompts.find(entry=>entry.name === `${provider}__explain`),namespaced(provider,providerPrompt(provider)));
    assert.deepEqual(await client.request({method:'resources/read',params:{uri}},options),{
      contents:[{uri:resource.uri,mimeType:'text/plain',text:`${provider} native resource`}],
      _meta:{'fixture/source':provider},
    });
    assert.deepEqual(await client.request({method:'prompts/get',params:{name:`${provider}__explain`,arguments:{subject:'unchanged'}}},options),{
      description:`${provider} original prompt`,messages:[{role:'user',
        content:{type:'text',text:JSON.stringify({name:'explain',arguments:{subject:'unchanged'}})}}],
      _meta:{'fixture/source':provider},
    });
    assert.deepEqual(await client.request({method:'completion/complete',params:{
      ref:{type:'ref/prompt',name:`${provider}__explain`},argument:{name:'subject',value:'a'},
    }},options),{completion:{values:['alpha','beta'],total:2,hasMore:false},
      _meta:{'fixture/source':provider,'fixture/native-reference':{type:'ref/prompt',name:'explain'}}});
  }
  let resourceUpdated;
  const update = new Promise(resolve=>{resourceUpdated=resolve;});
  client.setNotificationHandler('notifications/resources/updated',notification=>resourceUpdated(notification.params.uri));
  const subscribedUri = resourceUri('enginewire','fixture://reference');
  await client.request({method:'resources/subscribe',params:{uri:subscribedUri}},options);
  let subscriptionTimer;
  try {
    assert.equal(await Promise.race([update,new Promise((_,reject)=>{
      subscriptionTimer=setTimeout(()=>reject(new Error('Provider resource update was not forwarded.')),2500);
    })]),subscribedUri);
  } finally {clearTimeout(subscriptionTimer);}
  await client.request({method:'resources/unsubscribe',params:{uri:subscribedUri}},options);

  const fullCalls = [
    ['ue-mcp','tools',{action:'call',category:'sequencer',method:'add_track',args:{assetPath:'/Game/Sequence',trackType:'Transform',newOption:null}}],
    ['enginewire','unreal',{operation:'execute',capability:'animation_physics.analyze_animation',params:{assetPath:'/Game/Walk'},options:{timeoutMs:321,newOption:false}}],
  ];
  for (const [provider,tool,args] of fullCalls) {
    assert.deepEqual(await call(client,`${provider}__${tool}`,args),providerReceipt(provider,tool,args));
    const echoArgs = {value:'same native tool name',nested:{list:[0,false,null,'']}};
    assert.deepEqual(await call(client,`${provider}__echo`,echoArgs),providerReceipt(provider,'echo',echoArgs));
  }
  const before = (await call(client,'ue-mcp__stats')).structuredContent;
  const canonical = await call(client,'actor.inspect.editor',{actorPath:'/Game/Map.Map:PersistentLevel.Actor'});
  assert.notEqual(canonical.isError,true);
  assert.equal(canonical._meta['unreal-nexus/receipt'].provider,'ue-mcp');
  const after = (await call(client,'ue-mcp__stats')).structuredContent;
  assert.equal(after.pid,before.pid,'canonical and native calls reuse one provider process');
  assert.equal(after.calls.tools,before.calls.tools+1);
  const status = (await call(client,'nexus.status')).structuredContent;
  assert.deepEqual(status.backends.map(entry=>[entry.provider,entry.state]).sort(),
    providers.map(provider=>[provider,'ready']).sort());
});

test('one HTTP Nexus entrypoint preserves provider results and protocol errors without retries',async t=>{
  const {client,runtime} = await httpClient(t,{canonical:false});
  const tools = await list(client);
  assert.equal(tools.filter(tool=>providers.some(provider=>tool.name.startsWith(`${provider}__`))).length,
    providers.reduce((count,provider)=>count+providerTools(provider).length,0),
    'provider exposure does not depend on canonical packs');
  const args = {value:null,zero:0,enabled:false,unicode:'Edmonton — 雪',nested:{array:[false,0,'']}};
  for (const provider of providers) {
    assert.deepEqual(await call(client,`${provider}__echo`,args),providerReceipt(provider,'echo',args));
    assert.deepEqual(await call(client,`${provider}__refusal`,args),providerReceipt(provider,'refusal',args));
  }
  await assert.rejects(call(client,'enginewire__reject_params',{value:'rejected'}),error=>{
    assert.equal(error.code,-32602);
    assert.match(error.message,/Provider rejected value\./);
    assert.deepEqual(error.data,{provider:'enginewire',field:'value',unchanged:true});
    return true;
  });
  const stats = (await call(client,'enginewire__stats')).structuredContent;
  assert.equal(stats.calls.reject_params,1,'one request, no mutation/error replay');
  assert.equal(runtime.status().queue.blocked,false,'received provider refusal is not a transport failure');
  assert.deepEqual(await call(client,'enginewire__echo',args),providerReceipt('enginewire','echo',args));
  for (const response of [{action:'accept',content:{approved:true,reason:'Fixture decision'}},{action:'decline'}]) {
    const request = providerElicitation('enginewire');
    client.setRequestHandler('elicitation/create',incoming=>{
      assert.deepEqual(incoming.params,request,'original elicitation schema, message and metadata reach the client');
      return response;
    });
    assert.deepEqual(await call(client,'enginewire__approval'),{
      content:[{type:'text',text:'Original provider elicitation receipt.'}],
      structuredContent:{request,response},_meta:{'fixture/elicitation':'enginewire'},
    });
  }
});

test('provider list-change notifications reveal newly enabled native tools through the same Nexus session',async t=>{
  const client = await stdioClient(t);
  const initial = await list(client);
  assert.ok(!initial.some(tool=>tool.name.endsWith('__newly_enabled')));
  let notify;
  const changed = new Promise(resolve=>{notify=resolve;});
  client.setNotificationHandler('notifications/tools/list_changed',()=>notify());
  await call(client,'ue-mcp__enable_tools');
  let timer;
  try {
    await Promise.race([changed,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Nexus did not forward provider tools/list_changed.')),2500);
    })]);
  } finally {clearTimeout(timer);}
  const updated = await list(client);
  assert.deepEqual(updated.find(tool=>tool.name === 'ue-mcp__newly_enabled'),
    namespaced('ue-mcp',providerTools('ue-mcp',true).at(-1)));
  assert.ok(!updated.some(tool=>tool.name === 'enginewire__newly_enabled'));
  const args = {value:'available immediately'};
  assert.deepEqual(await call(client,'ue-mcp__newly_enabled',args),providerReceipt('ue-mcp','newly_enabled',args));
});

test('read-only host policy retains complete discovery and refuses unclassified provider calls before dispatch',async t=>{
  const {client} = await httpClient(t,{allowWrites:false,canonical:false});
  const tools = await list(client);
  assert.ok(tools.some(tool=>tool.name === 'ue-mcp__tools'));
  const args = {value:'read-only echo'};
  assert.deepEqual(await call(client,'enginewire__echo',args),providerReceipt('enginewire','echo',args));
  const refused = await call(client,'ue-mcp__tools',{action:'call',category:'level',method:'place_actor',args:{}});
  assert.equal(refused.isError,true);
  assert.equal(refused.structuredContent.error,'WRITES_DISABLED');
  assert.equal((await call(client,'ue-mcp__stats')).structuredContent.calls.tools,undefined);
});
