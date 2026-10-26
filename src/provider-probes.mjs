import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, readlink, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NexusError } from './errors.mjs';

const run = promisify(execFile);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = (message) => { throw new NexusError('IDENTITY_UNPROVEN', message); };
const validPid = (pid) => Number.isSafeInteger(pid) && pid > 0 && pid <= 0x7fffffff;
const IO_LIMIT = 1024 * 1024;
const UE_BRIDGES = new Map([
  ['editor.capture_screenshot', 'capture_screenshot'], ['level.get_actor_details', 'get_actor_details'],
  ['level.save', 'save_level'], ['asset.save', 'save_asset'], ['pcg.connect_nodes', 'connect_pcg_nodes'],
  ['pcg.execute', 'execute_pcg_graph'], ['pcg.get_generation_state', 'get_pcg_generation_state'],
  ['pie.inject_input', 'pie_inject_input'], ['pie.inject_input_start', 'pie_inject_input_start'],
  ['pie.inject_input_update', 'pie_inject_input_update'], ['pie.inject_input_stop', 'pie_inject_input_stop'],
]);

function linuxStart(stat) {
  // comm is parenthesized and can itself contain spaces and parentheses.
  const values = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/u);
  if (!/^\d+$/u.test(values[19] ?? '')) fail('Cannot read process creation identity');
  return values[19];
}

// Used only to obtain the project argument, never to launch a command. Windows
// filenames cannot contain literal double quotes. Require an unambiguous token.
function commandTokens(commandLine) {
  return [...commandLine.matchAll(/"([^"]*)"|([^\s"]+)/gu)].map((m) => m[1] ?? m[2]);
}

/** OS evidence, not a configured PID or a PID-alive test. No shell is invoked.
 * Linux /proc and Windows CIM are supported. macOS/remote hosts fail closed.
 * Creation identity is re-read after gathering evidence to catch PID reuse.
 */
export async function inspectEditorProcess(processId) {
  if (!validPid(processId)) fail('A positive editor processId is required');
  if (process.platform === 'linux') {
    const base = `/proc/${processId}`;
    const before = linuxStart(await readFile(`${base}/stat`, 'utf8'));
    const [boot, executablePath, cwd, command] = await Promise.all([
      readFile('/proc/sys/kernel/random/boot_id', 'utf8'), readlink(`${base}/exe`),
      readlink(`${base}/cwd`), readFile(`${base}/cmdline`, 'utf8'),
    ]);
    const after = linuxStart(await readFile(`${base}/stat`, 'utf8'));
    if (before !== after || !/^[0-9a-f-]{36}$/iu.test(boot.trim())) fail('Process changed while being inspected');
    const argv = command.split('\0').filter(Boolean);
    if (!argv.length || !executablePath || executablePath.endsWith(' (deleted)')) fail('Process executable cannot be verified');
    return { processId, platform: 'linux', executablePath, cwd, argv,
      commandLine: argv.join(' '), editorInstanceId: `linux:${boot.trim()}:${processId}:${before}` };
  }
  if (process.platform === 'win32') {
    const query = `$procRow = Get-CimInstance Win32_Process -Filter 'ProcessId = ${processId}'; `
      + 'if ($null -eq $procRow) { throw "Process missing" }; '
      + '[pscustomobject]@{processId=[int]$procRow.ProcessId; executablePath=$procRow.ExecutablePath; '
      + 'commandLine=$procRow.CommandLine; startTicks=$procRow.CreationDate.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json -Compress';
    const read = async () => JSON.parse((await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query],
      { timeout: 5000, maxBuffer: IO_LIMIT, windowsHide: true })).stdout);
    const before = await read(), after = await read();
    if (before.processId !== processId || before.startTicks !== after.startTicks
      || !/^\d+$/u.test(before.startTicks ?? '') || !before.executablePath || !before.commandLine) {
      fail('Cannot establish Windows process creation identity');
    }
    return { processId, platform: 'win32', executablePath: before.executablePath,
      commandLine: before.commandLine, argv: commandTokens(before.commandLine),
      editorInstanceId: `win32:${processId}:${before.startTicks}` };
  }
  fail('Live process attestation is currently supported only on Linux and Windows');
}

function localEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { fail('A direct local HTTP endpoint is required'); }
  // Literal IPs avoid DNS rebinding and hostname/proxy ambiguity. HTTPS needs a
  // separate qualified deployment, and redirect-following is never enabled.
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.hash) fail('Only literal loopback HTTP endpoints can be attested');
  return { url, port: Number(url.port || 80), host: url.hostname };
}

/** Corroborate which local process owns the actual transport's listening port.
 * All listeners on this port must belong to the selected process. Merely
 * finding one SO_REUSEPORT listener is not proof of the actual connection.
 */
export async function inspectListenerOwner(endpointUrl, processId) {
  const { port } = localEndpoint(endpointUrl);
  if (!validPid(processId)) fail('Invalid listener owner PID');
  if (process.platform === 'linux') {
    const rows = (await Promise.all(['/proc/net/tcp', '/proc/net/tcp6'].map(async (file) => {
      try { return await readFile(file, 'utf8'); } catch (error) {
        if (file.endsWith('tcp6') && error.code === 'ENOENT') return '';
        throw error;
      }
    }))).flatMap((text) => text.trim().split('\n').slice(1).map((row) => row.trim().split(/\s+/u)))
      .filter((row) => row[3] === '0A' && parseInt(row[1]?.split(':')[1], 16) === port);
    const inodes = new Set(rows.map((row) => row[9]));
    if (!inodes.size || [...inodes].some((inode) => !/^\d+$/u.test(inode ?? ''))) fail('Listening socket is missing or ambiguous');
    const links = await Promise.all((await readdir(`/proc/${processId}/fd`)).map(async (fd) => {
      try { return await readlink(`/proc/${processId}/fd/${fd}`); } catch { return ''; }
    }));
    if ([...inodes].some((inode) => !links.includes(`socket:[${inode}]`))) fail('Listening socket is not uniquely owned by the selected editor');
    return { processId, port, method: 'linux-proc-socket-owner' };
  }
  if (process.platform === 'win32') {
    const script = `@(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | `
      + 'Select-Object -ExpandProperty OwningProcess -Unique) | ConvertTo-Json -Compress';
    const owners = JSON.parse((await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 5000, maxBuffer: IO_LIMIT, windowsHide: true })).stdout);
    const list = Array.isArray(owners) ? owners : [owners];
    if (list.length !== 1 || list[0] !== processId) fail('Listening socket is not uniquely owned by the selected editor');
    return { processId, port, method: 'windows-tcp-owner' };
  }
  fail('Socket ownership attestation is unsupported on this host');
}

function pathApi(platform) { return platform === 'win32' ? path.win32 : path.posix; }
async function normalizedPath(value, platform, base) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f]/u.test(value)) fail('Missing or malformed project path');
  const p = pathApi(platform);
  if (!p.isAbsolute(value)) {
    if (!base || !p.isAbsolute(base)) fail('Relative native path lacks a proven resolution base');
    value = p.resolve(base, value);
  }
  // On the live host resolve symlinks/junctions, not just lexical spelling.
  if (platform === process.platform) value = await realpath(value);
  const normalized = p.normalize(value).replace(/[\\/]+$/u, '');
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function requireEditor(processInfo, target) {
  const p = pathApi(processInfo.platform);
  if (processInfo.processId !== target.processId || processInfo.editorInstanceId !== target.editorInstanceId
    || !['linux', 'win32'].includes(processInfo.platform)
    || !/^UnrealEditor(?:-Cmd)?(?:\.exe)?$/iu.test(p.basename(processInfo.executablePath ?? ''))
    || (processInfo.argv ?? []).some((arg) => /^-(?:game|server|run)(?:=|$)/iu.test(arg))) {
    fail('Selected process is not the attested Unreal editor instance');
  }
}

async function projectArgument(processInfo, expected) {
  const args = (processInfo.argv ?? []).filter((arg) => /\.uproject$/iu.test(arg))
    .map((arg) => arg.replace(/^-project=/iu, ''));
  if (args.length !== 1) fail('Editor command line must identify exactly one .uproject');
  const actual = await normalizedPath(args[0], processInfo.platform, processInfo.cwd);
  if (actual !== expected) fail('Editor process was launched for a different project');
}

