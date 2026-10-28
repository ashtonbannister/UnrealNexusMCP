import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProviderProbe, inspectEditorProcess, inspectListenerOwner } from '../src/provider-probes.mjs';

const operations = JSON.parse(await readFile(new URL('../catalog/operations.json', import.meta.url))).operations;
const op = (id) => operations.find((item) => item.id === id);
const result = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

// Source-derived schema facts, not executed upstream imports. UE declarations:
// db-lyon/ue-mcp@62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d
// tests/golden/handler-specs.json + src/tools/pcg.ts (wait_for_generation).
// action-schema.ts maps these facts to params with sources including declared.
const str = (name, required = false) => ({ name, type: 'string', required });
const num = (name, required = false) => ({ name, type: 'number', required });
const bool = (name) => ({ name, type: 'boolean', required: false });
const int = (name, minimum) => ({ name, type: 'integer', required: false, ...(minimum === undefined ? {} : { minimum }) });
const actor = [str('actorLabel'), str('actorPath')];
const inputValues = [num('value_x'), num('value_y'), num('value_z')];
const inputTargets = [int('client_id', 0), int('pie_instance', 0), int('client', 0)];
const ueFacts = {
  'editor.capture_screenshot': ['capture_screenshot', [str('filename', true), str('target'), num('pieInstance'), str('worldPath')]],
  'level.get_actor_details': ['get_actor_details', [...actor, bool('includeProperties'), str('propertyName'), str('world'), int('pieInstance')]],
  'level.save': ['save_level', [bool('force'), bool('includeExternalActors'), bool('commitDeletes')]],
  'asset.save': ['save_asset', [str('assetPath'), { name: 'assetPaths', type: 'string[]', required: false,
    items: { type: 'string', required: true } }, bool('force')]],
  'pcg.connect_nodes': ['connect_pcg_nodes', [str('assetPath', true), str('sourceNode', true), str('sourcePin'), str('targetNode', true), str('targetPin')]],
  'pcg.execute': ['execute_pcg_graph', [...actor, int('seed'), bool('wait'), num('timeoutSeconds')]],
  'pcg.wait_for_generation': [undefined, [...actor, str('componentName'), num('runId'), num('timeoutSeconds'), num('graceSeconds')]],
  'pcg.get_generation_state': ['get_pcg_generation_state', [...actor, str('componentName')]],
  'pie.inject_input': ['pie_inject_input', [str('action_path', true), ...inputValues, ...inputTargets]],
  'pie.inject_input_start': ['pie_inject_input_start', [str('action_path', true), ...inputValues, str('injection_id'), ...inputTargets]],
  'pie.inject_input_update': ['pie_inject_input_update', [str('injection_id', true), ...inputValues]],
  'pie.inject_input_stop': ['pie_inject_input_stop', [str('injection_id', true)]],
};
function ueDescription(operation) {
  const [bridge, params] = ueFacts[`${operation.route.category}.${operation.route.method}`];
  return { tool: operation.route.category, action: operation.route.method, bridge, local: !bridge,
    params: params.map((param) => ({ ...structuredClone(param), sources: ['documented', 'declared'] })), drift: [],
    ...(['execute', 'get_generation_state'].includes(operation.route.method) ? { alternatives: [{ required: true, branches: [['actorLabel'], ['actorPath']] }] } : {}) };
}

// Full assertion-relevant schema of control_editor.screenshot from EngineWire
// 5a17d6d343ef9b40a509068cff73f1bfb4509815, canonical-registry.generated.json.
// Only descriptions are omitted; unused fields and their schema shapes remain.
const vector = (keys) => ({ type: 'object', properties: Object.fromEntries(keys.map((key) => [key, { type: 'number' }])), additionalProperties: false });
const ewInput = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object',
  properties: {
    action: { type: 'string' }, filename: { type: 'string' }, path: { type: 'string' }, resolution: { type: 'string' },
    mode: { type: 'string', enum: ['editor_viewport', 'game_viewport', 'full_editor_window'] },
    window: { type: ['integer', 'string'] }, location: vector(['x', 'y', 'z']), rotation: vector(['pitch', 'yaw', 'roll']),
    returnBase64: { type: 'boolean' }, keepFile: { type: 'boolean' }, waitForShaders: { type: 'boolean' },
    includeMetadata: { type: 'boolean' }, metadata: { type: 'object', additionalProperties: true, 'x-unreal-reflection-boundary': true },
  }, required: ['action'], additionalProperties: false };
