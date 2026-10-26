import {Client, SSEClientTransport, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {DEFAULT_INHERITED_ENV_VARS, StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {NexusError} from './errors.mjs';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CLOSE_TIMEOUT_MS = 5000;
const DEFAULT_MAX_PAGES = 64;
const DEFAULT_MAX_TOOLS = 10000;

function positiveInteger(value, name, max = 600000) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', name+' is outside the supported bound.');
  }
  return value;
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [null, Object.prototype].includes(Object.getPrototypeOf(value));
}

function strings(value, label) {
  if (!record(value) || Object.values(value).some((v) => typeof v !== 'string' || v.includes('\0'))) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', label+' must contain string values.');
  }
  return value;
}

function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'signal must be an AbortSignal.');
  }
}

function safeError(code, message) {
  // Do not attach raw fetch/spawn errors: URLs, child argv, HTTP bodies or headers
  // can contain credentials. Native tool failures still return in CallToolResult.
  return new NexusError(code, message);
}

function childEnvironment(config) {
  const inherit = config.inheritEnv ?? [];
  if (!Array.isArray(inherit) || inherit.some((key) => typeof key !== 'string'
    || !key || /[=\0]/.test(key))) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'inheritEnv must name explicit environment variables.');
  }
  const configured = strings(config.env ?? {}, 'env');
  if (Object.keys(configured).some((key) => !key || /[=\0]/.test(key))) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'Invalid environment variable name.');
  }
  // SDK stdio merges its defaults even when env is supplied. Undefined overrides
  // remove those implicit values from spawn's environment; no parent secrets leak.
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map((key) => [key, undefined]));
  const put = (key, value) => {
    // Windows names are case-insensitive. Use the SDK default's exact spelling
    // so its implicit value stays overridden after SDK merges getDefaultEnvironment.
    if (process.platform === 'win32') {
      key = DEFAULT_INHERITED_ENV_VARS.find((old) => old.toLowerCase() === key.toLowerCase())
        ?? Object.keys(env).find((old) => old.toLowerCase() === key.toLowerCase()) ?? key;
    }
    Object.defineProperty(env, key, {value, enumerable:true, configurable:true, writable:true});
  };
  for (const key of inherit) {
    const actual = process.platform === 'win32'
      ? Object.keys(process.env).find((name) => name.toLowerCase() === key.toLowerCase()) : key;
    if (actual !== undefined && process.env[actual] !== undefined) put(key, process.env[actual]);
  }
  for (const [key,value] of Object.entries(configured)) put(key,value);
  return env;
}

function makeTransport(config, lifetime, fail) {
  if (!record(config)) throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'A transport configuration is required.');
  if (config.type === 'stdio') {
    if (typeof config.command !== 'string' || !config.command.trim() || config.command.includes('\0')
      || (config.args !== undefined && (!Array.isArray(config.args)
        || config.args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))))
      || (config.cwd !== undefined && (typeof config.cwd !== 'string' || !config.cwd || config.cwd.includes('\0')))) {
      throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'Invalid stdio command, arguments or working directory.');
    }
    const transport = new StdioClientTransport({command:config.command,args:[...(config.args ?? [])],
      ...(config.cwd === undefined ? {} : {cwd:config.cwd}),env:childEnvironment(config),
      stderr:'pipe',maxBufferSize:64*1024*1024});
    // Drain without retaining or forwarding untrusted child stderr into MCP/logs.
    transport.stderr?.resume();
    return transport;
  }
  if (!['streamable-http','sse'].includes(config.type)) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'Select stdio, streamable-http or explicit legacy sse; no fallback.');
  }
  let url;
  try { url = new URL(config.url); } catch {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'Invalid backend URL.');
  }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'Backend URL must be HTTP(S) without embedded credentials or a fragment.');
  }
  let headers;
  try { headers = new Headers(strings(config.headers ?? {}, 'headers')); } catch {
    throw new NexusError('INVALID_TRANSPORT_CONFIGURATION', 'Invalid backend headers.');
  }
  const oneFetch = (input, init = {}) => fetch(input, {...init,redirect:'error',
    signal:AbortSignal.any([lifetime.signal,...(init.signal ? [init.signal] : [])])});
  const options = {requestInit:{headers,redirect:'error'},fetch:oneFetch};
  if (config.type === 'sse') return new SSEClientTransport(url,options);
  return new StreamableHTTPClientTransport(url,{...options,
    reconnectionOptions:{initialReconnectionDelay:1000,maxReconnectionDelay:1000,
      reconnectionDelayGrowFactor:1,maxRetries:0},
    // Defense in depth if a future SDK regresses its zero-retry boundary.
    reconnectionScheduler:() => { fail(safeError('BACKEND_TRANSPORT_FAILED','Backend requested reconnection; automatic reconnect is disabled.')); },
    onInsufficientScope:'throw',maxStepUpRetries:0});
}

