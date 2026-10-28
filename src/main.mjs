#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.mjs';
import { createRuntime } from './runtime.mjs';
import { createNexusServer } from './mcp-server.mjs';
import { startHttpServer } from './http-server.mjs';
import { inspectEditorProcess } from './provider-probes.mjs';

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) {
    process.stdout.write('Unreal Nexus MCP\n\nUsage: node src/main.mjs --config <file.json>\n       node src/main.mjs inspect-editor <PID>\n\nTransport, enabled capabilities and write authority come from trusted host configuration.\n');
    return;
  }
  if (args[0] === 'inspect-editor' && args.length === 2 && /^[1-9][0-9]*$/.test(args[1])) {
    process.stdout.write(JSON.stringify(await inspectEditorProcess(Number(args[1])),null,2) + '\n');
    return;
  }
  if (args.length !== 2 || args[0] !== '--config') throw new Error('Use --config <file.json> or --help.');
  const config = await loadConfig(args[1]);
  const runtime = await createRuntime(config);
  let endpoint, closing;
  const close = () => {
    if (!closing) closing = (async () => {await endpoint?.close();await runtime.close();})();
    return closing;
  };
  try {
    if (config.server.transport === 'http') {
      endpoint = await startHttpServer(runtime,config.server);
      process.stderr.write(JSON.stringify({event:'listening',transport:'http',address:endpoint.address,path:'/mcp'}) + '\n');
    } else {
      endpoint = serveStdio(() => createNexusServer(runtime), {
        onerror:() => process.stderr.write('Unreal Nexus MCP protocol error.\n'),
        maxSubscriptions:8,
      });
      process.stdin.once('end',() => {void close().catch(()=>{
        process.stderr.write('Unreal Nexus backend cleanup was not confirmed.\n');process.exitCode=1;
      });});
    }
    for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => {
      const timeout = setTimeout(() => process.exit(1),5000);timeout.unref();
      void close().then(() => {clearTimeout(timeout);process.exitCode=0;},() => {process.exitCode=1;});
    });
    return {runtime,endpoint,close};
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    // Never serialize the config, authorization headers, child stderr or raw
    // fetch errors. Detailed native receipts are returned only via tool calls.
    process.stderr.write(JSON.stringify({error:typeof error.code==='string'?error.code:'STARTUP_FAILED',
      message:error.name==='NexusError'?error.message:'Unable to start Unreal Nexus. Check the configuration and installed backends.'}) + '\n');
    process.exitCode=1;
  });
}
