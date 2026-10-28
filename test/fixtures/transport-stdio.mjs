// Real JSON-RPC stdio fixture. No editor, shell, credentials, or SDK server needed.
import {createInterface} from 'node:readline';

const mode = process.argv[2] ?? 'normal';
let calls = 0;
const tool = (name) => ({name, description:'Protocol fixture '+name,
  inputSchema:{type:'object',additionalProperties:true}});
const send = (id,result) => process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');
const reply = (params) => ({
  content:[{type:'text',text:'fixture receipt'},
    {type:'image',data:'AA==',mimeType:'image/png'},
    {type:'audio',data:'AA==',mimeType:'audio/wav'},
    {type:'resource',resource:{uri:'fixture://receipt',mimeType:'text/plain',text:'retained'}}],
  structuredContent:{arguments:params.arguments ?? {},calls},
  _meta:{'fixture/receipt':'unchanged'},
  ...(params.name === 'refusal' ? {isError:true} : {}),
});

const input = createInterface({input:process.stdin});
if (mode === 'linger-on-close') {
  const alive = setInterval(()=>{},1000);
  input.on('close',()=>setTimeout(()=>clearInterval(alive),250));
}
input.on('line',(line) => {
  const request = JSON.parse(line);
  const {id,method,params={}} = request;
  if (method === 'initialize') {
    if (mode === 'hang-initialize') return;
    if (mode === 'exit-initialize') { process.exit(3); }
    send(id,{protocolVersion:params.protocolVersion,capabilities:{tools:{}},
      serverInfo:{name:'nexus-protocol-fixture',version:'1.0.0'}});
  } else if (method === 'tools/list') {
    const cursor=params.cursor;
    if (mode === 'cursor-cycle') return send(id,{tools:[],nextCursor:'same'});
    if (mode === 'too-many-pages') return send(id,{tools:[],nextCursor:String(Number(cursor ?? 0)+1)});
    if (mode === 'duplicate-tools') return send(id,{tools:[tool('echo'),tool('echo')]});
    if (mode === 'empty-cursor') return send(id,{tools:[],nextCursor:''});
    send(id,cursor ? {tools:[tool('refusal')]} : {tools:[tool('echo')],nextCursor:'second'});
  } else if (method === 'tools/call') {
    calls++;
    if (params.name === 'env') {
      const keys=params.arguments?.keys ?? [];
      send(id,{content:[{type:'text',text:JSON.stringify(Object.fromEntries(
        keys.filter((key) => process.env[key] !== undefined).map((key)=>[key,process.env[key]])))}]});
    } else if (params.name === 'delayed') {
      // Deliberately ignore notifications/cancelled: cancellation is not rollback.
      setTimeout(()=>send(id,reply(params)),params.arguments?.delayMs ?? 200);
    } else {
      send(id,reply(params));
    }
  } else if (method === 'ping') {
    send(id,{});
  }
});
