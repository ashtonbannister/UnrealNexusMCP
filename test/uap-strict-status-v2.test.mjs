import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {verifySourceSnapshot} from '../src/source-verification.mjs';
import {normalizeResult} from '../src/results.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import proposal from '../catalog/uap-strict-status-v2-proposal.json' with {type:'json'};
import active from '../catalog/compatibility-patches.json' with {type:'json'};

const sha=value=>createHash('sha256').update(value).digest('hex');
const patch=await readFile(new URL('../'+proposal.file,import.meta.url),'utf8');

test('strict UAP status patch remains a content-addressed, opt-in proposal',()=>{
  assert.equal(proposal.status,'registered-opt-in-not-qualified');
  const registered=active.patches.find(p=>p.id==='uap-nexus-strict-status-v2');
  assert.equal(registered.file,proposal.file);assert.equal(registered.sha256,proposal.sha256);
  assert.deepEqual(registered.files,proposal.files);assert.deepEqual(registered.capabilityMarker,proposal.capabilityMarker);
  assert.equal(proposal.baseCommit,'4ab7a62eb78612c2ec110f683b6e11f5dea62e95');
  assert.equal(sha(patch),proposal.sha256);
  assert.equal(proposal.capabilityMarker.value.version,2);
  assert.match(patch,/nexus_strict_pie_status=True/u);
  assert.match(patch,/UE_STATUS_UNVERIFIED/u);
});

function applyInMemory(source,filePatch) {
  const lines=source.split('\n'), output=[];let position=0;
  const diff=filePatch.split('\n');
  for(let i=0;i<diff.length;i++) {
    const m=/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/u.exec(diff[i]);
    if(!m) continue;
    const at=Number(m[1])-1;assert.ok(at>=position);output.push(...lines.slice(position,at));position=at;
    while(i+1<diff.length && !diff[i+1].startsWith('@@ ') && !diff[i+1].startsWith('diff --git ')) {
      const row=diff[++i];if(row==='' && i===diff.length-1) break;
      if(row[0]===' '||row[0]==='-') assert.equal(lines[position++],row.slice(1),'patch context must match exact pinned source');
      if(row[0]===' '||row[0]==='+') output.push(row.slice(1));
    }
  }
  output.push(...lines.slice(position));return output.join('\n');
}

