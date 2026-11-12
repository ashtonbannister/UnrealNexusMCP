// Standalone CAP-18A fixture: not used by Nexus or an Unreal transport.
// Supply NEXUS_WS_FIXTURE_ROOT pointing at a separately verified ws 8.22.0 package.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const root=process.env.NEXUS_WS_FIXTURE_ROOT;
if (!root || !path.isAbsolute(root)) throw new Error('Set NEXUS_WS_FIXTURE_ROOT to an absolute, independently verified ws 8.22.0 package directory.');
const meta=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if (meta.name!=='ws' || meta.version!=='8.22.0') throw new Error('Fixture requires ws 8.22.0.');
const require=createRequire(import.meta.url);
const WebSocket=require(root);
const WebSocketServer=WebSocket.Server;
const limit=1024;

async function receive({send, compression=false}) {
  const server=new WebSocketServer({host:'127.0.0.1',port:0,perMessageDeflate:compression ? {threshold:0} : false});
  const sockets=new Set();
  try {
    await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    const result=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('fixture timed out')),3000);
      let delivered=0, failure=null, negotiated='';
      server.once('connection', socket=>{
        sockets.add(socket);socket.on('error',()=>{});
        negotiated=socket.extensions;
        try {send(socket);} catch (error) {reject(error);}
      });
      const client=new WebSocket(`ws://127.0.0.1:${server.address().port}`,{
        maxPayload:limit,perMessageDeflate:compression ? {threshold:0} : false,
      });
      sockets.add(client);
      client.on('message',()=>{delivered++;client.close();});
      client.on('error',error=>{failure=error;});
      client.on('close',()=>{clearTimeout(timer);resolve({delivered,failure,negotiated});});
    });
    return await result;
  } finally {
    for (const socket of sockets) socket.terminate();
    await new Promise(resolve=>server.close(resolve));
  }
}

test('ws 8.22.0 delivers a message at the configured limit',async()=>{
  const out=await receive({send:s=>s.send(Buffer.alloc(limit))});
  assert.equal(out.delivered,1);assert.equal(out.failure,null);
});
test('ws rejects a declared oversize header before its payload is sent',async()=>{
  // An unmasked server-to-client binary frame declares 1025 bytes; no body follows.
  const out=await receive({send:s=>s._socket.write(Buffer.from([0x82,0x7e,0x04,0x01]))});
  assert.equal(out.delivered,0);assert.equal(out.failure?.code,'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH');
});
test('ws rejects an uncompressed fragmented message whose aggregate exceeds the limit',async()=>{
  const out=await receive({send:s=>{s.send(Buffer.alloc(600),{fin:false});s.send(Buffer.alloc(425),{fin:true});}});
  assert.equal(out.delivered,0);assert.equal(out.failure?.code,'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH');
});
test('ws rejects an oversized inflated message when compression is negotiated',async()=>{
  const out=await receive({compression:true,send:s=>s.send(Buffer.alloc(limit*32),{compress:true})});
  assert.match(out.negotiated,/permessage-deflate/);
  assert.equal(out.delivered,0);assert.equal(out.failure?.code,'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH');
});
