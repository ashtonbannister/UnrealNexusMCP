import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {parseConfig} from '../src/config.mjs';
import {createRuntime, createUapBindingEnv} from '../src/runtime.mjs';
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
const levelReceipt=()=>({success:true,levelName:'Demo',levelPath:'/Game/Demo.Demo',levelPackage:'/Game/Demo',nexusGuardVersion:1,expectedLevelPackage:'/Game/Demo',externalDeletionAllowed:false,usesExternalActors:false,externalPackagesLoaded:0,landscapesMerged:0,savedCount:0,failedCount:0,skippedCount:1,deletedCount:0,saved:[],skipped:[{package:'/Game/Demo',saved:false,skipped:true}]});
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
          if(name==='unreal') return {content:[{type:'image',mimeType:'image/png',data:'AAAA'}]};
          if(args.category==='level' && args.method==='get_actor_details') {
            return json({success:true,actorPath:args.args.actorPath,path:args.args.actorPath});
          }
          return json(args.category==='level' && args.method==='save' ? levelReceipt() : {success:true});
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
  assert.equal(cfg.allowWrites,false);assert.equal(cfg.allowLevelExternalPackageDeletion,false);assert.equal(cfg.target,null);assert.deepEqual(cfg.server,{transport:'stdio'});
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
    {...base(),allowLevelExternalPackageDeletion:'true'},
    {...base(),allowPieScreenshotOverwrite:true},
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
test('queued-aware status requires v3 before any provider starts',async()=>{
  const {events,adapters}=fixture();
  const raw={version:1,target,enabledCapabilities:['pie.status'],backends:{unrealagentplayer:{
    ...backend(),compatibilityPatch:'uap-nexus-strict-status-v2',rcEndpoint:'http://127.0.0.1:30011',
  }}};
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
  raw.backends.unrealagentplayer.compatibilityPatch='uap-nexus-queued-status-v3';
  const runtime=await createRuntime(parseConfig(raw),adapters);
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
  await runtime.close();
  raw.backends.unrealagentplayer.compatibilityPatch='unreviewed-v3';
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
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
  cfg.backends.hayba.compatibilityPatch='hayba-nexus-material-receipt-v2';
  await assert.rejects(createRuntime(cfg,adapters),{code:'BACKEND_BINDING_REQUIRED'});
  assert.equal(events.length,0);
});
test('UAP native bindings derive from the attested target and explicit RC port, overriding stale launch env',async()=>{
  const cfg=parseConfig({version:1,target,allowWrites:true,enabledCapabilities:['pie.start.viewport'],backends:{unrealagentplayer:{
    ...backend({...stdio(),env:{NEXUS_UAP_EDITOR_PID:'999',NEXUS_UAP_PROJECT_FILE:'/wrong.uproject',NEXUS_UAP_RC_PORT:'123'}}),
    compatibilityPatch:'uap-nexus-owned-pie-v4',rcEndpoint:'http://127.0.0.1:30011',
  }}});
  let launch;
  const {adapters}=fixture({connect:async transport=>{
    launch=transport;
    return {listTools:async()=>[{name:'pie_start',inputSchema:{type:'object'}}],
      callTool:async()=>json({ok:true,phase:'Playing',playing:true,editorEpoch:'a'.repeat(32),sessionId:'b'.repeat(32)}),close:async()=>{}};
  }});
  const runtime=await createRuntime(cfg,adapters);assert.equal(launch,undefined);
  assert.notEqual((await runtime.gateway.execute('pie.start.viewport')).isError,true);
  assert.ok(launch,'the selected provider is launched lazily');
  const env=createUapBindingEnv({existingEnv:cfg.backends.unrealagentplayer.transport.env,
    target:{...target,projectRoot:path.resolve(target.projectRoot)},
    rcEndpoint:cfg.backends.unrealagentplayer.rcEndpoint,sourceRoot:path.resolve('/reviewed/source')});
  assert.equal(env.NEXUS_UAP_PROJECT_FILE,path.resolve(target.projectRoot));
  assert.equal(env.NEXUS_UAP_EDITOR_PID,'1234');
  assert.equal(env.NEXUS_UAP_RC_PORT,'30011');
  assert.equal(env.PYTHONPATH,path.resolve('/reviewed/source/mcp-server/src'));
  await runtime.close();
  cfg.backends.unrealagentplayer.rcEndpoint='http://example.invalid:30011';
  await assert.rejects(createRuntime(cfg,adapters),{code:'BACKEND_BINDING_REQUIRED'});
});


