import test from 'node:test';
import assert from 'node:assert/strict';
import {closeServices} from '../src/main.mjs';
import {cleanupIncomplete} from '../src/errors.mjs';

test('endpoint failure still closes runtime and preserves the original error',async()=>{
  const first=new Error('endpoint failed');let closed=0;
  await assert.rejects(closeServices({close:async()=>{throw first;}},{close:async()=>{closed++;}}),error=>error===first);
  assert.equal(closed,1);
});
test('endpoint timeout still closes runtime; multiple cleanup failures are marked',async()=>{
  let closed=0;
  await assert.rejects(closeServices({close:()=>new Promise(()=>{})},{close:async()=>{closed++;}},100),
    {code:'BACKEND_CLOSE_TIMEOUT'});
  assert.equal(closed,1);
  const first=new Error('endpoint failed');
  await assert.rejects(closeServices({close:async()=>{throw first;}},{close:async()=>{throw new Error('runtime failed');}}),
    error=>error===first&&cleanupIncomplete(error));
});
