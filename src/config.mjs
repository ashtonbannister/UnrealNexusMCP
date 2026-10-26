import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NexusError } from './errors.mjs';

const fail = (message) => { throw new NexusError('INVALID_CONFIGURATION', message); };
const object = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object.');
};
const keys = (value, allowed, label) => {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(label + ': unknown field ' + key);
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) fail(label + ' must be a nonempty string.');
  return value;
};
const strings = (value, label) => {
  if (!Array.isArray(value) || value.length > 256 || value.some(v => typeof v !== 'string' || !v || v.includes('\0'))) {
    fail(label + ' must be a bounded array of strings.');
  }
  return [...new Set(value)];
};
const argumentsList = value => {
  if (!Array.isArray(value) || value.length > 256 || value.some(v => typeof v !== 'string' || v.includes('\0'))) {
    fail('Stdio args must be a bounded array of strings.');
  }
  return [...value];
};
const integer = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(label + ' is outside its integer bounds.');
  return value;
};
const envName = (value, label) => {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) fail(label + ' must name an environment variable.');
  return value;
};
const envValue = (name, env, label) => {
  envName(name, label);
  return text(env[name], label + ' (' + name + ')');
};
const mapStrings = (value, label) => {
  object(value, label);
  const out = Object.create(null);
  for (const [key, val] of Object.entries(value)) out[text(key, label)] = text(val, label + '.' + key);
  return out;
};
const absolute = (value, base, label) => path.resolve(base, text(value, label));
const providers = new Set(['ue-mcp', 'enginewire', 'unrealagentplayer', 'claireon', 'hayba']);

