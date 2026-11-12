import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('offline manifest readers refuse a FIFO without waiting for a writer', {skip: process.platform === 'win32' ? 'POSIX FIFO fixture' : false}, () => {
  const dir=mkdtempSync(join(tmpdir(),'nexus-fifo-'));
  try {
    const fifo=join(dir,'input');
    const created=spawnSync('mkfifo',[fifo],{encoding:'utf8',timeout:3000});
    assert.equal(created.status,0,created.stderr);
    for(const [script,exit] of [['scripts/candidate-report.mjs',1],['scripts/qualification-evidence.mjs',2]]) {
      const result=spawnSync(process.execPath,[script,fifo],{encoding:'utf8',timeout:3000});
      assert.equal(result.error,undefined,`${script} did not promptly refuse the FIFO`);
      assert.equal(result.status,exit,`${script}: ${result.stderr}`);
      assert.ok(result.stderr.length>0);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});
