import { loadCatalog, Gateway } from './index.mjs';

try {
  const [command = 'list', target = '', input = '{}', ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Too many arguments.');
  const catalog = loadCatalog();
  const gateway = new Gateway(catalog, {enabledCapabilities: command === 'plan' ? [target] : []});
  let result;
  if (command === 'list') result = catalog.search(target, 50);
  else if (command === 'describe') result = catalog.describe(target);
  else if (command === 'plan') result = gateway.plan(target, JSON.parse(input));
  else throw new Error('Use: list [query] | describe <id> | plan <id> <JSON>');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ error: error.code ?? 'INVALID_COMMAND', message: error.message }) + '\n');
  process.exitCode = 1;
}
