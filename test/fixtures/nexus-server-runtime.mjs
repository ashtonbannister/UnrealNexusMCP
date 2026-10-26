// A deliberately simulated native backend behind the real canonical gateway.
// It makes no editor/source attestation claim and never opens an Unreal project.
import {loadCatalog} from '../../src/catalog.mjs';
import {Gateway} from '../../src/gateway.mjs';
import {loadGuidance} from '../../src/guidance.mjs';

export const FIXTURE_CAPABILITIES = ['pie.status','pie.start.viewport',
  'screenshot.viewport.current','asset.save.exact'].sort();
export const FIXTURE_IMAGE = {
  content:[{type:'text',text:'Warning: fixture image; not a live editor.'},
    {type:'image',data:'AA==',mimeType:'image/png'}],
  structuredContent:{width:1,height:1,warnings:['fixture only']},
  _meta:{'fixture/receipt':'retained'},
};

export async function createFixtureRuntime({mode = 'normal',allowWrites = true} = {}) {
  const catalog=loadCatalog();
  const target={projectRoot:'/fixture/NexusFixture.uproject',editorInstanceId:'fixture-process-epoch'};
  const state={starts:[],calls:[],closes:[],active:0,maxActive:0,aborts:0,completed:0};
  const surfaces={'unrealagentplayer':['pie_status','pie_start'],'enginewire':['unreal'],'ue-mcp':['tools']};
  const factories=new Map(Object.entries(surfaces).map(([provider,names])=>[provider,async()=>{
    state.starts.push(provider);
    return {
      tools:new Set(names),sourceCommit:catalog.upstreams.sources[provider].commit,
      identityVerified:true,target,supports:async()=>true,
      async call(call,timeoutMs,{signal} = {}) {
        state.calls.push({provider,call:structuredClone(call)});
        state.active++;state.maxActive=Math.max(state.maxActive,state.active);
        try {
          if(mode==='throw') throw new Error('fixture-private-detail-must-not-reach-client');
          if(mode==='native-timeout' && provider==='ue-mcp') {
            return {isError:true,content:[
              {type:'text',text:'Error [TASK_FAILED]: fixture native deadline'},
              {type:'text',text:'MACHINE_ERROR='+JSON.stringify({code:'BRIDGE_TIMEOUT',
                outcome:'unknown',operationId:'fixture-native-42',method:'save_assets'})},
            ]};
          }
          if(mode==='delay' || mode==='late') {
            await new Promise((resolve,reject)=>{
              const aborted=()=>{state.aborts++;reject(new Error('fixture request aborted; backend may still finish'));};
              signal?.addEventListener('abort',aborted,{once:true});
              // Deliberately not cleared on abort: prove cancellation is not rollback.
              setTimeout(()=>{
                state.completed++;signal?.removeEventListener('abort',aborted);resolve();
              },mode==='late'?220:50);
              if(signal?.aborted) aborted();
            });
          } else state.completed++;
          if(provider==='enginewire') return structuredClone(FIXTURE_IMAGE);
          const body=call.name==='pie_start'?{ok:true,playing:true,phase:'Playing'}
            :call.name==='pie_status'?{ok:true,phase:'NotPlaying'}:{success:true};
          return {content:[{type:'text',text:JSON.stringify(body)}]};
        } finally {state.active--;}
      },
      async close() {state.closes.push(provider);},
    };
  }]));
  const gateway=new Gateway(catalog,{target,allowWrites,timeoutMs:2000,
    enabledCapabilities:FIXTURE_CAPABILITIES,backendFactories:factories});
  return {gateway,guidance:await loadGuidance(),state,
    status:()=>({...gateway.status(),fixture:structuredClone(state),
      qualification:'Simulated native backend; real MCP protocol only.'}),
    close:()=>gateway.close(),
  };
}