/**
 * Initialize exactly one configured backend transport. Calling this function is
 * the lazy-start boundary; importing the module never starts a process/network.
 * No auth refresh, transport fallback, protocol probe or mutation replay occurs.
 * All post-dispatch failures make this connection unusable until operator recovery.
 */
export async function createMcpConnection(config, {
  timeoutMs = DEFAULT_TIMEOUT_MS, startupTimeoutMs = timeoutMs,
  closeTimeoutMs = DEFAULT_CLOSE_TIMEOUT_MS, signal,
} = {}) {
  positiveInteger(timeoutMs,'timeoutMs');
  positiveInteger(startupTimeoutMs,'startupTimeoutMs');
  positiveInteger(closeTimeoutMs,'closeTimeoutMs',30000);
  checkSignal(signal);
  if (signal?.aborted) throw safeError('BACKEND_CANCELLED','Backend startup cancelled before dispatch.');

  const lifetime = new AbortController();
  const client = new Client({name:'unreal-nexus-mcp',version:'0.1.0'}, {
    capabilities:{},versionNegotiation:{mode:'legacy'},
    inputRequired:{autoFulfill:false},enforceStrictCapabilities:true,
  });
  let closed = false;
  let failure;
  let closePromise;
  let transport;

  const close = () => {
    if (closePromise) return closePromise;
    closed = true;
    lifetime.abort(failure ?? safeError('BACKEND_CLOSED','Backend connection is closed.'));
    // Start teardown synchronously, so an EventSource error cannot reconnect
    // before close marks it CLOSED. SDK owns/reaps only the stdio child it spawned.
    const closing = client.close();
    closePromise = new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(safeError('BACKEND_CLOSE_TIMEOUT',
        'Backend close deadline exceeded; cleanup is not confirmed.')),closeTimeoutMs);
      Promise.resolve(closing).then(resolve,()=>reject(safeError('BACKEND_CLOSE_FAILED',
        'Backend transport could not be closed.'))).finally(()=>clearTimeout(timer));
    });
    // Fatal paths initiate cleanup without extending the request deadline.
    closePromise.catch(()=>{});
    return closePromise;
  };

  function fail(error) {
    if (closed) return;
    failure = error;
    void close();
    // eventsource schedules its timer AFTER calling onerror. A second close in
    // the microtask clears that timer too; it never attempts another connection.
    if (config.type === 'sse') queueMicrotask(()=>{ void transport.close().catch(()=>{}); });
  }

  transport = makeTransport(config,lifetime,fail);
  client.onerror = () => fail(safeError('BACKEND_TRANSPORT_FAILED',
    'Backend protocol or transport failed; no retry attempted.'));
  client.onclose = () => {
    closed = true;
    lifetime.abort(failure ?? safeError('BACKEND_CLOSED','Backend connection closed.'));
  };

  const run = async (work, {signal:callSignal,timeoutMs:budget = timeoutMs,onprogress} = {}, startup = false) => {
    positiveInteger(budget,'timeoutMs');
    checkSignal(callSignal);
    if (closed) throw failure ?? safeError('BACKEND_CLOSED','Backend connection is closed; no reconnect attempted.');
    if (callSignal?.aborted) throw safeError('BACKEND_CANCELLED','Request cancelled before dispatch.');
    const deadline = new AbortController();
    const combined = AbortSignal.any([lifetime.signal,deadline.signal,...(callSignal ? [callSignal] : [])]);
    const cancelled = safeError('BACKEND_CANCELLED',startup
      ? 'Backend startup cancelled.' : 'Backend request cancelled; completion is not established.');
    const expired = safeError('BACKEND_TIMEOUT',startup
      ? 'Backend startup deadline exceeded.' : 'Backend request deadline exceeded; completion is not established.');
    let abort;
    const interrupted = new Promise((_,reject) => {
      abort = () => reject(deadline.signal.aborted ? expired : callSignal?.aborted ? cancelled
        : failure ?? safeError('BACKEND_CLOSED','Backend connection closed during request.'));
      combined.addEventListener('abort',abort,{once:true});
    });
    const timer = setTimeout(()=>deadline.abort(expired),budget);
    const requestOptions = {signal:combined,timeout:budget,maxTotalTimeout:budget,resetTimeoutOnProgress:false,
      ...(onprogress === undefined ? {} : {onprogress})};
    try {
      const pending = Promise.resolve().then(()=>{
        if (combined.aborted) throw combined.reason;
        return work(requestOptions);
      });
      return await Promise.race([pending,interrupted]);
    } catch (error) {
      const safe = error instanceof NexusError ? error : safeError('BACKEND_REQUEST_FAILED',
        startup ? 'Backend initialization failed; no retry attempted.'
          : 'Backend request failed; no retry attempted and completion is not established.');
      fail(safe);
      throw safe;
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort',abort);
    }
  };

  await run((options)=>client.connect(transport,options),{signal,timeoutMs:startupTimeoutMs},true);
  if (closed) throw failure ?? safeError('BACKEND_CLOSED','Backend closed during initialization.');

  return Object.freeze({
    get closed() { return closed; },
    get serverInfo() { return structuredClone(client.getServerVersion()); },
    get capabilities() { return structuredClone(client.getServerCapabilities()); },
    get protocolVersion() { return client.getNegotiatedProtocolVersion(); },
    get pid() { return config.type === 'stdio' ? transport.pid : null; },
    close,
    async listTools({signal,timeoutMs:budget = timeoutMs,maxPages = DEFAULT_MAX_PAGES,maxTools = DEFAULT_MAX_TOOLS} = {}) {
      positiveInteger(maxPages,'maxPages',256);
      positiveInteger(maxTools,'maxTools',100000);
      return run(async (options)=>{
        const tools = [];
        const names = new Set();
        const cursors = new Set();
        let cursor;
        for (let page=0; page<maxPages; page++) {
          // v2 Client.listTools() auto-aggregates/cache-serves. The typed request
          // path gives exactly one page, so this total deadline and caps apply.
          const result = await client.request({method:'tools/list',params:cursor === undefined ? {} : {cursor}},options);
          if (tools.length+result.tools.length > maxTools) throw safeError('BACKEND_TOOL_LIMIT','Backend tool count exceeds the configured cap.');
          for (const tool of result.tools) {
            if (names.has(tool.name)) throw safeError('BACKEND_DUPLICATE_TOOL','Backend returned duplicate tool names.');
            names.add(tool.name);
            tools.push(tool);
          }
          if (result.nextCursor === undefined) return tools;
          if (cursors.has(result.nextCursor)) throw safeError('BACKEND_CURSOR_CYCLE','Backend pagination repeated a cursor.');
          cursors.add(result.nextCursor);
          cursor = result.nextCursor;
        }
        throw safeError('BACKEND_PAGE_LIMIT','Backend tool listing exceeds the configured page cap.');
      },{signal,timeoutMs:budget});
    },
    async callTool(name,args = {},options = {}) {
      if (typeof name !== 'string' || !name || !record(args)) {
        throw new NexusError('INVALID_BACKEND_CALL','Tool call needs a nonempty name and object arguments.');
      }
      const params = {name,arguments:structuredClone(args)};
      // The convenience callTool() can refresh/retry modern header mismatches.
      // Typed request() still validates CallToolResult but sends only once.
      return run((requestOptions)=>client.request({method:'tools/call',params},requestOptions),options);
    },
  });
}
