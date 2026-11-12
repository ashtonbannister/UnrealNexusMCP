import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// This host ships native ES modules: no transpiler or generated runtime is
// required. Check the complete executable source and its pinned catalogue once.
const source = new URL('../src/', import.meta.url);
const files = (await readdir(source)).filter(name => name.endsWith('.mjs')).sort();
for (const name of files) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(name, source))], {stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
await import('./validate-catalog.mjs');
process.stdout.write(`Host build complete: ${files.length} ES modules and pinned catalogue validated.\n`);
