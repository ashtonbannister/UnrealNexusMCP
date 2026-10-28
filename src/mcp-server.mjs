import { Server, ProtocolError, ProtocolErrorCode, ResourceNotFoundError } from '@modelcontextprotocol/server';
import { MASTER_URI, ENABLED_GUIDANCE_URI, CATALOG_URI, STATUS_URI } from './guidance.mjs';

const jsonContent = value => ({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
const objectSchema = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const idSchema = {type:'string',minLength:1,maxLength:160};
const invalidParams = message => new ProtocolError(ProtocolErrorCode.InvalidParams, message);
const controlTools = [
  {name:'nexus.status',description:'Read enablement, loaded backends and execution state without starting a backend.',inputSchema:objectSchema({})},
  {name:'nexus.describe',description:'Read the selected route, scope, source pin and postconditions of one enabled operation.',inputSchema:objectSchema({id:idSchema})},
  {name:'nexus.plan',description:'Validate and preview one enabled canonical call. Never dispatches or starts a backend.',
    inputSchema:{type:'object',properties:{id:idSchema,arguments:{type:'object'}},required:['id','arguments'],additionalProperties:false}},
].map(t => ({...t,annotations:{readOnlyHint:true,idempotentHint:true,destructiveHint:false,openWorldHint:false}}));

function controlArgs(args, names) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(k => !names.includes(k)) || names.some(k => !Object.hasOwn(args,k))) {
    throw invalidParams('Invalid Nexus control arguments.');
  }
  if (names.includes('id') && (typeof args.id !== 'string' || !args.id || args.id.length > 160)) throw invalidParams('Invalid canonical ID.');
}

// Each protocol connection/request gets its own SDK Server. All share ONE runtime
// and editor queue; a new HTTP request must never reset an uncertain editor.
export function createNexusServer(runtime) {
  const {gateway, guidance} = runtime;
  const operations = gateway.list().map(op => gateway.catalog.get(op.id));
  const enabledGuidance = guidance.forOperations(operations);
  const server = new Server({name:'unreal-nexus',version:'0.2.0'}, {
    capabilities:{tools:{},resources:{},prompts:{}}, inputRequired:{legacyShim:false},
    instructions:'Use only the enabled canonical tools. Read ' + ENABLED_GUIDANCE_URI
      + ' for the governing workflow; the complete master draft is at ' + MASTER_URI
      + '. Tool discovery and nexus.plan do not start backends. Never bypass a refusal or retry an uncertain mutation.\n\n'
      + guidance.sections.get(0),
  });
  const manifest = [...controlTools,...gateway.toolDefinitions()];
  server.setRequestHandler('tools/list', async request => {
    if (request.params?.cursor) throw invalidParams('This bounded manifest has no further pages.');
    return {tools:manifest};
  });
  server.setRequestHandler('tools/call', async (request, context) => {
    const {name,arguments:args = {}} = request.params;
    try {
      if (name === 'nexus.status') { controlArgs(args,[]); return jsonContent(runtime.status()); }
      if (name === 'nexus.describe') { controlArgs(args,['id']); return jsonContent(gateway.describe(args.id)); }
      if (name === 'nexus.plan') { controlArgs(args,['id','arguments']); return jsonContent(gateway.plan(args.id,args.arguments)); }
      return await gateway.execute(name,args,{signal:context.mcpReq.signal});
    } catch (error) {
      // Error details from arbitrary transports can contain URLs/headers. Core
      // errors carry bounded user-facing messages; unknown exceptions are redacted.
      const code = typeof error.code === 'string' ? error.code : 'NEXUS_CALL_FAILED';
      const message = error.name === 'NexusError' ? error.message : 'The call was refused or failed; inspect the host diagnostics.';
      const response = jsonContent({error:code,message,queue:gateway.status().queue});
      if (error.backendResult && Array.isArray(error.backendResult.content)) {
        // Preserve a received native receipt, including diagnostics/images, even
        // when it cannot establish completion. Never substitute raw exceptions.
        response.content.push(...error.backendResult.content);
        response.structuredContent.nativeReceipt = error.backendResult;
      }
      return {...response,isError:true};
    }
  });
  const resources = [
    {uri:MASTER_URI,name:'Master workflow guidance',mimeType:'text/markdown',description:'Complete source-reviewed master skill guidance draft.'},
    {uri:ENABLED_GUIDANCE_URI,name:'Enabled workflow guidance',mimeType:'text/markdown',description:'Governing rules plus workflows for enabled capabilities.'},
    {uri:CATALOG_URI,name:'Enabled canonical catalogue',mimeType:'application/json'},
    {uri:STATUS_URI,name:'Gateway status',mimeType:'application/json'},
  ];
  server.setRequestHandler('resources/list',async () => ({resources}));
  server.setRequestHandler('resources/templates/list',async () => ({resourceTemplates:[]}));
  server.setRequestHandler('resources/read',async request => {
    const uri = request.params.uri;
    const resource = resources.find(r => r.uri === uri);
    if (!resource) throw new ResourceNotFoundError(uri, 'Unknown Nexus resource.');
    const text = uri === MASTER_URI ? guidance.master : uri === ENABLED_GUIDANCE_URI ? enabledGuidance
      : JSON.stringify(uri === CATALOG_URI ? operations.map(op => gateway.describe(op.id)) : runtime.status(),null,2);
    return {contents:[{uri,mimeType:resource.mimeType,text}]};
  });
  server.setRequestHandler('prompts/list',async () => ({prompts:[{
    name:'nexus_workflow',description:'Use the master workflow for one enabled canonical operation.',
    arguments:[{name:'capability',description:'Enabled canonical operation ID.',required:true}],
  }]}));
  server.setRequestHandler('prompts/get',async request => {
    if (request.params.name !== 'nexus_workflow') throw invalidParams('Unknown prompt.');
    const args = request.params.arguments ?? {};
    if (Object.keys(args).some(k => k !== 'capability') || typeof args.capability !== 'string') throw invalidParams('An enabled capability is required.');
    const op = gateway.describe(args.capability);
    return {description:'Reviewed workflow for ' + op.id,messages:[{role:'user',content:{type:'text',text:
      guidance.forOperations([op]) + '\n## Selected operation\n\n```json\n' + JSON.stringify(op,null,2) + '\n```\n'}}]};
  });
  return server;
}