const ewDescription = () => ({ operation: 'describe', action: 'screenshot', capability: 'control_editor.screenshot',
  legacyIds: [{ tool: 'control_editor', action: 'screenshot' }, { tool: 'control_editor', action: 'take_screenshot', folded: {} }],
  availability: { status: 'available', reasons: [], requiredPlugins: [], editorStates: ['edit', 'pie', 'simulate'] },
  inputSchema: structuredClone(ewInput) });

// Literal MCP input forms from UAP 4ab7a62eb78612c2ec110f683b6e11f5dea62e95,
// mcp-server/src/unreal_agent_player/registry.py. Annotations omitted only.
const empty = { type: 'object', properties: {}, additionalProperties: false };
const uapTools = () => [
  { name: 'exec_python', inputSchema: { type: 'object', properties: {
    code: { type: 'string' }, context: { type: 'string', enum: ['editor', 'pie'], default: 'editor' },
  }, required: ['code'], additionalProperties: false } },
  { name: 'bridge_status', inputSchema: empty },
  { name: 'pie_start', inputSchema: { type: 'object', properties: {
    mode: { type: 'string', enum: ['PlayInViewport', 'PlayInNewWindow', 'Simulate'], default: 'PlayInViewport' },
    map_path: { type: 'string' }, start_location: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
    wait: { type: 'boolean', default: true }, timeout: { type: 'number', default: 60 },
  }, additionalProperties: false } },
  ...['pie_status', 'pie_stop'].map((name) => ({ name, inputSchema: empty })),
];
const preset = () => ({ Preset: { Groups: [{ ExposedFunctions: ['GetPIEPhase', 'GetPIEElapsedSeconds']
  .map((Name) => ({ UnderlyingFunction: { Name, Arguments: [] } })) }] } });

async function fixture(t, provider, change = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nexus-probe-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const projectRoot = path.join(dir, 'Demo.uproject');
  await writeFile(projectRoot, '{}');
  const target = { processId: 22222, projectRoot, editorInstanceId: 'linux:fixture:22222:500' };
  const processInfo = { processId: target.processId, editorInstanceId: target.editorInstanceId, platform: process.platform,
    executablePath: process.platform === 'win32' ? 'C:\\Engine\\UnrealEditor.exe' : '/opt/UnrealEditor',
    cwd: dir, argv: ['UnrealEditor', projectRoot], commandLine: `UnrealEditor "${projectRoot}"` };
  const calls = [], listeners = [];
  const state = {
    processInfo, target, tools: provider === 'unrealagentplayer' ? uapTools()
      : provider === 'claireon' ? [{ name: 'python_execute' }, { name: 'tool_search' }]
        : provider === 'hayba' ? [{ name: 'python_run', inputSchema: { type: 'object', properties: {
          script: { type: 'string', minLength: 1 }, read_only: { type: 'boolean' }, transaction: { type: 'boolean' },
        }, required: ['script'], additionalProperties: false } }]
          : [{ name: provider === 'ue-mcp' ? 'tools' : 'unreal', inputSchema: empty }],
    status: { mode: 'live', editorConnected: true, answeringPid: target.processId,
      editorTarget: { projectPath: projectRoot }, pluginStaleSource: 'parity', bridgeProtocol: { actionCount: 900 } },
    bridgeStatus: { ok: true, rc_reachable: true, remote_exec_reachable: true,
      nexus_python_dispatch: { attempts: 1, success_field: 'success', post_send_replay: false,
        holds_machine_on_python_error: true,
        project_file: projectRoot, editor_pid: target.processId, rc_endpoint: 'http://127.0.0.1:30010' } },
    native: { pid: target.processId, project: projectRoot, role: 'editor', start: true, stop: true },
    describe: provider === 'enginewire' ? ewDescription() : null,
    reflection: preset(), ...change,
  };
  const connection = { async callTool(name, args, options) {
    calls.push({ name, args, options });
    if (state.call) return state.call(name, args, options);
    if (name === 'tools' && args.method === 'get_status') return result(state.status);
    if (name === 'tools' && args.action === 'describe') {
      if (args.category === 'pcg' && args.method === 'get_generation_state') return result(state.dependencyDescription
        ?? ueDescription({ route: { category: 'pcg', method: 'get_generation_state' } }));
      const operation = operations.find((candidate) => candidate.route.category === args.category && candidate.route.method === args.method);
      return result(state.describe ?? ueDescription(operation));
    }
    if (name === 'unreal' && args.operation === 'describe') return result(state.describe);
    if (name === 'unreal' && args.action === 'get_project_settings') {
      return result({ status: 'success', operation: 'execute', data: { success: true, projectName: 'Demo', projectDir: state.nativeDir ?? dir } });
    }
    if (name === 'bridge_status') return result(state.bridgeStatus);
    if (name === 'exec_python' || name === 'python_run') {
      const nonce = /NEXUS_ID_([0-9a-f]{32}):/u.exec(args.code ?? args.script)?.[1];
      assert.ok(nonce, 'only a fixed nonce-framed identity probe is sent');
      const frame = `NEXUS_ID_${nonce}:${Buffer.from(JSON.stringify(state.native)).toString('base64')}`;
      return result({ ok: true, stdout: (state.frame ? state.frame(frame) : frame) + '\n', stderr: '',
        ...(name === 'python_run' ? { read_only_declared: true, output_complete: true, output_truncated: false,
          stdout_truncated: false, stderr_truncated: false, ...state.capture } : {}) });
    }
    throw new Error('Unexpected probe: ' + name);
  } };
  const options = { provider, connection, tools: state.tools, target, endpointUrl: 'http://127.0.0.1:8080/mcp',
    nativeEndpoint: 'http://127.0.0.1:52342',
    processInspector: async () => state.processInfo,
    listenerInspector: async (endpoint, pid) => { listeners.push({ endpoint, pid }); if (state.listenerError) throw new Error('listener mismatch'); return { processId: pid }; },
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'http://127.0.0.1:30010/remote/preset/UAP_Preset');
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
      return new Response(JSON.stringify(state.reflection), { status: state.httpStatus ?? 200 });
    },
  };
  return { state, calls, listeners, options, probe: createProviderProbe(options) };
}

