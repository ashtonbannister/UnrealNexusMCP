import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {parseConfig} from '../src/config.mjs';
import {createRuntime} from '../src/runtime.mjs';
import {loadCatalog} from '../src/catalog.mjs';
import {loadGuidance} from '../src/guidance.mjs';

const base=()=>({version:1});
const stdio=()=>({type:'stdio',command:'node',args:['--flag','','--flag']});
const backend=(transport=stdio())=>({sourceRoot:'/reviewed/source',transport});
const target={projectRoot:'/projects/Demo/Demo.uproject',processId:1234};
const catalog=loadCatalog();
const coreConfig=()=>parseConfig({version:1,target,allowWrites:true,
  enabledCapabilities:['actor.inspect.editor','screenshot.viewport.current'],
  backends:{'ue-mcp':backend(),'enginewire':backend({type:'streamable-http',url:'http://127.0.0.1:8001/mcp'})}});
const json=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
function fixture(overrides={}) {
  const events=[];
  const adapters={
    processInspector:async pid=>{events.push(['process',pid]);return {editorInstanceId:'linux-boot:1234:epoch'};},
    resolvePath:async p=>path.resolve(p),
    sourceVerifier:async(provider,config,source)=>{events.push(['source',provider]);return {commit:source.commit,compatibilityPatch:config.compatibilityPatch??null};},
    connect:async transport=>{
      events.push(['connect',transport.type]);
      return {listTools:async()=>[{name:transport.type==='stdio'?'tools':'unreal',inputSchema:{type:'object'}}],
        callTool:async(name,args,options)=>{
          events.push(['call',name,args,options]);
          return name==='unreal'?{content:[{type:'image',mimeType:'image/png',data:'AAAA'}]}:json({success:true});
        },close:async()=>{events.push(['close',transport.type]);}};
    },
    probeFactory:({target,provider})=>({
      attestIdentity:async()=>{events.push(['identity',provider]);return {identityVerified:true,target,evidence:{proof:'test fixture'}};},
      supports:async op=>{events.push(['supports',op.id]);return true;},
    }),
    ...overrides,
  };
  return {events,adapters};
}

