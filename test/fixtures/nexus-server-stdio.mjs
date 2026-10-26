import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createNexusServer} from '../../src/mcp-server.mjs';
import {createFixtureRuntime} from './nexus-server-runtime.mjs';

const runtime=await createFixtureRuntime({mode:process.argv[2] ?? 'normal',
  allowWrites:process.argv[3]!=='read-only'});
const endpoint=serveStdio(()=>createNexusServer(runtime));
process.stdin.once('end',()=>{void endpoint.close().then(()=>runtime.close());});
