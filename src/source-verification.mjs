import { execFile } from 'node:child_process';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import patches from '../catalog/compatibility-patches.json' with {type:'json'};
import { NexusError } from './errors.mjs';

const execute = promisify(execFile);
const sha256 = content => createHash('sha256').update(content).digest('hex');
const fail = message => {throw new NexusError('SOURCE_REVISION_UNPROVEN',message);};
const git = async (root,args) => (await execute('git', ['--no-optional-locks','-c','core.fsmonitor=false','-C',root,...args],
  {timeout:10000,maxBuffer:4*1024*1024,windowsHide:true,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}})).stdout;

export async function verifySourceSnapshot(provider, config, expected) {
  const root = await realpath(config.sourceRoot);
  if (!(await stat(root)).isDirectory()) fail('Source root is not a directory.');
  const top = await realpath((await git(root,['rev-parse','--show-toplevel'])).trim());
  if (top !== root) fail('sourceRoot must be the upstream repository root.');
  const commit = (await git(root,['rev-parse','HEAD'])).trim();
  if (commit !== expected.commit) fail('Installed source checkout does not match the reviewed pin for ' + provider + '.');
  const patch = config.compatibilityPatch === undefined ? undefined
    : patches.patches.find(p => p.id === config.compatibilityPatch && p.provider === provider);
  if (config.compatibilityPatch && (!patch || patch.baseCommit !== commit)) fail('Unknown or incompatible reviewed patch.');
  const index = (await git(root,['ls-files','-v','-z'])).split('\0').filter(Boolean);
  if (index.some(entry => entry[0] === 'S' || /^[a-z]/.test(entry))) {
    fail('Source index hides tracked changes with assume-unchanged or skip-worktree flags.');
  }
  const changed = (await git(root,['diff','--name-only','-z','HEAD','--'])).split('\0').filter(Boolean);
  const untracked = (await git(root,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
  if (untracked.length) fail('Source checkout contains unreviewed untracked files; keep host configuration outside the checkout.');
  const allowed = new Set((patch?.files ?? []).map(f => f.path));
  if (changed.some(p => !allowed.has(p))) fail('Source checkout contains unreviewed tracked changes.');
  if (patch) {
    const patchBytes = await readFile(new URL('../' + patch.file,import.meta.url));
    if (sha256(patchBytes) !== patch.sha256) fail('Compatibility patch artifact hash does not match its manifest.');
    for (const file of patch.files) {
      if (path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes('..')) fail('Invalid reviewed patch path.');
      const original = await execute('git',['--no-optional-locks','-C',root,'show',commit + ':' + file.path],
        {encoding:'buffer',timeout:10000,maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}});
      if (sha256(original.stdout) !== file.beforeSha256) fail('Reviewed base file hash mismatch.');
      const fullPath = await realpath(path.join(root,file.path));
      if (!fullPath.startsWith(root + path.sep)) fail('Patched source path leaves the repository.');
      if (sha256(await readFile(fullPath)) !== file.afterSha256) fail('Compatibility patch is absent or differs from the reviewed delta.');
    }
  } else if (changed.length) fail('Source checkout is not clean.');
  return {
    commit,sourceRoot:root,compatibilityPatch:patch?.id ?? null,
    checkedAt:new Date().toISOString(),
    scope:'Tracked source checkout, no unignored additions, and exact reviewed patch; ignored build products are not attested. This is not independent proof of loaded native binary provenance.',
  };
}