// Only named functions are compiled from the checked patch; no upstream module,
// project, network, editor or native plugin is imported or executed.
const harness=String.raw`
import ast, asyncio, json, math, sys, time, types
sources=json.load(sys.stdin)
class AgentError(Exception):
    def __init__(self, code, message, recoverable=True, retry_hint=None):
        super().__init__(message); self.code=code; self.recoverable=recoverable
codes=types.SimpleNamespace(UE_STATUS_UNVERIFIED='unverified', UE_CONNECTION_RESET='reset',
    UE_CROSSED_RESPONSE='crossed', PYTHON_RUNTIME='python', SCHEMA_VALIDATION='schema')
values={'asyncio':asyncio,'math':math,'time':time,'AgentError':AgentError,'ErrorCode':codes,
    'SUBSYSTEM_OBJECT_PATH':'fixture', 'Any':object, 'RemoteControlClient':object,
    '_LIVE_PHASES':{'Playing','Paused'}, '_PIE_START_POLL_SECONDS':0.001,
    '_PIE_STOP_POLL_SECONDS':0.001, 'PIE_START_TIMEOUT_SECONDS':1.0, 'PIE_STOP_TIMEOUT_SECONDS':1.0}
def load(file,name):
    body=ast.parse(sources[file]).body
    node=next(n for n in body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==name)
    mod=ast.Module(body=ast.parse('from __future__ import annotations').body+[node],type_ignores=[])
    exec(compile(ast.fix_missing_locations(mod),'<isolated reviewed UAP>', 'exec'),values)
for name in ['_get_phase','_get_elapsed','pie_status','pie_start','pie_stop']: load('pie.py',name)
class RC:
    def __init__(self,phase,elapsed=0.0,strict=True):
        self.phase=phase;self.elapsed=elapsed;self.nexus_strict_pie_status=strict;self._base='http://127.0.0.1:30011'
    async def call_function(self,obj,method,parameters=None):
        if method=='GetPluginVersion': return {'ReturnValue':'fixture'}
        return self.phase if method=='GetPIEPhase' else self.elapsed

def run(coro): return asyncio.run(coro)
def must_refuse(coro):
    try: run(coro)
    except AgentError as error:
        assert error.code=='unverified' and error.recoverable is False
    else: raise AssertionError('invalid status accepted')
for phase in ['NotPlaying','Starting','Playing','Paused','Ending']:
    assert run(values['_get_phase'](RC({'ReturnValue':phase})))==phase
for phase in [{},None,[],{'ReturnValue':None},{'ReturnValue':True},{'ReturnValue':0},
              {'ReturnValue':''},{'ReturnValue':'Stopping'},{'ReturnValue':'Unknown'}]:
    must_refuse(values['_get_phase'](RC(phase)))
for elapsed in [{},None,[],{'ReturnValue':None},{'ReturnValue':True},{'ReturnValue':'1'},
                {'ReturnValue':-1},{'ReturnValue':float('nan')},{'ReturnValue':float('inf')}]:
    must_refuse(values['_get_elapsed'](RC({'ReturnValue':'Playing'},elapsed)))
for elapsed in [0,0.0,1.25]:
    assert run(values['_get_elapsed'](RC({'ReturnValue':'Playing'},{'ReturnValue':elapsed})))==float(elapsed)
assert run(values['_get_phase'](RC({},strict=False)))=='NotPlaying'
assert run(values['_get_elapsed'](RC({},elapsed={},strict=False)))==0.0
calls=[]
values['_machine']=types.SimpleNamespace(take_sticky=lambda action:({'acquired':True},None),
    give_back=lambda grant:calls.append('give_back'),release_project=lambda:calls.append('release_project'))
class Py:
    nexus_no_replay=True
    _node_project_substr='/fixture/Demo.uproject';_node_instance='pid:1234'
    def exec_python(self,code): calls.append('dispatch'); return {'success':True}
    def _discover_endpoint(self): return ('127.0.0.1',1)
py=Py();bad=RC({})
must_refuse(values['pie_start'](rc=bad,py_exec=py))
assert calls==['dispatch'],'unknown start must retain grant, never replay'
calls.clear();must_refuse(values['pie_stop'](rc=bad,py_exec=py))
assert calls==['dispatch'],'unknown stop must not release project grant'
load('status.py','bridge_status')
status=run(values['bridge_status'](rc=RC({'ReturnValue':'Ending'}),py_exec=py))
assert status['pie_phase']=='Ending'
assert status['nexus_pie_status_validation']=={'version':2,'phase':'exact_native_enum',
    'elapsed':'finite_nonnegative','missing_or_invalid':'error'}
status=run(values['bridge_status'](rc=RC({},strict=True),py_exec=py))
assert status['pie_phase'] is None
status=run(values['bridge_status'](rc=RC({},strict=False),py_exec=py))
assert status['nexus_pie_status_validation'] is None

# Verify the reviewed server construction connects the strict mode to the exact
# Nexus binding. These are inert fakes: no files, server or clients are started.
captured={};env={}
class Project:
    def __init__(self,value): self.value=value
    def is_absolute(self): return self.value.startswith('/')
    @property
    def suffix(self): return '.uproject'
    def is_file(self): return True
    def resolve(self): return self
    def as_posix(self): return self.value
    @classmethod
    def home(cls): return '/fixture'
def new_rc(**kw): captured['rc_options']=kw;return object()
def new_py(**kw): captured['py_options']=kw;return object()
values.update(os=types.SimpleNamespace(environ=env),Path=Project,
    RemoteControlClient=new_rc,PythonRemoteExecClient=new_py,
    Server=lambda name:object(),register_all=lambda *a,**kw:captured.update(kw),
    BaselineStore=lambda p:object(),UIADriver=lambda:object())
# BaselineStore's default evaluates Path.home() / name; supply an inert store.
load('server.py','build_server')
env.update(NEXUS_UAP_PROJECT_FILE='/fixture/Demo.uproject',NEXUS_UAP_EDITOR_PID='1234',NEXUS_UAP_RC_PORT='30011')
values['build_server'](store=object())
assert captured['rc_options']=={'host':'127.0.0.1','port':30011,'nexus_strict_pie_status':True}
assert captured['py_options']=={'node_project_substr':'/fixture/Demo.uproject','node_instance':'pid:1234','nexus_no_replay':True}
for key in list(env):
    saved=env.pop(key)
    try: values['build_server'](store=object())
    except ValueError: pass
    else: raise AssertionError('partial Nexus binding accepted')
    env[key]=saved
try: values['build_server'](rc=object(),store=object())
except ValueError: pass
else: raise AssertionError('Nexus binding overridden')
print('strict phase and elapsed, no grant release after ambiguous dispatch, marker and stock mode verified')
`;