test('OS process inspector supplies a creation identity, never a PID-alive boolean', async () => {
  if (!['linux', 'win32'].includes(process.platform)) return;
  const first = await inspectEditorProcess(process.pid), second = await inspectEditorProcess(process.pid);
  assert.equal(first.processId, process.pid); assert.equal(first.editorInstanceId, second.editorInstanceId);
  assert.ok(first.executablePath); assert.ok(first.argv.length);
  assert.notEqual(first.editorInstanceId, String(process.pid));
  await assert.rejects(inspectEditorProcess(0), /processId/u);
});

test('listener attestation refuses remote URLs, DNS hosts, credentials and invalid PID before OS lookup', async () => {
  for (const endpoint of ['https://127.0.0.1:3', 'http://example.com:3', 'http://localhost:3', 'http://x:y@127.0.0.1:3']) {
    await assert.rejects(inspectListenerOwner(endpoint, 1), /loopback/u);
  }
  await assert.rejects(inspectListenerOwner('http://127.0.0.1:3', -1), /PID/u);
});

test('all 12 selected UE routes fit source-derived action parameter facts', async (t) => {
  const f = await fixture(t, 'ue-mcp');
  for (const operation of operations.filter((item) => item.provider === 'ue-mcp')) {
    assert.equal(await f.probe.supports(operation), true, operation.id);
  }
  assert.ok(f.calls.every((call) => call.name === 'tools' && ['call', 'describe'].includes(call.args.action)));
  assert.ok(f.calls.filter((call) => call.args.action === 'call').every((call) => call.args.method === 'get_status'));
});

test('UE status configuration alone does not prove native editor identity', async (t) => {
  for (const bad of [
    { answeringPid: undefined }, { answeringPid: 333 }, { mode: 'disconnected' },
    { editorConnected: false }, { pluginStaleSource: 'build-timestamps' }, { editorTargetMismatch: true },
    { bridgeProtocol: { mismatch: 'different ABI' } },
  ]) {
    const f = await fixture(t, 'ue-mcp'); Object.assign(f.state.status, bad);
    await assert.rejects(f.probe.attestIdentity(), /UE-MCP/u);
  }
});

