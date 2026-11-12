import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveProjectEndpoint} from '../src/project-endpoints.mjs';
import {parseConfig} from '../src/config.mjs';

const target={projectRoot:'/projects/Demo/Demo.uproject',processId:42,editorInstanceId:'epoch'};
const ini='[/Script/RemoteControlCommon.RemoteControlSettings]\nRemoteControlHttpServerPort=30078\n[Other]\nOther=1\n';
const inputs=(text,listenerInspector=async()=>{})=>({platform:'win32',readText:async()=>text,listenerInspector});
test('endpoint discovery requires direct Claireon metadata and editor-owned listeners',async()=>{
  const seen=[];
  const opts=inputs(JSON.stringify({pid:42,port:59055,mode:'direct'}),async(url,pid)=>seen.push([url,pid]));
  assert.equal(await resolveProjectEndpoint('claireon',target,opts),'http://127.0.0.1:59055/mcp');
  assert.deepEqual(seen,[['http://127.0.0.1:59055/mcp',42]]);
  for(const body of [{pid:41,port:59055,mode:'direct'},{pid:42,port:59055,mode:'proxy'},{pid:42,port:0,mode:'direct'}])
    await assert.rejects(resolveProjectEndpoint('claireon',target,inputs(JSON.stringify(body))),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
  await assert.rejects(resolveProjectEndpoint('claireon',target,inputs(JSON.stringify({pid:42,port:59055,mode:'direct'}),async()=>{throw Error('foreign listener')})),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
});
test('UAP endpoint discovery rejects missing or ambiguous settings and checks listener ownership',async()=>{
  const seen=[];
  assert.equal(await resolveProjectEndpoint('unrealagentplayer',target,inputs(ini,async(url,pid)=>seen.push([url,pid]))),'http://127.0.0.1:30078');
  assert.deepEqual(seen,[['http://127.0.0.1:30078',42]]);
  for(const text of ['',ini+ini,ini.replace('30078','70000'),ini.replace('RemoteControlHttpServerPort=30078','RemoteControlHttpServerPort=30078\nRemoteControlHttpServerPort=30079')])
    await assert.rejects(resolveProjectEndpoint('unrealagentplayer',target,inputs(text)),{code:'EDITOR_IDENTITY_UNCONFIRMED'});
});
test('only Claireon streamable HTTP accepts editor-auto transport URLs',()=>{
  const backend=(url,type='streamable-http')=>({sourceRoot:'/source',transport:{type,url}});
  const c=parseConfig({version:1,backends:{claireon:backend('editor-auto')}});
  assert.equal(c.backends.claireon.transport.url,'editor-auto');
  assert.throws(()=>parseConfig({version:1,backends:{enginewire:backend('editor-auto')}}),{code:'INVALID_CONFIGURATION'});
  assert.throws(()=>parseConfig({version:1,backends:{claireon:backend('editor-auto','sse')}}),{code:'INVALID_CONFIGURATION'});
});