function payload(result) {
  if (!object(result) || result.isError === true || !Array.isArray(result.content)) fail('Identity/discovery call failed');
  let data = result.structuredContent;
  if (!object(data)) {
    const candidates = [];
    for (const item of result.content) {
      if (item.type !== 'text' || typeof item.text !== 'string') continue;
      try { const parsed = JSON.parse(item.text); if (object(parsed)) candidates.push(parsed); } catch { /* prose */ }
    }
    if (candidates.length !== 1) fail('Identity/discovery response is not one unambiguous JSON envelope');
    [data] = candidates;
  }
  if (data.ok === false || data.success === false || data.status === 'error' || data.bIsError === true) {
    fail('Native identity/discovery probe was refused');
  }
  return data;
}

function routeSchema(operation, extraFixed = {}) {
  const fixed = { ...operation.route.fixed, ...extraFixed };
  const properties = { ...operation.parameters.properties };
  for (const [name, value] of Object.entries(fixed)) {
    properties[name] = { type: typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value, enum: [value] };
  }
  return { type: 'object', properties, required: [...new Set([...(operation.parameters.required ?? []), ...Object.keys(fixed)])] };
}

// A deliberately conservative compatibility check of the forms used by this
// bounded catalogue, NOT a general JSON Schema theorem prover. Unrecognized
// conditional/ref constructs fail closed; native runtime validation still runs.
function covers(native, offered) {
  if (!object(native) || !object(offered) || ['$ref', 'anyOf', 'allOf', 'oneOf', 'not', 'if', 'then', 'else']
    .some((key) => own(native, key))) return false;
  const types = Array.isArray(native.type) ? native.type : [native.type];
  if (!types.includes(offered.type) && !(offered.type === 'integer' && types.includes('number'))
    && !types.includes('any')) return false;
  if (types.includes('any')) return true;
  const fixed = Array.isArray(offered.enum);
  if (native.const !== undefined && (!fixed || !offered.enum.every((v) => v === native.const))) return false;
  if (Array.isArray(native.enum) && (!fixed || !offered.enum.every((v) => native.enum.includes(v)))) return false;
  for (const key of ['minimum', 'minLength', 'minItems']) {
    if (native[key] !== undefined && (offered[key] === undefined || offered[key] < native[key])) {
      if (!fixed || !offered.enum.every((v) => (typeof v === 'number' ? v : [...v].length) >= native[key])) return false;
    }
  }
  for (const key of ['maximum', 'maxLength', 'maxItems']) {
    if (native[key] !== undefined && (offered[key] === undefined || offered[key] > native[key])) {
      if (!fixed || !offered.enum.every((v) => (typeof v === 'number' ? v : [...v].length) <= native[key])) return false;
    }
  }
  if (native.pattern !== undefined && native.pattern !== offered.pattern) {
    if (!fixed || !offered.enum.every((v) => typeof v === 'string' && new RegExp(native.pattern, 'u').test(v))) return false;
  }
  if (native.exclusiveMinimum !== undefined || native.exclusiveMaximum !== undefined
    || native.multipleOf !== undefined || native.contains !== undefined
    || native.dependentRequired !== undefined || native.dependentSchemas !== undefined) return false;
  if (offered.type === 'object') {
    if (!object(native.properties)) return false;
    if ((native.required ?? []).some((key) => !(offered.required ?? []).includes(key))) return false;
    for (const [name, schema] of Object.entries(offered.properties)) {
      // A loose additionalProperties is not proof of a field that a handler reads.
      if (!own(native.properties, name) || !covers(native.properties[name], schema)) return false;
    }
  }
  if (offered.type === 'array' && (!covers(native.items, offered.items)
    || (native.uniqueItems === true && offered.uniqueItems !== true))) return false;
  return true;
}

function summarySchema(summary) {
  if (!object(summary) || summary.truncated === true) return null;
  let type = summary.type;
  if (type === 'enum' || type === 'literal') type = typeof summary.enumValues?.[0];
  let items;
  if (type?.endsWith('[]')) { type = 'array'; items = summarySchema(summary.items); }
  if (type === 'array') items ??= summarySchema(summary.items);
  const result = { type, ...(summary.enumValues ? { enum: summary.enumValues } : {}) };
  for (const key of ['minimum', 'maximum']) if (summary[key] !== undefined) result[key] = summary[key];
  if (type === 'array') result.items = items;
  if (type === 'object') {
    if (!object(summary.properties)) return { type: 'any' }; // explicit declared open object
    result.properties = Object.fromEntries(Object.entries(summary.properties).map(([key, val]) => [key, summarySchema(val)]));
    result.required = Object.entries(summary.properties).filter(([, val]) => val.required).map(([key]) => key);
  }
  return result;
}

