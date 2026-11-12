// Simulated provider contracts over real JSON-RPC stdio. No Unreal editor is used.
import {createInterface} from 'node:readline';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function providerTools(provider, expanded = false) {
  const gateway = provider === 'ue-mcp' ? 'tools' : 'unreal';
  const descriptor = (name, readOnlyHint = false) => ({
    name, title:`${provider} ${name}`, description:`Original ${provider} ${name} contract.`,
    inputSchema:{type:'object',properties:{value:{anyOf:[{type:'string'},{type:'null'}],default:null}},additionalProperties:true},
    annotations:{readOnlyHint,idempotentHint:readOnlyHint,openWorldHint:true},
    _meta:{'fixture/schema-origin':provider},
  });
  return [
    {...descriptor(gateway),inputSchema:{type:'object',properties:provider === 'ue-mcp'
      ? {action:{type:'string',enum:['list','describe','call']},category:{type:'string'},method:{type:'string'},args:{type:'object'}}
      : {operation:{type:'string',enum:['search','describe','execute','configure']},capability:{type:'string'},params:{type:'object'},options:{type:'object'}},additionalProperties:true}},
    {...descriptor('echo',true),outputSchema:{type:'object',properties:{provider:{type:'string'},tool:{type:'string'},arguments:{type:'object'}},required:['provider','tool','arguments'],additionalProperties:false}},
    descriptor('refusal'),
    descriptor('reject_params',true),
    descriptor('enable_tools'),
    descriptor('stats',true),
    descriptor('approval'),
    ...(expanded ? [descriptor('newly_enabled',true)] : []),
  ];
}

export const providerResource = provider => ({uri:'fixture://reference',name:'reference',
  title:`${provider} reference`,mimeType:'text/plain',_meta:{'fixture/source':provider}});
export const providerResourceTemplate = provider => ({uriTemplate:'fixture://item/{id}',name:'item',
  description:`${provider} item template`,mimeType:'text/plain',_meta:{'fixture/source':provider}});
export const providerPrompt = provider => ({name:'explain',description:`${provider} explanation`,
  arguments:[{name:'subject',description:'Exact subject',required:true}],_meta:{'fixture/source':provider}});
export const providerElicitation = provider => ({mode:'form',message:`Approve the ${provider} fixture change?`,
  requestedSchema:{type:'object',properties:{approved:{type:'boolean'},reason:{type:'string'}},required:['approved']},
  _meta:{'fixture/request':provider}});

export function providerReceipt(provider, tool, args) {
  return {
    content:[
      {type:'text',text:`${provider} original receipt`,annotations:{audience:['user']}},
      {type:'image',data:'AA==',mimeType:'image/png'},
      {type:'audio',data:'AA==',mimeType:'audio/wav'},
      {type:'resource',resource:{uri:'fixture://receipt',mimeType:'text/plain',text:'original embedded resource'}},
    ],
    structuredContent:{provider,tool,arguments:args},
    _meta:{'fixture/receipt':{provider,unchanged:true}},
    isError:tool === 'refusal',
  };
}

export function startProvider(provider) {
  let expanded = false;
  let nextElicitation = 0;
  const elicitations = new Map();
  const calls = Object.create(null);
  const send = message => process.stdout.write(JSON.stringify({jsonrpc:'2.0',...message})+'\n');
  const reply = (id,result) => send({id,result});
  const input = createInterface({input:process.stdin});
  input.on('line',line => {
    const message = JSON.parse(line);
    const {id,method,params={}} = message;
    if (!method && elicitations.has(id)) {
      const pending = elicitations.get(id);
      elicitations.delete(id);
      if (message.error) send({id:pending.id,error:message.error});
      else reply(pending.id,{content:[{type:'text',text:'Original provider elicitation receipt.'}],
        structuredContent:{request:pending.params,response:message.result},_meta:{'fixture/elicitation':provider}});
      return;
    }
    if (method === 'initialize') {
      reply(id,{protocolVersion:params.protocolVersion,capabilities:{tools:{listChanged:true},
        resources:{subscribe:true,listChanged:true},prompts:{listChanged:true},completions:{}},
        serverInfo:{name:provider,version:'fixture-1'},instructions:`Use the complete ${provider} provider surface.`});
    } else if (method === 'tools/list') {
      const tools = providerTools(provider,expanded);
      // Both providers deliberately paginate and collide on all non-gateway names.
      reply(id,params.cursor === 'second' ? {tools:tools.slice(2)} : {tools:tools.slice(0,2),nextCursor:'second'});
    } else if (method === 'tools/call') {
      const {name,arguments:args={}} = params;
      calls[name] = (calls[name] ?? 0)+1;
      if (name === 'reject_params') {
        send({id,error:{code:-32602,message:'Provider rejected value.',data:{provider,field:'value',unchanged:true}}});
      } else if (name === 'approval') {
        const requestId = `fixture-elicitation-${++nextElicitation}`;
        const elicitation = providerElicitation(provider);
        elicitations.set(requestId,{id,params:elicitation});
        send({id:requestId,method:'elicitation/create',params:elicitation});
      } else if (name === 'stats') {
        reply(id,{content:[{type:'text',text:'Provider process and call counters.'}],
          structuredContent:{provider,pid:process.pid,calls:{...calls}}});
      } else if (name === 'tools' && args.category === 'level' && args.method === 'get_actor_details') {
        reply(id,{content:[{type:'text',text:JSON.stringify({success:true,actorPath:args.args.actorPath,path:args.args.actorPath})}]});
      } else {
        reply(id,providerReceipt(provider,name,args));
        if (name === 'enable_tools' && !expanded) {
          expanded = true;
          send({method:'notifications/tools/list_changed'});
        }
      }
    } else if (method === 'resources/list') {
      reply(id,{resources:[providerResource(provider)]});
    } else if (method === 'resources/templates/list') {
      reply(id,{resourceTemplates:[providerResourceTemplate(provider)]});
    } else if (method === 'resources/read') {
      reply(id,{contents:[{uri:params.uri,mimeType:'text/plain',text:`${provider} native resource`}],
        _meta:{'fixture/source':provider}});
    } else if (method === 'resources/subscribe' || method === 'resources/unsubscribe') {
      reply(id,{});
      if (method === 'resources/subscribe') send({method:'notifications/resources/updated',params:{uri:params.uri}});
    } else if (method === 'prompts/list') {
      reply(id,{prompts:[providerPrompt(provider)]});
    } else if (method === 'prompts/get') {
      reply(id,{description:`${provider} original prompt`,messages:[{role:'user',
        content:{type:'text',text:JSON.stringify({name:params.name,arguments:params.arguments})}}],
        _meta:{'fixture/source':provider}});
    } else if (method === 'completion/complete') {
      reply(id,{completion:{values:['alpha','beta'],total:2,hasMore:false},
        _meta:{'fixture/source':provider,'fixture/native-reference':params.ref}});
    } else if (method === 'ping') reply(id,{});
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startProvider(process.argv[2]);
}