test('strict status patch applies to exact UAP pin and isolated functions fail closed',async(t)=>{
  const root=process.env.NEXUS_UAP_SOURCE_ROOT ?? fileURLToPath(new URL('../../upstream-unrealagentplayer/',import.meta.url));
  const sources={};
  for(const file of proposal.files) {
    let original;
    try {original=await readFile(path.join(root,file.path),'utf8');}
    catch(error) {if(error.code==='ENOENT') return t.skip('Set NEXUS_UAP_SOURCE_ROOT to the pristine pinned checkout');throw error;}
    assert.equal(sha(original),file.beforeSha256);
    const head='diff --git a/'+file.path+' b/'+file.path;
    const start=patch.indexOf(head), next=patch.indexOf('\ndiff --git ',start+head.length);
    assert.notEqual(start,-1);
    const modified=applyInMemory(original,patch.slice(start,next===-1?undefined:next+1));
    assert.equal(sha(modified),file.afterSha256);
    sources[file.path.split('/').at(-1)]=modified;
  }
  const output=execFileSync('python3',['-c',harness],{input:JSON.stringify(sources),encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
  assert.match(output,/strict phase and elapsed/u);
});


test('registered v2 verifies exact source bytes and is not interchangeable with v1 source',async(t)=>{
  const source=process.env.NEXUS_UAP_SOURCE_ROOT;
  if (!source) return t.skip('Set NEXUS_UAP_SOURCE_ROOT to the pristine pinned checkout');
  const root=await mkdtemp(path.join(tmpdir(),'nexus-uap-v2-'));
  try {
    execFileSync('git',['clone','--shared','--quiet','--no-checkout',source,root],{timeout:30000});
    execFileSync('git',['-C',root,'checkout','--quiet','--detach',proposal.baseCommit],{timeout:30000});
    const patchPath=fileURLToPath(new URL('../'+proposal.file,import.meta.url));
    execFileSync('git',['-C',root,'apply',patchPath],{timeout:10000});
    const expected={commit:proposal.baseCommit};
    const v2=await verifySourceSnapshot('unrealagentplayer',{sourceRoot:root,compatibilityPatch:'uap-nexus-strict-status-v2'},expected);
    assert.equal(v2.compatibilityPatch,'uap-nexus-strict-status-v2');
    await assert.rejects(verifySourceSnapshot('unrealagentplayer',{sourceRoot:root,compatibilityPatch:'uap-nexus-no-replay-v1'},expected),{code:'SOURCE_REVISION_UNPROVEN'});
    const modified=path.join(root,proposal.files[0].path);
    const original=await readFile(modified);
    await writeFile(modified,Buffer.concat([original,Buffer.from('\n# modified fixture\n')]));
    await assert.rejects(verifySourceSnapshot('unrealagentplayer',{sourceRoot:root,compatibilityPatch:'uap-nexus-strict-status-v2'},expected),{code:'SOURCE_REVISION_UNPROVEN'});
    await writeFile(modified,original);
    execFileSync('git',['-C',root,'apply','--reverse',patchPath],{timeout:10000});
    const v1Path=fileURLToPath(new URL('../patches/uap-nexus-no-replay.patch',import.meta.url));
    execFileSync('git',['-C',root,'apply',v1Path],{timeout:10000});
    const v1=await verifySourceSnapshot('unrealagentplayer',{sourceRoot:root,compatibilityPatch:'uap-nexus-no-replay-v1'},expected);
    assert.equal(v1.compatibilityPatch,'uap-nexus-no-replay-v1');
    await assert.rejects(verifySourceSnapshot('unrealagentplayer',{sourceRoot:root,compatibilityPatch:'uap-nexus-strict-status-v2'},expected),{code:'SOURCE_REVISION_UNPROVEN'});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('strict-status errors fence lifecycle and are never called successful status',()=>{
  for(const op of [{id:'pie.start.viewport',provider:'unrealagentplayer',effect:'lifecycle'},
    {id:'pie.stop',provider:'unrealagentplayer',effect:'lifecycle'},
    {id:'pie.status',provider:'unrealagentplayer',effect:'read'}]) {
    for(const body of [{ok:false,error:{code:'UE_STATUS_UNVERIFIED',message:'unverified',domain:'transport',recoverable:false,retry_hint:null}},
      {ok:false,phase:'NotPlaying',error:{code:'UE_STATUS_UNVERIFIED'}}]) {
      const out=normalizeResult(op,{content:[{type:'text',text:JSON.stringify(body)}]});
      assert.equal(out.isError,true);assert.equal(out._meta['unreal-nexus/result-policy'].outcomeUnknown,true);
    }
  }
});