function ueSchemaMatches(description, operation) {
  const route = operation.route;
  if (description.tool !== route.category || description.action !== route.method
    || !Array.isArray(description.params) || !Array.isArray(description.drift) || description.drift.length) return false;
  const properties = {}, required = [];
  for (const parameter of description.params) {
    if (typeof parameter.name !== 'string' || own(properties, parameter.name)) return false;
    if (!parameter.sources?.includes('declared')) continue;
    properties[parameter.name] = summarySchema(parameter);
    if (parameter.required) required.push(parameter.name);
  }
  const offered = routeSchema(operation);
  for (const choice of description.alternatives ?? []) {
    if (choice.required && (!Array.isArray(choice.branches)
      || !choice.branches.some((branch) => Array.isArray(branch) && branch.every((key) => offered.required.includes(key))))) return false;
  }
  return covers({ type: 'object', properties, required }, offered);
}

function identityPython(nonce, includeUap = true) {
  // Fixed source and a random hex framing nonce only. No model/user expressions,
  // file reads, writes, imports from project code, or dynamic callable names.
  let code = 'import os, json, base64, unreal\n'
    + '_nexus_editor = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)\n'
    + '_nexus_info = {"pid":os.getpid(), "project":os.path.realpath(unreal.Paths.get_project_file_path()), '
    + '"role":"editor" if _nexus_editor else "game"}\n';
  if (includeUap) code += '_nexus_level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)\n'
    + '_nexus_uap_class = getattr(unreal, "UAPAgentSubsystem", None)\n'
    + '_nexus_uap = unreal.get_editor_subsystem(_nexus_uap_class) if _nexus_uap_class else None\n'
    + '_nexus_info["start"] = callable(getattr(_nexus_level,"editor_request_begin_play",None))\n'
    + '_nexus_info["stop"] = callable(getattr(_nexus_uap,"stop_pie",None))\n';
  return code + `print("NEXUS_ID_${nonce}:" + base64.b64encode(json.dumps(_nexus_info,separators=(",",":")).encode("utf-8")).decode("ascii"))`;
}

function pythonIdentity(result, nonce) {
  const data = payload(result);
  if (data.ok !== true || typeof data.stdout !== 'string' || data.stderr) fail('Python identity probe failed');
  const prefix = `NEXUS_ID_${nonce}:`;
  const lines = data.stdout.split(/\r?\n/u).filter((line) => line.includes(prefix));
  if (lines.length !== 1 || !lines[0].startsWith(prefix)) fail('Missing or ambiguous identity frame');
  const encoded = lines[0].slice(prefix.length);
  if (encoded.length > 16384 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) fail('Malformed identity frame');
  const raw = Buffer.from(encoded, 'base64');
  if (raw.toString('base64') !== encoded) fail('Noncanonical identity frame');
  let decoded;
  try { decoded = JSON.parse(raw.toString('utf8')); } catch { fail('Invalid identity JSON'); }
  if (!object(decoded)) fail('Identity JSON is not an object');
  return decoded;
}

async function readPreset(endpoint, fetchImpl, timeoutMs, signal) {
  const { url } = localEndpoint(endpoint);
  const target = new URL('/remote/preset/UAP_Preset', url);
  const deadline = AbortSignal.timeout(timeoutMs);
  const response = await fetchImpl(target, { method: 'GET', redirect: 'error',
    signal: signal ? AbortSignal.any([deadline, signal]) : deadline });
  if (!response.ok || !response.body) fail('UAP native preset reflection is unavailable');
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > IO_LIMIT) fail('UAP preset reflection exceeded the bounded response limit');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Malformed UAP preset reflection'); }
  if (!Array.isArray(body?.Preset?.Groups)) fail('UAP preset reflection lacks native groups');
  const functions = new Map();
  for (const group of body.Preset.Groups) {
    for (const exposed of group?.ExposedFunctions ?? []) {
      const fn = exposed?.UnderlyingFunction;
      if (!object(fn) || typeof fn.Name !== 'string') continue;
      if (functions.has(fn.Name)) fail('UAP reflected function name is ambiguous');
      functions.set(fn.Name, fn);
    }
  }
  return functions;
}

