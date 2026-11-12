import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createMcpHandler, isInitializeRequest, isLegacyRequest,
  WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { toNodeHandler, localhostHostValidation, localhostOriginValidation } from '@modelcontextprotocol/node';
import { createNexusServer, PROVIDER_PROTOCOL_VERSIONS } from './mcp-server.mjs';
import { boundedCleanup } from './errors.mjs';

const MAX_REQUEST_BODY_SIZE = 1024*1024;
const MAX_LEGACY_SESSIONS = 16;

const httpError = (status, code, message, data) => Response.json({jsonrpc:'2.0',id:null,
  error:{code,message,...(data === undefined ? {} : {data})}}, {status});

export async function startHttpServer(runtime, {host='127.0.0.1',port=7337,token}) {
  if (!['127.0.0.1','::1'].includes(host) || typeof token !== 'string' || token.length < 32 || /\s/.test(token)) {
    throw new Error('HTTP requires a loopback bind and a strong configured bearer token.');
  }
  const expected = Buffer.from('Bearer ' + token);
  const full = (runtime.gateway.providerSurface?.providers.length ?? 0) > 0;
  const handler = createMcpHandler(() => createNexusServer(runtime), {
    maxRequestBodySize:MAX_REQUEST_BODY_SIZE,maxSubscriptions:8,...(full ? {legacy:'reject'} : {}),
  });
  // Legacy HTTP must retain its SDK Server across POSTs: initialize records
  // the client's elicitation capabilities, and later POSTs carry its answers.
  // The runtime/backend pool and editor queue remain shared by every session.
  const sessions = new Map();
  const ownedSessions = new Set();
  let shuttingDown = false;
  const routedHandler = {async fetch(request, options) {
    if (shuttingDown) return httpError(503,-32603,'Nexus is closing.');
    if (!full) return handler.fetch(request,options);
    if (!await isLegacyRequest(request,undefined,{maxRequestBodySize:MAX_REQUEST_BODY_SIZE}))
      return httpError(400,-32022,'Full provider sessions require a supported legacy MCP protocol.',
        {supported:PROVIDER_PROTOCOL_VERSIONS,requested:request.headers.get('mcp-protocol-version') ?? 'unknown'});
    const sessionId = request.headers.get('mcp-session-id');
    if (sessionId) {
      const session = sessions.get(sessionId);
      return session ? session.transport.handleRequest(request,{authInfo:options?.authInfo})
        : httpError(404,-32001,'Nexus MCP session not found.');
    }
    let body;
    if (request.method === 'POST') {
      try {body = await request.clone().json();} catch {return httpError(400,-32700,'Invalid JSON.');}
    }
    if (!isInitializeRequest(body)) return httpError(400,-32600,'Initialize Nexus before sending session requests.');
    if (ownedSessions.size >= MAX_LEGACY_SESSIONS)
      return httpError(429,-32000,'Nexus has reached its HTTP session limit; close an existing session.');
    const mcp = createNexusServer(runtime);
    const session = {mcp,transport:undefined};
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator:randomUUID,maxRequestBodySize:MAX_REQUEST_BODY_SIZE,
      onsessioninitialized:id => {sessions.set(id,session);},
    });
    session.transport = transport;
    const onclose = mcp.onclose;
    mcp.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
      ownedSessions.delete(session);
      onclose?.();
    };
    ownedSessions.add(session);
    try {
      await mcp.connect(transport);
      const response = await transport.handleRequest(request,{parsedBody:body,authInfo:options?.authInfo});
      if (!response.ok || !transport.sessionId) await mcp.close();
      return response;
    } catch (error) {
      await mcp.close();
      throw error;
    }
  }};
  const nodeHandler = toNodeHandler(routedHandler, {maxRequestBodySize:MAX_REQUEST_BODY_SIZE});
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
        shuttingDown = true;
        const cleanup = await Promise.allSettled([
          boundedCleanup(() => handler.close(),5000),
          ...[...ownedSessions].map(session => boundedCleanup(() => session.mcp.close(),5000)),
        ]);
        sessions.clear();
        ownedSessions.clear();
        await new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
        await runtime.close();
        const failed = cleanup.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
      })();
      return closing;
    },
  };
}
