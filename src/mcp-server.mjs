import { Server, ProtocolError, ProtocolErrorCode, ResourceNotFoundError, SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server';
import { MASTER_URI, ENABLED_GUIDANCE_URI, CATALOG_URI, STATUS_URI } from './guidance.mjs';
import {searchCommands,describeSource} from './command-search.mjs';
import {PROVIDER_GUIDANCE_URI} from './provider-surface.mjs';

export const PROVIDER_PROTOCOL_VERSIONS = SUPPORTED_PROTOCOL_VERSIONS.filter(version => version.startsWith('2025-'));

const jsonContent = value => ({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
const objectSchema = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const idSchema = {type:'string',minLength:1,maxLength:160};
const invalidParams = message => new ProtocolError(ProtocolErrorCode.InvalidParams, message);
const controlTools = [
  {name:'nexus.status',description:'Read enablement, loaded backends and execution state without starting a backend.',inputSchema:objectSchema({})},
  {name:'nexus.search',description:'Search canonical commands and static upstream inventory without starting a backend.',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:256},limit:{type:'integer',minimum:1,maximum:50},offset:{type:'integer',minimum:0,maximum:100000}},required:['query'],additionalProperties:false}},
  {name:'nexus.describe_source',description:'Describe one static upstream source record and any exact current route bindings without starting a backend.',inputSchema:objectSchema({provider:idSchema,surface:idSchema,sourceEntry:idSchema})},
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
  const providers = gateway.providerSurface;
  const full = providers.providers.length > 0;
  const server = new Server({name:'unreal-nexus',version:'0.3.0'}, {
    // These providers use synchronous 2025-era elicitation. Negotiate that
    // protocol so a user decision resumes the SAME call, never a replayed
    // mutation disguised as a modern multi-round-trip continuation.
    ...(full ? {supportedProtocolVersions:PROVIDER_PROTOCOL_VERSIONS} : {}),
    capabilities:full ? {tools:{listChanged:true},resources:{listChanged:true,subscribe:true},prompts:{listChanged:true},completions:{}}
      : {tools:{},resources:{},prompts:{}}, inputRequired:{legacyShim:false},
    instructions:full
      ? 'Nexus exposes the complete MCP toolsets of its configured providers through this one server. '
        + 'Use <provider>__<native-tool-name> with the original native arguments; the result is returned unchanged. '
        + 'The tools gateway of UE-MCP and the unreal gateway of EngineWire expose their full inner catalogues. '
        + 'Read ' + PROVIDER_GUIDANCE_URI + ' for the original provider instructions and name mapping. '
        + 'Provider prompts use the same prefix. Prefix native resource URIs with unreal-nexus-provider://<provider>/. '
        + 'Full tools/resources/prompts discovery connects the configured providers. Canonical tools are also available; '
        + ENABLED_GUIDANCE_URI + ' governs those optional canonical workflows, not the full provider interface. '
        + 'Respect provider permissions and task authority; never retry an uncertain mutation.'
      : 'Use only the enabled canonical tools. Read ' + ENABLED_GUIDANCE_URI
      + ' for the governing workflow; the complete master draft is at ' + MASTER_URI
      + '. Tool discovery and nexus.plan do not start backends. Never bypass a refusal or retry an uncertain mutation.\n\n'
      + guidance.sections.get(0),
  });
  const requestOptions = context => ({signal:context.mcpReq.signal,
    meta:context.mcpReq._meta,
    clientContext:{capabilities:context.mcpReq.envelope?.clientCapabilities ?? server.getClientCapabilities() ?? {},
      send:(request, options) => context.mcpReq.send(request, options)},
    ...(context.mcpReq._meta?.progressToken === undefined ? {} : {
      onprogress:progress => { void context.mcpReq.notify({method:'notifications/progress', params:{
        ...progress, progressToken:context.mcpReq._meta.progressToken,
      }}).catch(()=>{}); },
    }),
  });
  if (full) {
    const unsubscribe = providers.onNotification(notification => {
      void server.notification(notification).catch(()=>{});
    });
    server.onclose = unsubscribe;
  }
  const manifest = [...controlTools,...gateway.toolDefinitions()];
  server.setRequestHandler('tools/list', async (request, context) => {
    if (request.params?.cursor) throw invalidParams('This bounded manifest has no further pages.');
    return {tools:[...manifest,...await gateway.listProviderTools(requestOptions(context))]};
  });
  server.setRequestHandler('tools/call', async (request, context) => {
    const {name,arguments:args = {}} = request.params;
    try {
      if (name === 'nexus.status') { controlArgs(args,[]); return jsonContent(runtime.status()); }
      if (name === 'nexus.search') return jsonContent(await searchCommands(gateway,args));
      if (name === 'nexus.describe_source') { controlArgs(args,['provider','surface','sourceEntry']); return jsonContent(await describeSource(gateway,args)); }
      if (name === 'nexus.describe') { controlArgs(args,['id']); return jsonContent(gateway.describe(args.id)); }
      if (name === 'nexus.plan') { controlArgs(args,['id','arguments']); return jsonContent(gateway.plan(args.id,args.arguments)); }
      if (gateway.isProviderTool(name)) return await gateway.executeProviderTool(name,args,requestOptions(context));
      return await gateway.execute(name,args,requestOptions(context));
    } catch (error) {
      if (gateway.isProviderTool(name) && error instanceof ProtocolError) throw error;
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
    ...(full ? [{uri:PROVIDER_GUIDANCE_URI,name:'Provider instructions',mimeType:'text/markdown',
      description:'Original provider instructions and namespaced tool, prompt and resource routing.'}] : []),
  ];
  server.setRequestHandler('resources/list',async (request, context) => ({resources:[...resources,
    ...await providers.listResources(requestOptions(context))]}));
  server.setRequestHandler('resources/templates/list',async (request, context) =>
    ({resourceTemplates:await providers.listResourceTemplates(requestOptions(context))}));
  server.setRequestHandler('resources/read',async (request, context) => {
    const uri = request.params.uri;
    if (providers.parseResource(uri)) return providers.requestResource('resources/read',request.params,requestOptions(context));
    const resource = resources.find(r => r.uri === uri);
    if (!resource) throw new ResourceNotFoundError(uri, 'Unknown Nexus resource.');
    const text = uri === PROVIDER_GUIDANCE_URI ? await providers.guidance(requestOptions(context))
      : uri === MASTER_URI ? guidance.master : uri === ENABLED_GUIDANCE_URI ? enabledGuidance
      : JSON.stringify(uri === CATALOG_URI ? operations.map(op => gateway.describe(op.id)) : runtime.status(),null,2);
    return {contents:[{uri,mimeType:resource.mimeType,text}]};
  });
  server.setRequestHandler('prompts/list',async (request, context) => ({prompts:[{
    name:'nexus_workflow',description:'Use the master workflow for one enabled canonical operation.',
    arguments:[{name:'capability',description:'Enabled canonical operation ID.',required:true}],
  },...await providers.listPrompts(requestOptions(context))]}));
  server.setRequestHandler('prompts/get',async (request, context) => {
    if (providers.isPrompt(request.params.name)) return providers.getPrompt(request.params,requestOptions(context));
    if (request.params.name !== 'nexus_workflow') throw invalidParams('Unknown prompt.');
    const args = request.params.arguments ?? {};
    if (Object.keys(args).some(k => k !== 'capability') || typeof args.capability !== 'string') throw invalidParams('An enabled capability is required.');
    const op = gateway.describe(args.capability);
    return {description:'Reviewed workflow for ' + op.id,messages:[{role:'user',content:{type:'text',text:
      guidance.forOperations([op]) + '\n## Selected operation\n\n```json\n' + JSON.stringify(op,null,2) + '\n```\n'}}]};
  });
  if (full) {
    for (const method of ['resources/subscribe','resources/unsubscribe']) {
      server.setRequestHandler(method, (request, context) => providers.requestResource(method,request.params,requestOptions(context)));
    }
    server.setRequestHandler('completion/complete', (request, context) => providers.complete(request.params,requestOptions(context)));
  }
  return server;
}
