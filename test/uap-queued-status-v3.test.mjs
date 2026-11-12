import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import patches from '../catalog/compatibility-patches.json' with {type:'json'};

const patch=patches.patches.find(p=>p.id==='uap-nexus-queued-status-v3');
const patchPath=fileURLToPath(new URL('../'+patch.file,import.meta.url));
const python=String.raw`
import ast, asyncio, os, socket, struct, sys
from pathlib import Path
root=Path(sys.argv[1])/'mcp-server/src/unreal_agent_player'
def function(file,name):
    tree=ast.parse((root/file).read_text())
    return next(n for n in tree.body if isinstance(n,ast.AsyncFunctionDef) and n.name==name)
class AgentError(Exception):
    def __init__(self,*args,**kwargs): super().__init__(*args)
class ErrorCode: UE_STATUS_UNVERIFIED='UE_STATUS_UNVERIFIED'
scope={'RemoteControlClient':object,'AgentError':AgentError,'ErrorCode':ErrorCode,'SUBSYSTEM_OBJECT_PATH':'fixture','Any':object,'math':__import__('math')}
nodes=[function('tools/pie.py','_get_phase'),function('tools/pie.py','_get_elapsed'),function('tools/status.py','bridge_status')]
exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),'patched-fixture','exec'),scope)
class RC:
    nexus_strict_pie_status=True
    _base='http://127.0.0.1:30123'
    def __init__(self,value='Starting'): self.value=value;self.calls=[]
    async def call_preset(self,name):
        self.calls.append(name)
        return self.value if name=='GetNexusPIEPhaseV1' else 0.0
    async def call_function(self,path,name,parameters):
        self.calls.append(name)
        return {'ReturnValue':'Playing'}
class Py:
    nexus_no_replay=True
    _node_project_substr='/fixture/project.uproject'
    _node_instance='pid:123'
    def __init__(self,nodes): self.nodes=nodes
    def list_nodes(self): return self.nodes
    def _matches_project(self,node): return node.get('project')==self._node_project_substr
    def _matches_instance(self,node): return node.get('role')=='editor' and node.get('pid')==123
async def run():
    rc=RC()
    assert await scope['_get_phase'](rc)=='Starting'
    assert rc.calls==['GetNexusPIEPhaseV1']
    assert await scope['_get_elapsed'](rc)==0.0
    rc.value='Unknown'
    try: await scope['_get_phase'](rc)
    except AgentError: pass
    else: raise AssertionError('Unknown phase accepted')
    rc.nexus_strict_pie_status=False
    assert await scope['_get_phase'](rc)=='Playing'
    assert rc.calls[-1]=='GetPIEPhase'
    rc.nexus_strict_pie_status=True;rc.value='NotPlaying'
    node={'project':'/fixture/project.uproject','role':'editor','pid':123}
    status=await scope['bridge_status'](rc=rc,py_exec=Py([node]))
    assert status['rc_reachable'] and status['remote_exec_reachable'] and status['pie_phase']=='NotPlaying'
    assert status['nexus_pie_status_validation']['discovery']=='exact_node_match'
    assert not (await scope['bridge_status'](rc=rc,py_exec=Py([node,node])))['remote_exec_reachable']
    assert not (await scope['bridge_status'](rc=rc,py_exec=Py([{'project':'/other','role':'editor','pid':123}])))['remote_exec_reachable']
asyncio.run(run())
tree=ast.parse((root/'transport.py').read_text())
cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='PythonRemoteExecClient')
method=next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=='_make_multicast_socket')
class FakeSocket:
    def __init__(self):self.bound=None;self.options=[];self.closed=False
    def setsockopt(self,*args):self.options.append(args)
    def bind(self,address):self.bound=address
    def close(self):self.closed=True
class SocketModule:
    def __getattr__(self,name):return getattr(socket,name)
    def socket(self,*args):self.last=FakeSocket();return self.last
fake=SocketModule()
scope={'socket':fake,'struct':struct,'os':os}
exec(compile(ast.fix_missing_locations(ast.Module(body=[method],type_ignores=[])),'socket-fixture','exec'),scope)
class Client:
    MULTICAST_PORT=6766;MULTICAST_GROUP='239.0.0.1';MULTICAST_TTL=0
    def __init__(self,strict):self.nexus_no_replay=strict
os.environ['NEXUS_UAP_MULTICAST_INTERFACE']='127.0.0.1'
bound=scope['_make_multicast_socket'](Client(True))
assert bound.bound==('127.0.0.1',6766)
assert (socket.IPPROTO_IP,socket.IP_MULTICAST_IF,socket.inet_aton('127.0.0.1')) in bound.options
legacy=scope['_make_multicast_socket'](Client(False))
assert legacy.bound==('0.0.0.0',6766)
print('queued status, preset, exact discovery and interface checks passed')
`;

test('queued-aware UAP patch preserves strict status and exact discovery',async(t)=>{
  const source=process.env.NEXUS_UAP_SOURCE_ROOT;
  if(!source) return t.skip('Set NEXUS_UAP_SOURCE_ROOT to the pristine pinned checkout');
  const bytes=await readFile(patchPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),patch.sha256);
  const root=await mkdtemp(path.join(tmpdir(),'nexus-uap-v3-'));
  try {
    execFileSync('git',['clone','--shared','--quiet','--no-checkout',source,root],{timeout:30000});
    execFileSync('git',['-C',root,'checkout','--quiet','--detach',patch.baseCommit],{timeout:30000});
    execFileSync('git',['-C',root,'apply',patchPath],{timeout:10000});
    const out=execFileSync('python3',['-B','-c',python,root],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
    assert.match(out,/queued status, preset, exact discovery and interface checks passed/u);
  } finally {await rm(root,{recursive:true,force:true});}
});