test('UE OS project argument and start epoch must corroborate native status', async (t) => {
  const f = await fixture(t, 'ue-mcp');
  f.state.processInfo.argv = ['UnrealEditor'];
  await assert.rejects(f.probe.attestIdentity(), /exactly one/u);
  f.state.processInfo.argv = ['UnrealEditor', f.state.target.projectRoot];
  f.state.processInfo.editorInstanceId += '-reused';
  await assert.rejects(f.probe.attestIdentity(), /attested Unreal editor/u);
  assert.equal(f.calls.length, 1, 'changed OS epoch rejects before another native call');
});

test('UE discovery refuses undeclared fields, drift, wrong action and compiled handler spec drift', async (t) => {
  const operation = op('level.save.current');
  for (const alter of [
    (d) => { d.params.find((p) => p.name === 'commitDeletes').sources = ['documented']; },
    (d) => { d.params.find((p) => p.name === 'commitDeletes').type = 'string'; },
    (d) => { d.drift = ['commitDeletes']; }, (d) => { d.action = 'save_all'; },
  ]) {
    const f = await fixture(t, 'ue-mcp'); f.state.describe = ueDescription(operation); alter(f.state.describe);
    assert.equal(await f.probe.supports(operation), false);
  }
  const f = await fixture(t, 'ue-mcp');
  f.state.status.deployedPlugin = { handlerSpecDrift: ['save_level'] };
  assert.equal(await f.probe.supports(operation), false);
});

test('discovery rejects extra required parameters and unmet alternatives', async (t) => {
  const operation = op('pcg.generation.execute');
  const f = await fixture(t, 'ue-mcp'); f.state.describe = ueDescription(operation);
  f.state.describe.alternatives = [{ required: true, branches: [['actorLabel']] }];
  assert.equal(await f.probe.supports(operation), false);
  f.state.describe.alternatives = [];
  f.state.describe.params.push({ ...str('newRequired', true), sources: ['declared'] });
  assert.equal(await f.probe.supports(operation), false);
});

test('UE Node-local PCG waiter requires its exact native dependency to be registered and compatible', async (t) => {
  const f = await fixture(t, 'ue-mcp');
  f.state.dependencyDescription = ueDescription({ route: { category: 'pcg', method: 'get_generation_state' } });
  f.state.dependencyDescription.bridge = 'different_method';
  assert.equal(await f.probe.supports(op('pcg.generation.wait')), false);
  f.state.dependencyDescription.bridge = 'get_pcg_generation_state';
  f.state.dependencyDescription.params = f.state.dependencyDescription.params.filter((parameter) => parameter.name !== 'componentName');
  assert.equal(await f.probe.supports(op('pcg.generation.wait')), false);
});

test('a non-Unreal process cannot be attested even if native/config claims match', async (t) => {
  const f = await fixture(t, 'ue-mcp'); f.state.processInfo.executablePath = '/usr/bin/node';
  await assert.rejects(f.probe.attestIdentity(), /Unreal editor/u); assert.equal(f.calls.length, 0);
});

test('EngineWire selected screenshot accepts actual pinned schema and all-state declaration', async (t) => {
  const f = await fixture(t, 'enginewire');
  assert.equal(await f.probe.supports(op('screenshot.viewport.current')), true);
  assert.ok(f.listeners.length >= 2);
  assert.deepEqual(f.calls.map((item) => item.args.operation), ['execute', 'describe']);
  assert.equal(f.calls[0].args.action, 'get_project_settings');
});

test('EngineWire refuses unprovable stdio proxy, wrong listener, project and relative ambiguity', async (t) => {
  const f = await fixture(t, 'enginewire');
  await assert.rejects(createProviderProbe({ ...f.options, endpointUrl: undefined }).attestIdentity(), /direct local/u);
  f.state.listenerError = true; await assert.rejects(f.probe.attestIdentity(), /listener/u);
  f.state.listenerError = false; f.state.nativeDir = os.tmpdir();
  await assert.rejects(f.probe.attestIdentity(), /different project/u);
});