/** Fixed provider probes. tools is the complete native tools/list descriptor
 * Map (or array), not names or a capability declaration from configuration.
 * endpointUrl must be the SAME direct endpoint used by the MCP transport.
 * Injection hooks are trusted in-process test seams, not JSON configuration.
 */
export function createProviderProbe({ provider, connection, tools, target, endpointUrl, nativeEndpoint,
  rcEndpoint = 'http://127.0.0.1:30010', timeoutMs = 5000,
  processInspector = inspectEditorProcess, listenerInspector = inspectListenerOwner, fetchImpl = fetch }) {
  if (!validPid(target?.processId) || typeof target.editorInstanceId !== 'string' || !target.editorInstanceId
    || typeof target.projectRoot !== 'string' || !/\.uproject$/iu.test(target.projectRoot)) fail('A concrete project and OS-attested process instance are required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) fail('Invalid probe timeout');
  const descriptors = tools instanceof Map ? tools : new Map((tools ?? []).map((tool) => [tool.name, tool]));
  const tool = (name) => descriptors.get(name);
  function requestScope({ signal, timeoutMs: budget = timeoutMs } = {}) {
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('Probe signal must be an AbortSignal');
    if (!Number.isInteger(budget) || budget < 1 || budget > 3600000) fail('Invalid probe request budget');
    const started = performance.now();
    const remaining = () => {
      if (signal?.aborted) throw new NexusError('BACKEND_CANCELLED', 'Read-only provider qualification cancelled; native work is not rolled back.');
      const value = Math.ceil(budget - (performance.now() - started));
      if (value <= 0) throw new NexusError('BACKEND_PROBE_TIMEOUT', 'Provider qualification deadline expired before another probe.');
      return value;
    };
    const read = async (work) => { remaining(); const value = await work(); remaining(); return value; };
    return { remaining, read, signal,
      call: (name, args) => read(() => connection.callTool(name, args, { signal, timeoutMs: Math.min(timeoutMs, remaining()) })),
      listener: (endpoint) => read(() => listenerInspector(endpoint, target.processId)),
      observed: () => read(async () => { const info = await processInspector(target.processId); requireEditor(info, target); return info; }),
    };
  }
  async function attestIdentity(options = {}, scope = requestScope(options)) {
    const { call, observed, listener } = scope;
    const before = await observed();
    const expected = await normalizedPath(target.projectRoot, before.platform);
    let native;
    if (provider === 'ue-mcp') {
      if (!tool('tools')) fail('UE-MCP default micro tools surface is unavailable');
      native = payload(await call('tools', { action: 'call', category: 'project', method: 'get_status', args: {} }));
      if (native.mode !== 'live' || native.editorConnected !== true || native.answeringPid !== target.processId
        || native.editorTargetMismatch === true || native.pluginStaleSource !== 'parity') fail('UE-MCP does not prove this live editor and registered surface');
      if (native.bridgeProtocol?.mismatch) fail('UE-MCP live bridge protocol mismatch');
      const reported = await normalizedPath(native.editorTarget?.projectPath, before.platform, before.cwd);
      if (reported !== expected) fail('UE-MCP is bound to a different project');
      // get_status projectPath is server configuration, not a native project
      // read. Match the OS command line of the native handshake PID as well.
      await projectArgument(before, expected);
    } else if (provider === 'enginewire') {
      if (!tool('unreal')) fail('EngineWire public unreal surface is unavailable');
      localEndpoint(endpointUrl);
      await listener(endpointUrl);
      const receipt = payload(await call('unreal', { operation: 'execute', tool: 'inspect', action: 'get_project_settings', params: {} }));
      native = receipt.data;
      if (receipt.status !== 'success' || !object(native) || native.success !== true) fail('EngineWire project settings probe did not succeed');
      const projectDir = await normalizedPath(native.projectDir, before.platform, pathApi(before.platform).dirname(before.executablePath));
      if (projectDir !== pathApi(before.platform).dirname(expected)) fail('EngineWire reports a different project directory');
      await projectArgument(before, expected);
    } else if (provider === 'unrealagentplayer') {
      if (!covers(tool('exec_python')?.inputSchema, { type: 'object', properties: {
        code: { type: 'string' }, context: { type: 'string', enum: ['editor'] },
      }, required: ['code', 'context'] }) || !covers(tool('bridge_status')?.inputSchema, {
        type: 'object', properties: {}, required: [],
      })) fail('UAP fixed identity diagnostics are not advertised');
      // The reviewed compatibility patch binds both channels explicitly;
      // a declaration in host JSON alone cannot reconfigure upstream clients.
      const rc = localEndpoint(rcEndpoint);
      if (rc.host !== '127.0.0.1' || !['', '/'].includes(rc.url.pathname)
        || rc.url.search) fail('UAP requires an explicitly bound local RC endpoint');
      await listener(rcEndpoint);
      const status = payload(await call('bridge_status', {}));
      if (status.ok !== true || status.rc_reachable !== true || status.remote_exec_reachable !== true) fail('UAP RC and Python channels are not both live');
      const dispatch = status.nexus_python_dispatch;
      if (dispatch?.attempts !== 1 || dispatch.success_field !== 'success' || dispatch.post_send_replay !== false
        || dispatch.holds_machine_on_python_error !== true) {
        fail('UAP live single-dispatch compatibility marker is absent');
      }
      if (dispatch.editor_pid !== target.processId || dispatch.rc_endpoint !== rc.url.origin
        || await normalizedPath(dispatch.project_file, before.platform, before.cwd) !== expected) {
        fail('UAP live client binding does not match the selected project/PID/RC endpoint');
      }
      const nonce = randomBytes(16).toString('hex');
      native = pythonIdentity(await call('exec_python', { code: identityPython(nonce), context: 'editor' }), nonce);
      if (native.pid !== target.processId || native.role !== 'editor') fail('UAP Python channel reached a different process or role');
      if (await normalizedPath(native.project, before.platform, before.cwd) !== expected) fail('UAP Python channel reached a different project');
    } else if (provider === 'claireon') {
      // Do not execute Python to discover identity: the unpatched wrapper can
      // autosave before running even a read-only script. A direct editor-owned
      // listener plus its OS project argument proves identity without that call.
      if (!tool('python_execute') || !tool('tool_search')) fail('Claireon public two-tool surface is unavailable');
      localEndpoint(endpointUrl);
      await listener(endpointUrl);
      await projectArgument(before, expected);
      native = { method: 'direct-editor-listener' };
    } else if (provider === 'hayba') {
      const endpoint = localEndpoint(nativeEndpoint);
      if (endpoint.host !== '127.0.0.1' || !['', '/'].includes(endpoint.url.pathname) || endpoint.url.search) {
        fail('Hayba native endpoint must match its explicit local UE_TCP_PORT binding');
      }
      await listener(nativeEndpoint);
      const schema = tool('python_run')?.inputSchema;
      if (!covers(schema, { type: 'object', properties: {
        script: { type: 'string', minLength: 1 }, read_only: { type: 'boolean', enum: [true] },
        transaction: { type: 'boolean', enum: [false] },
      }, required: ['script', 'read_only', 'transaction'] })) fail('Hayba fixed read-only identity form is not directly advertised');
      const nonce = randomBytes(16).toString('hex');
      const result = await call('python_run', { script: identityPython(nonce, false), read_only: true, transaction: false });
      const facts = payload(result);
      if (facts.read_only_declared !== true || facts.output_complete !== true || facts.output_truncated !== false
        || facts.stdout_truncated !== false || facts.stderr_truncated !== false) fail('Hayba identity output is not complete and read-only');
      native = pythonIdentity(result, nonce);
      if (native.pid !== target.processId || native.role !== 'editor') fail('Hayba native channel reached a different process or role');
      if (await normalizedPath(native.project, before.platform, before.cwd) !== expected) fail('Hayba native channel reached a different project');
    } else {
      fail('No qualified identity probe exists for this optional provider');
    }
    const after = await observed();
    if (after.editorInstanceId !== before.editorInstanceId) fail('Editor restarted during native identity probe');
    if (provider === 'enginewire' || provider === 'claireon') await listener(endpointUrl);
    if (provider === 'unrealagentplayer') await listener(rcEndpoint);
    if (provider === 'hayba') await listener(nativeEndpoint);
    scope.identified = { native, process: after, projectRoot: expected };
    return { identityVerified: true, target: { ...target }, evidence: {
      provider, processId: after.processId, editorInstanceId: after.editorInstanceId,
      projectRoot: expected, platform: after.platform,
      proof: provider === 'ue-mcp' ? 'native-handshake-pid+os-project-argument'
        : provider === 'enginewire' ? 'direct-listener-owner+native-project-settings+os-project-argument'
          : provider === 'claireon' ? 'direct-listener-owner+os-project-argument'
            : provider === 'hayba' ? 'native-python-pid-project+fixed-tcp-listener-owner+os-process-epoch'
              : 'native-python-pid-project+rc-listener-owner',
      sourceRevisionProven: false,
    } };
  }

  async function supports(operation, options = {}) {
    if (operation?.provider !== provider) return false;
    const scope = requestScope(options);
    const { call, observed, listener } = scope;
    await attestIdentity(options, scope);
    const identity = scope.identified;
    if (provider === 'ue-mcp' && operation.route.kind === 'ue-micro') {
      const description = payload(await call('tools', { action: 'describe', category: operation.route.category, method: operation.route.method }));
      const key = `${operation.route.category}.${operation.route.method}`;
      if (key !== 'pcg.wait_for_generation' && (!UE_BRIDGES.has(key) || description.bridge !== UE_BRIDGES.get(key))) return false;
      if (description.bridge && identity.native.deployedPlugin?.handlerSpecDrift?.includes(description.bridge)) return false;
      if (!ueSchemaMatches(description, operation)) return false;
      if (key === 'pcg.wait_for_generation') {
        // This Node-local waiter indirectly calls a native PCG method. Its own
        // descriptor survives when the native PCG plugin is absent, so proving
        // the wrapper exists is insufficient. Describe its exact dependency.
        if (description.local !== true || description.bridge !== undefined) return false;
        const dependency = payload(await call('tools', { action: 'describe', category: 'pcg', method: 'get_generation_state' }));
        if (dependency.bridge !== 'get_pcg_generation_state'
          || identity.native.deployedPlugin?.handlerSpecDrift?.includes(dependency.bridge)) return false;
        const selector = { route: { kind: 'ue-micro', category: 'pcg', method: 'get_generation_state', fixed: {} },
          parameters: { type: 'object', properties: {
            actorPath: operation.parameters.properties.actorPath, componentName: operation.parameters.properties.componentName,
          }, required: ['actorPath', 'componentName'] } };
        if (!ueSchemaMatches(dependency, selector)) return false;
      }
    } else if (provider === 'enginewire' && operation.route.kind === 'enginewire') {
      const description = payload(await call('unreal', { operation: 'describe', tool: operation.route.tool, action: operation.route.action }));
      if (description.operation !== 'describe' || description.availability?.status !== 'available'
        || !Array.isArray(description.availability.requiredPlugins) || description.availability.requiredPlugins.length
        || !Array.isArray(description.availability.editorStates)
        || !['edit', 'pie', 'simulate'].every((state) => description.availability.editorStates.includes(state))
        || !description.legacyIds?.some((id) => id.tool === operation.route.tool && id.action === operation.route.action)
        || !covers(description.inputSchema, routeSchema(operation, { action: operation.route.action }))) return false;
    } else if (provider === 'unrealagentplayer' && operation.route.kind === 'direct') {
      const names = new Set(['pie_start', 'pie_stop', 'pie_status']);
      if (!names.has(operation.route.tool) || !covers(tool(operation.route.tool)?.inputSchema, routeSchema(operation))) return false;
      if ((operation.route.tool === 'pie_start' && identity.native.start !== true)
        || (operation.route.tool === 'pie_stop' && identity.native.stop !== true)) return false;
      const reflected = await scope.read(() => readPreset(rcEndpoint, fetchImpl, Math.min(timeoutMs, scope.remaining()), scope.signal));
      // These are the precise native functions used by the pinned status /
      // start / stop polling paths. Version strings alone prove none of this.
      for (const name of ['GetPIEPhase', 'GetPIEElapsedSeconds']) {
        const fn = reflected.get(name);
        if (!fn || !Array.isArray(fn.Arguments) || fn.Arguments.length !== 0) return false;
      }
      await listener(rcEndpoint);
    } else return false;
    // Discovery could span a process exit, too. This does not eliminate a race
    // with another direct client; native guards remain responsible at dispatch.
    await observed();
    return true;
  }
  return { attestIdentity, supports };
}
