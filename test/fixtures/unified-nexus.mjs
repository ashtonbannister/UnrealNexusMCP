import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseConfig} from '../../src/config.mjs';
import {createRuntime} from '../../src/runtime.mjs';
import {closeServices,startStdioServer} from '../../src/main.mjs';

const providerPath = fileURLToPath(new URL('./unified-provider.mjs',import.meta.url));
const fixtureRoot = path.dirname(providerPath);

export async function createUnifiedFixtureRuntime({allowWrites=true,canonical=true} = {}) {
  const config = parseConfig({version:1,allowWrites,timeoutMs:10000,
    target:{projectRoot:path.join(fixtureRoot,'Simulated.uproject'),processId:12345},
    enabledCapabilities:canonical ? ['actor.inspect.editor'] : [],
    backends:Object.fromEntries(['ue-mcp','enginewire'].map(provider => [provider,{
      sourceRoot:fixtureRoot,
      transport:{type:'stdio',command:process.execPath,args:[providerPath,provider],cwd:fixtureRoot},
    }])),
  });
  // Only native/source attestation is simulated. Production configuration,
  // runtime, pool, MCP transport, dispatcher and serialized queue are exercised.
  return createRuntime(config,{
    processInspector:async()=>({editorInstanceId:'fixture-editor-epoch'}),
    processInspectorFactory:null,
    resolvePath:async filename=>path.resolve(filename),
    sourceVerifier:async(provider,backend,source)=>({commit:source.commit,sourceRoot:backend.sourceRoot,compatibilityPatch:null}),
    probeFactory:({target})=>({
      attestIdentity:async()=>({identityVerified:true,target,evidence:{proof:'simulated editor'}}),
      supports:async()=>true,
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const runtime = await createUnifiedFixtureRuntime();
  const endpoint = await startStdioServer(runtime);
  let closing;
  const close = () => closing ??= closeServices(endpoint,runtime);
  process.stdin.once('end',()=>{void close().catch(()=>{process.exitCode=1;});});
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>{
    void close().catch(()=>{process.exitCode=1;});
  });
}