test('EngineWire availability is not inferred from describe existence', async (t) => {
  for (const alter of [
    (d) => { d.availability.status = 'disabled'; },
    (d) => { d.availability.requiredPlugins = ['UnknownPlugin']; },
    (d) => { d.availability.editorStates = ['edit']; },
    (d) => { d.legacyIds = [{ tool: 'control_editor', action: 'different' }]; },
    (d) => { delete d.inputSchema.properties.keepFile; },
    (d) => { d.inputSchema.anyOf = [{ required: ['unknown'] }]; },
  ]) {
    const f = await fixture(t, 'enginewire'); alter(f.state.describe);
    assert.equal(await f.probe.supports(op('screenshot.viewport.current')), false);
  }
});

test('UAP lifecycle support proves both native channels and reflected polling functions', async (t) => {
  const f = await fixture(t, 'unrealagentplayer');
  for (const id of ['pie.start.viewport', 'pie.stop', 'pie.status']) assert.equal(await f.probe.supports(op(id)), true);
  assert.ok(f.calls.every((c) => ['exec_python', 'bridge_status'].includes(c.name)), 'no lifecycle mutation during discovery');
  assert.ok(f.listeners.every((l) => l.endpoint === 'http://127.0.0.1:30010' && l.pid === 22222));
  const identity = await f.probe.attestIdentity(); assert.equal(identity.evidence.sourceRevisionProven, false);
});

test('UAP RC endpoint must match live client binding, not only declared target', async (t) => {
  const f = await fixture(t, 'unrealagentplayer');
  const otherPort = createProviderProbe({ ...f.options, rcEndpoint: 'http://127.0.0.1:30011' });
  await assert.rejects(otherPort.attestIdentity(), /live client binding/u);
  assert.deepEqual(f.calls.map((call) => call.name), ['bridge_status']);
  f.state.bridgeStatus.nexus_python_dispatch.rc_endpoint = 'http://127.0.0.1:30011';
  assert.equal((await otherPort.attestIdentity()).identityVerified, true);
});

test('UAP lifecycle is held unless live client proves patched single-dispatch semantics', async (t) => {
  for (const marker of [undefined, { attempts: 3, success_field: 'success', post_send_replay: false },
    { attempts: 1, success_field: 'result', post_send_replay: false },
    { attempts: 1, success_field: 'success', post_send_replay: true }]) {
    const f = await fixture(t, 'unrealagentplayer'); f.state.bridgeStatus.nexus_python_dispatch = marker;
    await assert.rejects(f.probe.supports(op('pie.start.viewport')), /single-dispatch/u);
  }
});

test('UAP rejects mismatched Python PID/project/role and an unreachable independent RC channel', async (t) => {
  for (const change of [{ pid: 1234 }, { project: os.tmpdir() }, { role: 'game' }]) {
    const f = await fixture(t, 'unrealagentplayer'); Object.assign(f.state.native, change);
    await assert.rejects(f.probe.attestIdentity(), /different/u);
  }
  const f = await fixture(t, 'unrealagentplayer'); f.state.bridgeStatus.rc_reachable = false;
  await assert.rejects(f.probe.attestIdentity(), /both live/u);
});

test('UAP native Python method and reflected function absence cannot become a true support claim', async (t) => {
  const f = await fixture(t, 'unrealagentplayer'); f.state.native.stop = false;
  assert.equal(await f.probe.supports(op('pie.stop')), false);
  f.state.native.stop = true; f.state.reflection.Preset.Groups[0].ExposedFunctions.pop();
  assert.equal(await f.probe.supports(op('pie.stop')), false);
  f.state.reflection = preset(); f.state.reflection.Preset.Groups[0].ExposedFunctions[0].UnderlyingFunction.Arguments = [{ Name: 'newParam', Type: 'FString' }];
  assert.equal(await f.probe.supports(op('pie.status')), false);
});

test('UAP refuses a schema that silently drops fixed wait or context', async (t) => {
  const f = await fixture(t, 'unrealagentplayer'); delete f.state.tools.find((d) => d.name === 'pie_start').inputSchema.properties.wait;
  assert.equal(await f.probe.supports(op('pie.start.viewport')), false);
  delete f.state.tools.find((d) => d.name === 'exec_python').inputSchema.properties.context;
  await assert.rejects(f.probe.attestIdentity(), /diagnostics/u);
});

