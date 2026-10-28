import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import manifest from '../catalog/compatibility-patches.json' with { type: 'json' };

const entry = manifest.patches.find((patch) => patch.id === 'uap-nexus-no-replay-v1');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const patch = await readFile(new URL('../' + entry.file, import.meta.url), 'utf8');

test('UAP reviewed compatibility patch is content-addressed and opt-in', () => {
  assert.equal(sha(patch), entry.sha256);
  assert.equal(entry.baseCommit, '4ab7a62eb78612c2ec110f683b6e11f5dea62e95');
  assert.ok(patch.includes('nexus_no_replay: bool = False'));
  for (const name of ['NEXUS_UAP_PROJECT_FILE', 'NEXUS_UAP_EDITOR_PID', 'NEXUS_UAP_RC_PORT']) assert.ok(patch.includes(name));
  assert.ok(patch.includes('"post_send_replay": False'));
  assert.ok(patch.includes('+    if resp.get("success") is True:'));
});

// Apply unified text hunks in memory. This verifies the exact checked-in source
// delta without mutating/importing an upstream checkout or creating a venv.
function applyInMemory(source, filePatch) {
  const lines = source.split('\n'), output = []; let position = 0;
  const diff = filePatch.split('\n');
  for (let i = 0; i < diff.length; i++) {
    const match = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/u.exec(diff[i]);
    if (!match) continue;
    const at = Number(match[1]) - 1;
    assert.ok(at >= position); output.push(...lines.slice(position, at)); position = at;
    while (i + 1 < diff.length && !diff[i + 1].startsWith('@@ ') && !diff[i + 1].startsWith('diff --git ')) {
      const row = diff[++i];
      if (row === '' && i === diff.length - 1) break;
      if (row[0] === ' ' || row[0] === '-') {
        assert.equal(lines[position++], row.slice(1), 'patch context must match pinned source exactly');
      }
      if (row[0] === ' ' || row[0] === '+') output.push(row.slice(1));
    }
  }
  output.push(...lines.slice(position));
  return output.join('\n');
}