export function parseConfig(raw, { baseDir = process.cwd(), env = process.env } = {}) {
  keys(raw, ['version','enabledPacks','enabledCapabilities','allowWrites','timeoutMs','target','server','backends'], 'config');
  if (raw.version !== 1) fail('Configuration version must be 1.');
  const enabledPacks = strings(raw.enabledPacks ?? [], 'enabledPacks');
  const enabledCapabilities = strings(raw.enabledCapabilities ?? [], 'enabledCapabilities');
  const allowWrites = raw.allowWrites ?? false;
  if (typeof allowWrites !== 'boolean') fail('allowWrites must be boolean.');
  const timeoutMs = integer(raw.timeoutMs ?? 120000, 100, 600000, 'timeoutMs');
  let target = null;
  if (raw.target !== undefined && raw.target !== null) {
    keys(raw.target, ['projectRoot','processId','editorInstanceId'], 'target');
    const projectRoot = absolute(raw.target.projectRoot, baseDir, 'target.projectRoot');
    if (!projectRoot.toLowerCase().endsWith('.uproject')) fail('target.projectRoot must identify the exact .uproject file.');
    target = { projectRoot, processId:integer(raw.target.processId, 1, 2147483647, 'target.processId') };
    if (raw.target.editorInstanceId !== undefined) target.editorInstanceId = text(raw.target.editorInstanceId, 'target.editorInstanceId');
  }
  const serverInput = raw.server ?? {};
  keys(serverInput, ['transport','host','port','tokenEnv'], 'server');
  const transport = serverInput.transport ?? 'stdio';
  if (!['stdio','http'].includes(transport)) fail('server.transport must be stdio or http.');
  let server = { transport };
  if (transport === 'stdio') {
    if (Object.keys(serverInput).some(k => k !== 'transport')) fail('HTTP options do not apply to stdio.');
  } else {
    const host = serverInput.host ?? '127.0.0.1';
    if (!['127.0.0.1','::1'].includes(host)) fail('This host binds only to a literal loopback address.');
    const tokenEnv = envName(serverInput.tokenEnv, 'server.tokenEnv');
    const token = envValue(tokenEnv, env, 'server.tokenEnv');
    if (token.length < 32 || /\s/.test(token)) fail('HTTP token must contain at least 32 non-whitespace characters.');
    server = { transport, host, port:integer(serverInput.port ?? 7337, 1, 65535, 'server.port'), token, tokenEnv };
  }
  const backends = Object.create(null);
  object(raw.backends ?? {}, 'backends');
  for (const [provider, input] of Object.entries(raw.backends ?? {})) {
    if (!providers.has(provider)) fail('Unsupported backend: ' + provider);
    keys(input, ['sourceRoot','compatibilityPatch','transport','rcEndpoint'], 'backend ' + provider);
    const sourceRoot = absolute(input.sourceRoot, baseDir, provider + '.sourceRoot');
    const t = input.transport;
    keys(t, ['type','command','args','cwd','env','inheritEnv','url','headers','headerEnv','bearerTokenEnv'], provider + '.transport');
    let connection;
    if (t.type === 'stdio') {
      if (['url','headers','headerEnv','bearerTokenEnv'].some(k => k in t)) fail('HTTP fields cannot be used for stdio.');
      const inherited = strings(t.inheritEnv ?? [], provider + '.inheritEnv');
      inherited.forEach(n => envName(n, provider + '.inheritEnv'));
      connection = {
        type:'stdio', command:text(t.command, provider + '.command'),
        args:t.args === undefined ? [] : argumentsList(t.args),
        cwd:absolute(t.cwd ?? sourceRoot, baseDir, provider + '.cwd'),
        env:mapStrings(t.env ?? {}, provider + '.env'), inheritEnv:inherited,
      };
    } else if (['streamable-http','sse'].includes(t.type)) {
      if (['command','args','cwd','env','inheritEnv'].some(k => k in t)) fail('Stdio fields cannot be used for HTTP.');
      let url;
      try { url = new URL(text(t.url, provider + '.url')); } catch { fail('Invalid backend URL for ' + provider); }
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.hash) fail('Backend URL must be HTTP(S) without credentials or a fragment.');
      const headers = mapStrings(t.headers ?? {}, provider + '.headers');
      object(t.headerEnv ?? {}, provider + '.headerEnv');
      for (const [header, name] of Object.entries(t.headerEnv ?? {})) {
        if (Object.keys(headers).some(k => k.toLowerCase() === header.toLowerCase())) fail('Duplicate header source: ' + header);
        headers[text(header, 'header name')] = envValue(name, env, provider + '.headerEnv');
      }
      if (t.bearerTokenEnv !== undefined) {
        if (Object.keys(headers).some(k => k.toLowerCase() === 'authorization')) fail('Duplicate authorization source.');
        headers.Authorization = 'Bearer ' + envValue(t.bearerTokenEnv, env, provider + '.bearerTokenEnv');
      }
      for (const [name, value] of Object.entries(headers)) {
        if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n]/.test(value)) fail('Invalid HTTP header.');
        if (['host','content-length','connection','mcp-session-id','mcp-protocol-version'].includes(name.toLowerCase())) fail('Reserved HTTP header: ' + name);
      }
      connection = { type:t.type, url:url.href, headers };
    } else fail('Unsupported transport type for ' + provider);
    backends[provider] = { sourceRoot, transport:connection };
    if (input.compatibilityPatch !== undefined) backends[provider].compatibilityPatch = text(input.compatibilityPatch, 'compatibilityPatch');
    if (input.rcEndpoint !== undefined) {
      if (provider !== 'unrealagentplayer') fail('rcEndpoint is only supported for UnrealAgentPlayer.');
      backends[provider].rcEndpoint = text(input.rcEndpoint, 'rcEndpoint');
    }
  }
  return { version:1, enabledPacks, enabledCapabilities, allowWrites, timeoutMs, target, server, backends };
}

export async function loadConfig(filename, options = {}) {
  const fullPath = path.resolve(filename);
  const contents = await readFile(fullPath, 'utf8');
  if (Buffer.byteLength(contents) > 1024 * 1024) fail('Configuration exceeds 1 MiB.');
  let raw;
  try { raw = JSON.parse(contents); } catch { fail('Configuration is not valid JSON.'); }
  return parseConfig(raw, { baseDir:path.dirname(fullPath), ...options });
}