test('configuration defaults deny dispatch and keep server/backends dormant',()=>{
  const cfg=parseConfig(base());
  assert.deepEqual(cfg.enabledPacks,[]);assert.deepEqual(cfg.enabledCapabilities,[]);
  assert.equal(cfg.allowWrites,false);assert.equal(cfg.target,null);assert.deepEqual(cfg.server,{transport:'stdio'});
});
test('configuration resolves project/source paths against its file and retains positional empty/repeated args',()=>{
  const cfg=parseConfig({version:1,target:{projectRoot:'Demo.uproject',processId:4},backends:{'ue-mcp':{sourceRoot:'vendor/ue',transport:stdio()}}},{baseDir:'/host/config'});
  assert.equal(cfg.target.projectRoot,path.resolve('/host/config/Demo.uproject'));
  assert.equal(cfg.backends['ue-mcp'].sourceRoot,path.resolve('/host/config/vendor/ue'));
  assert.deepEqual(cfg.backends['ue-mcp'].transport.args,['--flag','','--flag']);
});
test('configuration refuses public listener, missing token, unknown fields and mixed transports',()=>{
  for(const input of [
    {...base(),server:{transport:'http',host:'0.0.0.0',tokenEnv:'NEXUS_TOKEN'}},
    {...base(),server:{transport:'http',tokenEnv:'MISSING'}},
    {...base(),server:{transport:'stdio',port:7000}},
    {...base(),automaticFailover:true},
    {...base(),backends:{'ue-mcp':backend({...stdio(),url:'http://localhost'})}},
    {...base(),target:{projectRoot:'/project',processId:1234}},
  ]) assert.throws(()=>parseConfig(input,{env:{NEXUS_TOKEN:'x'.repeat(40)}}),{code:'INVALID_CONFIGURATION'});
});
test('HTTP credential sources reject ambiguous, reserved and injected headers',()=>{
  const t={type:'streamable-http',url:'http://127.0.0.1:8000/mcp'};
  for(const extra of [
    {headerEnv:[]}, {headers:{'Mcp-Session-Id':'invented'}}, {headers:{X:'bad\r\ninjected: yes'}},
    {headers:{Authorization:'value'},bearerTokenEnv:'TOKEN'},
    {headers:{X:'one'},headerEnv:{x:'TOKEN'}},
  ]) assert.throws(()=>parseConfig({version:1,backends:{'ue-mcp':backend({...t,...extra})}},{env:{TOKEN:'secret'}}),{code:'INVALID_CONFIGURATION'});
  const cfg=parseConfig({version:1,backends:{'ue-mcp':backend({...t,bearerTokenEnv:'TOKEN'})}},{env:{TOKEN:'private-value'}});
  assert.equal(cfg.backends['ue-mcp'].transport.headers.Authorization,'Bearer private-value');
});
test('every enabled canonical operation maps to the correct complete master workflow',async()=>{
  const guidance=await loadGuidance();
  assert.equal(guidance.sections.size,17);
  for(const op of catalog.list()) {
    const selected=guidance.forOperations([op]);
    assert.match(selected,/## 0\./);assert.match(selected,/## 16\./);
    if(op.provider==='claireon') assert.ok(selected.includes(op.decision==='blueprint-compile-memory'?'## 9.':op.decision==='automation-tests'?'## 11.':'## 12.'));
  }
  assert.match(guidance.sha256,/^[a-f0-9]{64}$/);
});
test('runtime starts only a used winning backend and rechecks capability before every call',async()=>{
  const {events,adapters}=fixture();const runtime=await createRuntime(coreConfig(),adapters);
  assert.deepEqual(events,[['process',1234]]);
  runtime.gateway.list();runtime.gateway.describe('actor.inspect.editor');runtime.gateway.plan('actor.inspect.editor',{actorPath:'/Game/Map.Map:PersistentLevel.Actor'});
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
  for(let i=0;i<2;i++)await runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/Map.Map:PersistentLevel.Actor'});
  assert.equal(events.filter(e=>e[0]==='connect').length,1);
  assert.equal(events.filter(e=>e[0]==='source').length,1);
  assert.equal(events.filter(e=>e[0]==='supports').length,2);
  assert.deepEqual(Object.keys(runtime.status().sourceAndIdentityEvidence),['ue-mcp']);
  assert.doesNotMatch(JSON.stringify(runtime.status()),/private-value|Authorization/);
  await runtime.close();assert.equal(events.filter(e=>e[0]==='close').length,1);
});
test('source or identity failure refuses before a canonical call and closes opened connections',async()=>{
  for(const stage of ['source','identity']) {
    const {events,adapters}=fixture(stage==='source'?{sourceVerifier:async()=>{throw new Error('wrong pin');}}
      :{probeFactory:()=>({attestIdentity:async()=>({identityVerified:false,target:{}})})});
    const runtime=await createRuntime(coreConfig(),adapters);
    await assert.rejects(runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/A'}));
    assert.equal(events.filter(e=>e[0]==='call').length,0);
    assert.equal(events.filter(e=>e[0]==='close').length,stage==='source'?0:1);
    assert.equal(runtime.gateway.status().queue.blocked,false);await runtime.close();
  }
});
test('stale OS process epoch refuses startup; absent target refuses before source or network work',async()=>{
  const {events,adapters}=fixture();const cfg=coreConfig();cfg.target.editorInstanceId='old-epoch';
  await assert.rejects(createRuntime(cfg,adapters),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
  cfg.target=null;const runtime=await createRuntime(cfg,adapters);
  await assert.rejects(runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/A'}),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
  assert.equal(events.filter(e=>e[0]==='source').length,0);await runtime.close();
});
test('specialists require exact declared compatibility and Hayba fixed launch port before any backend starts',async()=>{
  const {events,adapters}=fixture();
  const cfg=parseConfig({version:1,target,enabledPacks:['material-strict'],backends:{hayba:backend()}});
  await assert.rejects(createRuntime(cfg,adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
  cfg.backends.hayba.compatibilityPatch='hayba-nexus-no-retry-v1';
  await assert.rejects(createRuntime(cfg,adapters),{code:'BACKEND_BINDING_REQUIRED'});
  assert.equal(events.length,0);
});
test('UAP native bindings derive from the attested target and explicit RC port, overriding stale launch env',async()=>{
  const cfg=parseConfig({version:1,target,enabledCapabilities:['pie.status'],backends:{unrealagentplayer:{
    ...backend({...stdio(),env:{NEXUS_UAP_EDITOR_PID:'999',NEXUS_UAP_PROJECT_FILE:'/wrong.uproject',NEXUS_UAP_RC_PORT:'123'}}),
    compatibilityPatch:'uap-nexus-no-replay-v1',rcEndpoint:'http://127.0.0.1:30011',
  }}});
  let launch;
  const {adapters}=fixture({connect:async transport=>{
    launch=transport;
    return {listTools:async()=>[{name:'pie_status',inputSchema:{type:'object'}}],
      callTool:async()=>json({ok:true,phase:'NotPlaying'}),close:async()=>{}};
  }});
  const runtime=await createRuntime(cfg,adapters);assert.equal(launch,undefined);
  await runtime.gateway.execute('pie.status');
  assert.equal(launch.env.NEXUS_UAP_PROJECT_FILE,target.projectRoot);
  assert.equal(launch.env.NEXUS_UAP_EDITOR_PID,'1234');
  assert.equal(launch.env.NEXUS_UAP_RC_PORT,'30011');
  assert.equal(launch.env.PYTHONPATH,path.resolve('/reviewed/source/mcp-server/src'));
  await runtime.close();
  cfg.backends.unrealagentplayer.rcEndpoint='http://example.invalid:30011';
  await assert.rejects(createRuntime(cfg,adapters),{code:'BACKEND_BINDING_REQUIRED'});
});