test('identity refusal preserves its code and exposes unconfirmed startup cleanup',async()=>{
  let calls=0, closes=0;
  const {adapters}=fixture({
    connect:async()=>({listTools:async()=>[{name:'tools'}],callTool:async()=>{calls++;},
      close:async()=>{closes++;throw new Error('private cleanup detail');}}),
    probeFactory:()=>({attestIdentity:async()=>({identityVerified:false,target:{}})}),
  });
  const runtime=await createRuntime(coreConfig(),adapters);
  await assert.rejects(runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/A'}),{code:'BACKEND_ATTESTATION_FAILED'});
  assert.equal(calls,0);assert.equal(closes,1);
  assert.deepEqual(runtime.status().backends,[{provider:'ue-mcp',state:'failed',cleanup:'unconfirmed'}]);
  await assert.rejects(runtime.close(),{code:'BACKEND_CLEANUP_INCOMPLETE'});
});


test('guarded level save requires its reviewed patch, not a deletion grant',async()=>{
  const {events,adapters}=fixture();
  const raw={version:1,target,allowWrites:true,enabledCapabilities:['level.save.current'],backends:{'ue-mcp':backend()}};
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
  raw.backends['ue-mcp'].compatibilityPatch='ue-mcp-nexus-guarded-save-v2';
  const runtime=await createRuntime(parseConfig(raw),adapters);
  assert.notEqual((await runtime.gateway.execute('level.save.current',{expectedLevelPackage:'/Game/Demo'})).isError,true);
  assert.equal(runtime.status().allowLevelExternalPackageDeletion,false);
  assert.equal(events.filter(e=>e[0]==='call').length,1);await runtime.close();
});


test('PIE direct capture requires the exact compatibility patch',async()=>{
  const {events,adapters}=fixture();
  const raw={version:1,target,enabledCapabilities:['screenshot.pie'],backends:{'ue-mcp':backend()}};
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
  assert.throws(()=>parseConfig({...raw,allowPieScreenshotOverwrite:true}),{code:'INVALID_CONFIGURATION'});
});


test('owned patch satisfies both status and lifecycle requirements',async()=>{
  const {adapters}=fixture();
  const raw={version:1,target,enabledCapabilities:['pie.status','pie.start.viewport'],backends:{unrealagentplayer:{
    ...backend(),compatibilityPatch:'uap-nexus-owned-pie-v4',rcEndpoint:'http://127.0.0.1:30011',
  }}};
  const runtime=await createRuntime(parseConfig(raw),adapters);
  await runtime.close();
  raw.backends.unrealagentplayer.compatibilityPatch='uap-nexus-queued-status-v3';
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
});


test('guarded save patch satisfies the existing pagination requirement',async()=>{
  const {adapters}=fixture();
  const raw={version:1,target,enabledCapabilities:['actor.list.editor','level.save.current'],backends:{'ue-mcp':{
    ...backend(),compatibilityPatch:'ue-mcp-nexus-guarded-save-v2',
  }}};
  const runtime=await createRuntime(parseConfig(raw),adapters);await runtime.close();
  raw.backends['ue-mcp'].compatibilityPatch='ue-mcp-nexus-pagination-count-v1';
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
});

test('direct PIE patch also satisfies guarded-save and pagination requirements',async()=>{
  const {adapters}=fixture();
  const raw={version:1,target,enabledCapabilities:['actor.list.editor','level.save.current','screenshot.pie'],backends:{'ue-mcp':{
    ...backend(),compatibilityPatch:'ue-mcp-nexus-direct-pie-v1',
  }}};
  const runtime=await createRuntime(parseConfig(raw),adapters);await runtime.close();
  raw.backends['ue-mcp'].compatibilityPatch='ue-mcp-nexus-guarded-save-v2';
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
});

test('owned-hold patch satisfies the earlier UE compatibility requirements',async()=>{
  const {adapters}=fixture();
  const raw={version:1,target,enabledCapabilities:['actor.list.editor','level.save.current','screenshot.pie','input.action.hold.start'],
    backends:{'ue-mcp':{...backend(),compatibilityPatch:'ue-mcp-nexus-owned-hold-v1'}}};
  const runtime=await createRuntime(parseConfig(raw),adapters);await runtime.close();
  raw.backends['ue-mcp'].compatibilityPatch='ue-mcp-nexus-direct-pie-v1';
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
});


test('runtime owns and closes its process inspector on success and startup failure',async()=>{
  const {adapters}=fixture();delete adapters.processInspector;
  let closes=0,reads=0;
  adapters.processInspectorFactory=()=>({
    inspect:async()=>{reads++;return {editorInstanceId:'linux-boot:1234:epoch'};},
    close:async()=>{closes++;},
  });
  const runtime=await createRuntime(coreConfig(),adapters);
  assert.equal(reads,1);await runtime.close();await runtime.close();assert.equal(closes,1);
  adapters.processInspectorFactory=()=>({
    inspect:async()=>{throw new Error('missing process');},
    close:async()=>{closes++;},
  });
  await assert.rejects(createRuntime(coreConfig(),adapters),/missing process/u);
  assert.equal(closes,2);
});


test('runtime passes its owned listener inspector to provider probes',async()=>{
  const {adapters}=fixture();delete adapters.processInspector;
  const inspectListener=async()=>({processId:1234,port:30011});
  let seen=false;
  adapters.processInspectorFactory=()=>({
    inspect:async()=>({editorInstanceId:'linux-boot:1234:epoch'}),inspectListener,close:async()=>{},
  });
  adapters.probeFactory=({target,listenerInspector})=>{
    assert.equal(listenerInspector,inspectListener);seen=true;
    return {attestIdentity:async()=>({identityVerified:true,target,evidence:{}}),supports:async()=>true};
  };
  const runtime=await createRuntime(coreConfig(),adapters);
  await runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/Map.Map:PersistentLevel.Actor'});
  assert.equal(seen,true);await runtime.close();
});


test('authoring example satisfies its enabled compatibility requirements',async()=>{
  const raw=JSON.parse(await readFile(new URL('../examples/config.authoring.example.json',import.meta.url),'utf8'));
  const config=parseConfig(raw,{env:{NEXUS_ENGINEWIRE_TOKEN:'x'.repeat(32)}});
  const {adapters}=fixture({editorSelector:async()=>({processId:1234,editorInstanceId:'linux-boot:1234:epoch'})});
  const runtime=await createRuntime(config,adapters);
  assert.equal(runtime.status().allowWrites,false);
  await runtime.close();
});


test('automatic UAP endpoint is resolved lazily and binds the verified target',async()=>{
  const cfg=parseConfig({version:1,target,allowWrites:true,enabledCapabilities:['pie.start.viewport'],backends:{unrealagentplayer:{
    ...backend(),compatibilityPatch:'uap-nexus-owned-pie-v4',rcEndpoint:'editor-auto',
  }}});
  let selected=0,launch;
  const {adapters}=fixture({
    endpointResolver:async(provider,actual)=>{selected++;assert.equal(provider,'unrealagentplayer');assert.equal(actual.processId,1234);return 'http://127.0.0.1:30078';},
    connect:async transport=>{launch=transport;return {listTools:async()=>[{name:'pie_start',inputSchema:{type:'object'}}],
      callTool:async()=>json({ok:true,phase:'Playing',playing:true,editorEpoch:'a'.repeat(32),sessionId:'b'.repeat(32)}),close:async()=>{}};},
  });
  const runtime=await createRuntime(cfg,adapters);
  assert.equal(selected,0);
  assert.notEqual((await runtime.gateway.execute('pie.start.viewport')).isError,true);
  assert.equal(selected,1);assert.equal(launch.env.NEXUS_UAP_RC_PORT,'30078');
  await runtime.close();
});


test('automatic Claireon endpoint is selected only on first use before connection',async()=>{
  const cfg=parseConfig({version:1,target,allowWrites:true,enabledCapabilities:['blueprint.compile.memory.loaded'],backends:{claireon:{
    sourceRoot:'/reviewed/source',compatibilityPatch:'claireon-nexus-compile-loaded-v2',
    transport:{type:'streamable-http',url:'editor-auto'},
  }}});
  let selected=0,connected;
  const {adapters}=fixture({
    endpointResolver:async(provider,actual)=>{selected++;assert.equal(provider,'claireon');assert.equal(actual.processId,1234);return 'http://127.0.0.1:59055/mcp';},
    connect:async transport=>{connected=transport.url;throw new Error('fixture stop');},
  });
  const runtime=await createRuntime(cfg,adapters);
  assert.equal(selected,0);
  await assert.rejects(runtime.gateway.execute('blueprint.compile.memory.loaded',{asset_path:'/Game/BP_Test'}));
  assert.equal(selected,1);assert.equal(connected,'http://127.0.0.1:59055/mcp');
  await runtime.close();
});


test('automatic target selection waits for execution, retries a pre-dispatch absence, then pins one epoch',async()=>{
  const cfg=coreConfig();cfg.target.processId='auto';
  let attempts=0;
  const {events,adapters}=fixture({editorSelector:async()=>{
    attempts++;
    if(attempts===1) throw new Error('editor unavailable');
    return {processId:1234,editorInstanceId:'linux-boot:1234:epoch'};
  }});
  const runtime=await createRuntime(cfg,adapters);
  assert.match(runtime.status().editorIdentity,/awaiting editor selection/u);
  assert.ok(runtime.gateway.list().length);assert.equal(attempts,0);
  const args={actorPath:'/Game/Map.Map:PersistentLevel.Actor'};
  await assert.rejects(runtime.gateway.execute('actor.inspect.editor',args),/editor unavailable/u);
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
  assert.notEqual((await runtime.gateway.execute('actor.inspect.editor',args)).isError,true);
  assert.notEqual((await runtime.gateway.execute('actor.inspect.editor',args)).isError,true);
  assert.equal(attempts,2);assert.match(runtime.status().editorIdentity,/pinned/u);
  await runtime.close();
});


test('closing during automatic editor selection never starts a backend',async()=>{
  const cfg=coreConfig();cfg.target.processId='auto';
  let release,started;
  const selecting=new Promise(resolve=>{started=resolve;});
  const {events,adapters}=fixture({editorSelector:()=>new Promise(resolve=>{release=resolve;started();})});
  const runtime=await createRuntime(cfg,adapters);
  const pending=runtime.gateway.execute('actor.inspect.editor',{actorPath:'/Game/Map.Map:PersistentLevel.Actor'});
  await selecting;await runtime.close();
  release({processId:1234,editorInstanceId:'linux-boot:1234:epoch'});
  await assert.rejects(pending,{code:'GATEWAY_CLOSED'});
  assert.equal(events.filter(e=>e[0]==='connect').length,0);
});


test('checked actor deletion requires the new native compatibility patch',async()=>{
  const raw={version:1,target,allowWrites:true,enabledCapabilities:['actor.delete.editor'],
    backends:{'ue-mcp':{...backend(),compatibilityPatch:'ue-mcp-nexus-owned-hold-v1'}}};
  const {adapters}=fixture();
  await assert.rejects(createRuntime(parseConfig(raw),adapters),{code:'COMPATIBILITY_PATCH_REQUIRED'});
  raw.backends['ue-mcp'].compatibilityPatch='ue-mcp-nexus-checked-delete-v1';
  const runtime=await createRuntime(parseConfig(raw),adapters);await runtime.close();
});