// Only the explicitly named, reviewed patched methods are compiled into an
// isolated namespace with fake sockets/clients. No upstream module imports,
// TCP/UDP traffic, editor process, project code or native plugin is executed.
const harness = String.raw`
import ast, asyncio, json, pathlib, sys, types, uuid
sources = json.load(sys.stdin)
class AgentError(Exception):
    def __init__(self, code, message, recoverable=True, retry_hint=None):
        super().__init__(message)
        self.code, self.message, self.recoverable = code, message, recoverable
        self.retry_hint = retry_hint
codes = types.SimpleNamespace(UE_CONNECTION_RESET='reset', UE_CROSSED_RESPONSE='crossed',
    UE_REMOTE_EXEC_OFF='offline', PYTHON_RUNTIME='python', PYTHON_SYNTAX='syntax')
class Connection:
    def __init__(self, state): self.state = state
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def settimeout(self, value): pass
    def sendall(self, value):
        self.state['sends'] += 1
        if self.state.get('send_error'): raise OSError('send failed after partial send')
class Listener:
    def __init__(self, state): self.state = state
    def setsockopt(self, *args): pass
    def bind(self, *args): pass
    def listen(self, *args): pass
    def settimeout(self, *args): pass
    def getsockname(self): return ('127.0.0.1', 12345)
    def accept(self):
        self.state['accepts'] += 1
        if self.state['accepts'] <= self.state.get('preconnect_timeouts', 0): raise TimeoutError()
        return Connection(self.state), ('127.0.0.1', 3333)
    def close(self): pass
class Multicast:
    def sendto(self, *args): pass
    def close(self): pass
state = {'sends': 0, 'accepts': 0}
socket = types.SimpleNamespace(AF_INET=1, SOCK_STREAM=1, SOL_SOCKET=1, SO_REUSEADDR=1,
    socket=lambda *args: Listener(state))
namespace = {'AgentError': AgentError, 'ErrorCode': codes, 'Any': object, 'pathlib': pathlib,
    'socket': socket, 'uuid': uuid, 'time': types.SimpleNamespace(sleep=lambda n: None, monotonic=lambda: 0.0),
    'SUBSYSTEM_OBJECT_PATH': 'fixture'}
tree = ast.parse(sources['transport.py'])
klass = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'PythonRemoteExecClient')
methods = {'__init__', 'exec_python', '_exec_python_once', '_run_on_node', '_matches_project', '_matches_instance'}
constants = {'MULTICAST_GROUP', 'MULTICAST_PORT', 'T_OPEN_CONNECTION', 'T_COMMAND', 'T_CLOSE_CONNECTION',
    'CONNECTION_RETRIES', 'RETRY_BACKOFF'}
klass.body = [node for node in klass.body if
    isinstance(node, ast.FunctionDef) and node.name in methods or
    isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id in constants for target in node.targets)]
module = ast.Module(body=ast.parse('from __future__ import annotations').body + [klass], type_ignores=[])
exec(compile(ast.fix_missing_locations(module), '<isolated reviewed UAP methods>', 'exec'), namespace)
Client = namespace['PythonRemoteExecClient']

def expect_error(fn, code):
    try: fn()
    except AgentError as error:
        assert error.code == code, (error.code, code)
        assert error.recoverable is False
        return
    raise AssertionError('expected refusal')

client = Client(nexus_no_replay=True)
assert client.nexus_no_replay is True and Client().nexus_no_replay is False
attempts = []
def reset(*args, **kwargs):
    attempts.append(True)
    raise AgentError(codes.UE_CONNECTION_RESET, 'reset')
client._exec_python_once = reset
expect_error(lambda: client.exec_python('fixed'), codes.UE_CONNECTION_RESET)
assert len(attempts) == 1
client._exec_python_once = lambda *args, **kw: {'success': True, 'result': 'None', 'output': []}
assert client.exec_python('fixed')['success'] is True
for response in [{'success': False, 'result': 'success'}, {'result': 'success'}, None]:
    client._exec_python_once = lambda *args, **kw: response
    expect_error(lambda: client.exec_python('fixed'), codes.PYTHON_RUNTIME)

def wire_client(answer, **facts):
    state.clear(); state.update({'sends': 0, 'accepts': 0, **facts})
    client = Client(nexus_no_replay=True, node_project_substr='/fixture/Demo.uproject', node_instance='pid:1234')
    client._encode = lambda *args, **kw: b'fixed'
    client._read_command_result = lambda *args: answer
    client._make_multicast_socket = lambda: Multicast()
    client._cached_node = lambda: {'node': 'native', 'pid': 1234}
    client._ping_node = lambda *args: True
    client._discover_nodes = lambda *args: (_ for _ in ()).throw(AssertionError('post-send rediscovery'))
    return client
for answer, code in [((None, None), codes.UE_CONNECTION_RESET),
    ((None, {'source': 'foreign'}), codes.UE_CROSSED_RESPONSE)]:
    client = wire_client(answer)
    expect_error(lambda: client.exec_python('fixed'), code)
    assert state['sends'] == 1 and state['accepts'] == 1
client = wire_client((None, None), send_error=True)
expect_error(lambda: client.exec_python('fixed'), codes.UE_CONNECTION_RESET)
assert state['sends'] == 1
client = wire_client(({'success': True, 'result': 'None'}, None), preconnect_timeouts=2)
assert client.exec_python('fixed')['success'] is True
assert state['sends'] == 1 and state['accepts'] == 3
assert client._matches_instance({'pid': 1234, 'role': 'editor'})
assert not client._matches_instance({'pid': 1234, 'role': 'game'})
assert not client._matches_instance({'pid': 1235, 'role': 'editor'})
assert client._matches_project({'project': '/fixture/Demo.uproject'})
assert not client._matches_project({'project': '/fixture/Demo.uproject-extra'})
assert not client._matches_project({'project': 'Demo.uproject'})

def compile_function(filename, name, values):
    body = ast.parse(sources[filename]).body
    function = next(node for node in body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name)
    mod = ast.Module(body=ast.parse('from __future__ import annotations').body + [function], type_ignores=[])
    exec(compile(ast.fix_missing_locations(mod), '<isolated reviewed UAP function>', 'exec'), values)
    return values[name]
class RC:
    _base = 'http://127.0.0.1:30011'
    async def call_function(self, *args, **kwargs): return {'ReturnValue': 'Playing'}
client._discover_endpoint = lambda: ('127.0.0.1', 1)
status = compile_function('status.py', 'bridge_status', dict(namespace))
marker = asyncio.run(status(rc=RC(), py_exec=client))['nexus_python_dispatch']
assert marker == {'attempts': 1, 'success_field': 'success', 'post_send_replay': False,
    'holds_machine_on_python_error': True,
    'project_file': '/fixture/Demo.uproject', 'editor_pid': 1234, 'rc_endpoint': 'http://127.0.0.1:30011'}
client.nexus_no_replay = False
assert asyncio.run(status(rc=RC(), py_exec=client))['nexus_python_dispatch'] is None
tool = compile_function('python_exec.py', 'exec_python', {**namespace,
    'error_response': lambda code, text, **kw: {'ok': False, 'code': code}})
class Py:
    def exec_python(self, code): return {'success': True, 'result': 'None', 'output': [{'type': 'Info', 'output': 'fixed\n'}]}
assert asyncio.run(tool(rc=None, py_exec=Py(), code='fixed'))['ok'] is True

released = []
machine = types.SimpleNamespace(take_sticky=lambda action: ('grant', None), give_back=lambda grant: released.append(grant))
pie_start = compile_function('pie.py', 'pie_start', {**namespace, '_machine': machine,
    'PIE_START_TIMEOUT_SECONDS': 60.0})
class FailedPython:
    nexus_no_replay = True
    def exec_python(self, code): raise AgentError(codes.UE_CONNECTION_RESET, 'unknown outcome', recoverable=False)
failed_python = FailedPython()
expect_error(lambda: asyncio.run(pie_start(rc=None, py_exec=failed_python)), codes.UE_CONNECTION_RESET)
assert released == [], 'Nexus retains its machine grant until external reconciliation'
failed_python.nexus_no_replay = False
expect_error(lambda: asyncio.run(pie_start(rc=None, py_exec=failed_python)), codes.UE_CONNECTION_RESET)
assert released == ['grant'], 'stock callers retain stock behavior'

# Build-server config is exercised with inert fake clients and an in-memory
# project Path facade; no server, files, baseline store or GUI driver is started.
captured = {}
class Project:
    def __init__(self, value): self.value = value
    def is_absolute(self): return self.value.startswith('/')
    @property
    def suffix(self): return pathlib.PurePosixPath(self.value).suffix
    def is_file(self): return True
    def resolve(self): return self
    def as_posix(self): return self.value
    @classmethod
    def home(cls): return pathlib.Path('/fixture')
env = {}
def new_rc(**kw): captured['rc_options'] = kw; return object()
def new_py(**kw): captured['py_options'] = kw; return object()
values = {**namespace, 'os': types.SimpleNamespace(environ=env), 'Path': Project,
    'RemoteControlClient': new_rc, 'PythonRemoteExecClient': new_py,
    'Server': lambda name: object(), 'register_all': lambda *args, **kw: captured.update(kw),
    'BaselineStore': lambda p: object(), 'UIADriver': lambda: object()}
build = compile_function('server.py', 'build_server', values)
build(); assert captured['py_options'] == {}
env.update(NEXUS_UAP_PROJECT_FILE='/fixture/Demo.uproject', NEXUS_UAP_EDITOR_PID='1234', NEXUS_UAP_RC_PORT='30011')
build()
assert captured['py_options'] == {'node_project_substr': '/fixture/Demo.uproject', 'node_instance': 'pid:1234', 'nexus_no_replay': True}
assert captured['rc_options'] == {'host': '127.0.0.1', 'port': 30011}
for key in list(env):
    saved = env.pop(key)
    try: build()
    except ValueError: pass
    else: raise AssertionError('partial Nexus binding accepted')
    env[key] = saved
try: build(py_exec=object())
except ValueError: pass
else: raise AssertionError('Nexus binding overridden')
print('Isolated UAP checks passed: no post-send replay, success flag, exact selectors, live marker, explicit complete env binding')
`;

test('UAP exact patch applies in memory and reviewed methods pass isolated no-replay checks', async (t) => {
  const sourceRoot = process.env.NEXUS_UAP_SOURCE_ROOT
    ?? fileURLToPath(new URL('../../upstream-unrealagentplayer/', import.meta.url));
  const sources = {};
  for (const file of entry.files) {
    let original;
    try { original = await readFile(path.join(sourceRoot,file.path), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return t.skip('Set NEXUS_UAP_SOURCE_ROOT to the pristine pinned checkout to run isolated patched-method tests'); throw error; }
    assert.equal(sha(original), file.beforeSha256);
    const head = 'diff --git a/' + file.path + ' b/' + file.path;
    const start = patch.indexOf(head), next = patch.indexOf('\ndiff --git ', start + head.length);
    assert.notEqual(start, -1);
    const modified = applyInMemory(original, patch.slice(start, next === -1 ? undefined : next + 1));
    assert.equal(sha(modified), file.afterSha256);
    sources[file.path.split('/').at(-1)] = modified;
  }
  const output = execFileSync('python3', ['-c', harness], { input: JSON.stringify(sources), encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.match(output, /Isolated UAP checks passed/u);
});
