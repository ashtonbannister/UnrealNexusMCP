import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler, localhostHostValidation, localhostOriginValidation } from '@modelcontextprotocol/node';
import { createNexusServer } from './mcp-server.mjs';

export async function startHttpServer(runtime, {host='127.0.0.1',port=7337,token}) {
  if (!['127.0.0.1','::1'].includes(host) || typeof token !== 'string' || token.length < 32 || /\s/.test(token)) {
    throw new Error('HTTP requires a loopback bind and a strong configured bearer token.');
  }
  const expected = Buffer.from('Bearer ' + token);
  const handler = createMcpHandler(() => createNexusServer(runtime), {maxRequestBodySize:1024*1024,maxSubscriptions:8});
  const nodeHandler = toNodeHandler(handler, {maxRequestBodySize:1024*1024});
  const hostAllowed = localhostHostValidation(), originAllowed = localhostOriginValidation();
  const server = createServer((req,res) => {
    if (!hostAllowed(req,res) || !originAllowed(req,res)) return;
    if (req.url !== '/mcp') {res.writeHead(404);res.end();return;}
    const supplied = Buffer.from(typeof req.headers.authorization === 'string' ? req.headers.authorization : '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) {
      res.writeHead(401,{'WWW-Authenticate':'Bearer realm="UnrealNexus"'});res.end();return;
    }
    Promise.resolve(nodeHandler(req,res)).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.requestTimeout = 30000; // Bound body reception; this does not limit the editor operation.
  server.headersTimeout = 15000;
  try {
    await new Promise((resolve,reject) => {server.once('error',reject);server.listen(port,host,resolve);});
  } catch (error) { await handler.close(); throw error; }
  let closing;
  return {
    address:server.address(),
    close() {
      if (!closing) closing = (async () => {
        await handler.close();
        await new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
        await runtime.close();
      })();
      return closing;
    },
  };
}