test('Python frames must be unique, exact nonce matches, canonical base64 and bounded', async (t) => {
  for (const frame of [() => 'no frame', (line) => line + '\n' + line,
    (line) => 'log prefix ' + line, (line) => line.replace(/:.*$/u, ':!!!!'),
    (line) => line.replace(/:.*$/u, ':' + 'A'.repeat(17000))]) {
    const f = await fixture(t, 'unrealagentplayer', { frame });
    await assert.rejects(f.probe.attestIdentity(), /frame/u);
  }
});

test('native errors and ambiguous JSON are never identity evidence', async (t) => {
  for (const nativeResult of [
    { ...result({ mode: 'live' }), isError: true },
    { content: [{ type: 'text', text: '{}' }, { type: 'text', text: '{}' }] },
    result({ success: false }),
  ]) {
    const f = await fixture(t, 'ue-mcp', { call: async () => nativeResult });
    await assert.rejects(f.probe.attestIdentity(), /probe|response|call/u);
  }
});

test('epoch is checked again after native discovery, not only factory creation', async (t) => {
  const f = await fixture(t, 'enginewire'); let count = 0;
  const changing = createProviderProbe({ ...f.options, processInspector: async () => ({ ...f.state.processInfo,
    editorInstanceId: ++count < 3 ? f.state.target.editorInstanceId : 'replacement' }) });
  await assert.rejects(changing.supports(op('screenshot.viewport.current')), /attested Unreal editor/u);
});

test('Claireon identity is proved without running its autosaving Python wrapper', async (t) => {
  const f = await fixture(t, 'claireon');
  assert.equal((await f.probe.attestIdentity()).identityVerified, true);
  assert.equal(f.calls.length, 0); assert.equal(f.listeners.length, 2);
  await assert.rejects(createProviderProbe({ ...f.options, endpointUrl: undefined }).attestIdentity(), /direct local/u);
  assert.equal(await f.probe.supports(op('pie.stop')), false, 'identity never implies specialist capability support');
});

test('Hayba uses only direct advertised read-only nontransactional identity form', async (t) => {
  const f = await fixture(t, 'hayba');
  assert.equal((await f.probe.attestIdentity()).identityVerified, true);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].name, 'python_run');
  assert.ok(f.listeners.every((entry) => entry.endpoint === 'http://127.0.0.1:52342'));
  assert.equal(f.calls[0].args.read_only, true); assert.equal(f.calls[0].args.transaction, false);
  assert.equal(ownProperty(f.calls[0].args, 'allow_unsafe'), false);
  delete f.state.tools[0].inputSchema.properties.read_only;
  await assert.rejects(f.probe.attestIdentity(), /directly advertised/u);
});
function ownProperty(object, name) { return Object.prototype.hasOwnProperty.call(object, name); }

test('Hayba incomplete, truncated or non-read-only receipt cannot attest identity', async (t) => {
  for (const capture of [{ output_complete: false }, { stdout_truncated: true }, { read_only_declared: false }]) {
    const f = await fixture(t, 'hayba', { capture });
    await assert.rejects(f.probe.attestIdentity(), /complete and read-only/u);
  }
});

test('pre-aborted qualification performs no native reads', async (t) => {
  const f = await fixture(t, 'enginewire'), controller = new AbortController(); controller.abort();
  await assert.rejects(f.probe.supports(op('screenshot.viewport.current'), { signal: controller.signal }), /cancelled/u);
  assert.equal(f.calls.length, 0); assert.equal(f.listeners.length, 0);
});

test('cancellation after identity response stops later discovery and is forwarded to native transport', async (t) => {
  const f = await fixture(t, 'ue-mcp'), controller = new AbortController();
  f.state.call = async (name, args, options) => {
    assert.equal(options.signal, controller.signal); controller.abort(); return result(f.state.status);
  };
  await assert.rejects(f.probe.supports(op('level.save.current'), { signal: controller.signal }), /cancelled/u);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].args.method, 'get_status');
});

test('expired overall qualification budget cannot issue a later native request', async (t) => {
  const f = await fixture(t, 'ue-mcp');
  f.state.call = async () => { await new Promise((resolve) => setTimeout(resolve, 15)); return result(f.state.status); };
  await assert.rejects(f.probe.supports(op('level.save.current'), { timeoutMs: 5 }), /deadline/u);
  assert.ok(f.calls.length <= 1);
});
