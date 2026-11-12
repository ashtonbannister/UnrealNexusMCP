import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEditorForProject} from '../src/provider-probes.mjs';
import {parseConfig} from '../src/config.mjs';
import {createRuntime} from '../src/runtime.mjs';

const platform = process.platform === 'win32' ? 'linux' : 'win32';
const project = platform === 'win32' ? 'C:\\Projects\\Demo\\Demo.uproject' : '/projects/Demo/Demo.uproject';
const other = platform === 'win32' ? 'C:\\Projects\\Other\\Other.uproject' : '/projects/Other/Other.uproject';
const info = (pid, file=project, epoch='one') => ({
  processId:pid, platform, executablePath:platform === 'win32' ? 'C:\\UE\\UnrealEditor.exe' : '/opt/UnrealEditor',
  argv:['UnrealEditor.exe',file], editorInstanceId:`win32:${pid}:${epoch}`,
});
const inspect = entries => async pid => entries[pid];
test('automatic selection accepts one matching project and rejects absent, ambiguous, or replaced editors', async () => {
  const entries = {1:info(1),2:info(2,other)};
  assert.equal((await selectEditorForProject(project,{enumerate:async()=>[1,2],processInspector:inspect(entries)})).processId,1);
  await assert.rejects(selectEditorForProject(project,{enumerate:async()=>[],processInspector:inspect(entries)}),{code:'IDENTITY_UNPROVEN'});
  await assert.rejects(selectEditorForProject(project,{enumerate:async()=>[1,3],processInspector:inspect({...entries,3:info(3)})}),{code:'IDENTITY_UNPROVEN'});
  let reads=0;
  await assert.rejects(selectEditorForProject(project,{enumerate:async()=>[1],processInspector:async()=>info(1,project,++reads===1?'one':'two')}),{code:'IDENTITY_UNPROVEN'});
});
test('runtime exposes discovery before the automatic editor is selected',async () => {
  const cfg=parseConfig({version:1,target:{projectRoot:'/tmp/Demo.uproject',processId:'auto'},backends:{}});
  const runtime=await createRuntime(cfg,{resolvePath:async p=>p,editorSelector:async()=>({processId:44,editorInstanceId:'epoch-44'})});
  assert.match(runtime.status().editorIdentity,/awaiting editor selection/u);
  await runtime.close();
  assert.throws(()=>parseConfig({version:1,target:{projectRoot:'/tmp/Demo.uproject',processId:'AUTO'},backends:{}}),{code:'INVALID_CONFIGURATION'});
});
