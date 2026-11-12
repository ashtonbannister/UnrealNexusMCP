import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {verifySourceSnapshot} from '../src/source-verification.mjs';

const exec=promisify(execFile);
test('source attestation proves exact checkout and rejects mismatched pin, tracked edits, nested roots and unknown patch',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'nexus-source-'));
  const git=async(...args)=>(await exec('git',['-C',root,...args],{timeout:10000})).stdout.trim();
  try {
    await git('init','-q');await mkdir(path.join(root,'src'));await writeFile(path.join(root,'src','plugin.cpp'),'reviewed source\n');
    await git('add','.');await git('-c','user.name=Nexus fixture','-c','user.email=fixture@example.invalid','commit','-qm','source fixture');
    const commit=await git('rev-parse','HEAD');
    const evidence=await verifySourceSnapshot('ue-mcp',{sourceRoot:root},{commit});
    assert.equal(evidence.commit,commit);assert.equal(evidence.compatibilityPatch,null);
    assert.match(evidence.scope,/not independent proof of loaded native binary/);
    await writeFile(path.join(root,'src','extra.cpp'),'unreviewed added source\n');
    await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:root},{commit}),{code:'SOURCE_REVISION_UNPROVEN'});
    await rm(path.join(root,'src','extra.cpp'));
    for(const flag of ['assume-unchanged','skip-worktree']) {
      await git('update-index','--'+flag,'src/plugin.cpp');
      await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:root},{commit}),{code:'SOURCE_REVISION_UNPROVEN'});
      await git('update-index','--no-'+flag,'src/plugin.cpp');
    }
    await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:root},{commit:'0'.repeat(40)}),{code:'SOURCE_REVISION_UNPROVEN'});
    await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:path.join(root,'src')},{commit}),{code:'SOURCE_REVISION_UNPROVEN'});
    await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:root,compatibilityPatch:'invented'},{commit}),{code:'SOURCE_REVISION_UNPROVEN'});
    await writeFile(path.join(root,'src','plugin.cpp'),'unreviewed changes\n');
    await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:root},{commit}),{code:'SOURCE_REVISION_UNPROVEN'});
    await git('add','.');
    await assert.rejects(verifySourceSnapshot('ue-mcp',{sourceRoot:root},{commit}),{code:'SOURCE_REVISION_UNPROVEN'});
  } finally {await rm(root,{recursive:true,force:true});}
});
