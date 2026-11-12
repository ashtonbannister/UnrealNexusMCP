import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {inspectListenerOwner} from './provider-probes.mjs';
import {NexusError} from './errors.mjs';

const fail = message => {throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED',message);};
const validPort = port => Number.isInteger(port) && port>0 && port<=65535;

// Resolve once per lazily started backend, never during catalogue discovery.
// Metadata proposes a port; the actual listener must belong to the pinned PID.
export async function resolveProjectEndpoint(provider, target, {
  readText = filename => readFile(filename,'utf8'),
  listenerInspector = inspectListenerOwner,
  platform = process.platform,
} = {}) {
  if(platform!=='win32' || !target || !Number.isSafeInteger(target.processId)
    || target.processId<1 || typeof target.projectRoot!=='string') fail('Editor endpoint discovery needs a selected Windows project/editor.');
  const projectDir=path.dirname(target.projectRoot);
  let text,port,endpoint;
  try {
    if(provider==='claireon') {
      text=await readText(path.join(projectDir,'Saved','Claireon','MCPServer.json'));
      if(typeof text!=='string' || Buffer.byteLength(text)>65536) fail('Claireon endpoint metadata is invalid.');
      const meta=JSON.parse(text);
      if(!meta || meta.mode!=='direct' || meta.pid!==target.processId || !validPort(meta.port))
        fail('Claireon endpoint metadata does not name the selected direct editor.');
      port=meta.port;endpoint='http://127.0.0.1:'+port+'/mcp';
    } else if(provider==='unrealagentplayer') {
      text=await readText(path.join(projectDir,'Saved','Config','WindowsEditor','RemoteControl.ini'));
      if(typeof text!=='string' || Buffer.byteLength(text)>1048576) fail('Remote Control settings are invalid.');
      const sections=[...text.matchAll(/^[ \t]*\[\/Script\/RemoteControlCommon\.RemoteControlSettings\][ \t]*$([\s\S]*?)(?=^[ \t]*\[|(?![\s\S]))/gmu)];
      const matches=sections.length===1?[...sections[0][1].matchAll(/^[ \t]*RemoteControlHttpServerPort[ \t]*=[ \t]*(\d+)[ \t]*$/gmu)]:[];
      if(matches.length!==1 || !validPort(Number(matches[0][1]))) fail('Remote Control port is missing or ambiguous.');
      port=Number(matches[0][1]);endpoint='http://127.0.0.1:'+port;
    } else fail('Automatic endpoint selection is unavailable for this provider.');
    await listenerInspector(endpoint,target.processId);
    return endpoint;
  } catch(error) {
    if(error instanceof NexusError) throw error;
    fail('The selected editor endpoint could not be established.');
  }
}
