import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { loadCatalog } from './catalog.mjs';
import { Gateway } from './gateway.mjs';
import { selectCapabilities } from './packs.mjs';
import { loadGuidance } from './guidance.mjs';
import { createMcpConnection } from './transport-client.mjs';
import { createProviderProbe, inspectEditorProcess } from './provider-probes.mjs';
import { verifySourceSnapshot } from './source-verification.mjs';
import { createSpecialistAdapter } from './specialist-adapters.mjs';
import { NexusError } from './errors.mjs';

export async function createRuntime(config, {
  catalog = loadCatalog(), guidanceLoader = loadGuidance,
  connect = createMcpConnection, probeFactory = createProviderProbe,
  processInspector = inspectEditorProcess, sourceVerifier = verifySourceSnapshot,
  resolvePath = realpath,
} = {}) {
  const enabled = selectCapabilities(catalog,config);
  const providers = new Set(enabled.map(id => catalog.get(id).provider));
  for (const provider of providers) {
    if (!config.backends[provider]) throw new NexusError('INVALID_CONFIGURATION','Missing backend configuration for enabled provider ' + provider + '.');
    const required = new Set(enabled.map(id=>catalog.get(id)).filter(op=>op.provider===provider)
      .map(op=>op.requiredCompatibility).filter(Boolean));
    if (required.size > 1 || (required.size === 1 && !required.has(config.backends[provider].compatibilityPatch))) {
      throw new NexusError('COMPATIBILITY_PATCH_REQUIRED','Enabled capabilities require the reviewed compatibility patch for ' + provider + '.');
    }
    if (provider === 'hayba') {
      const transport = config.backends[provider].transport;
      const port = transport.env?.UE_TCP_PORT;
      if (transport.type !== 'stdio' || typeof port !== 'string' || !/^[1-9][0-9]{0,4}$/.test(port) || Number(port)>65535) {
        throw new NexusError('BACKEND_BINDING_REQUIRED','Hayba requires a launched stdio backend with an explicit valid UE_TCP_PORT; automatic editor rediscovery is not permitted.');
      }
    }
    if (provider === 'unrealagentplayer') {
      const backend = config.backends[provider];
      let rc;
      try {rc = new URL(backend.rcEndpoint);} catch { /* Refused below. */ }
      if (backend.transport.type !== 'stdio' || !rc || rc.protocol !== 'http:' || rc.hostname !== '127.0.0.1'
        || rc.username || rc.password || rc.search || rc.hash || rc.pathname !== '/') {
        throw new NexusError('BACKEND_BINDING_REQUIRED','UAP requires launched stdio and an explicit local RC base URL for the selected editor.');
      }
    }
  }
  let target = null;
  if (config.target) {
    const process = await processInspector(config.target.processId);
    if (config.target.editorInstanceId && config.target.editorInstanceId !== process.editorInstanceId) {
      throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED','Configured editor process has restarted.');
    }
    target = Object.freeze({projectRoot:await resolvePath(config.target.projectRoot),
      processId:config.target.processId,editorInstanceId:process.editorInstanceId});
  }
  const evidence = new Map();
  const factories = new Map();
  // Register factories for enabled providers only. None of these bodies runs
  // during server startup, manifest/resource/prompt discovery or dry-run planning.
  for (const provider of providers) {
    const backendConfig = structuredClone(config.backends[provider]);
    factories.set(provider, async ({source}) => {
      const sourceEvidence = await sourceVerifier(provider,backendConfig,source);
      if (provider === 'unrealagentplayer') {
        // The reviewed optional UAP patch consumes these values when it builds
        // both native clients. Never accept a caller-selected discovery target.
        const rc = new URL(backendConfig.rcEndpoint);
        backendConfig.transport.env = {...backendConfig.transport.env,
          NEXUS_UAP_PROJECT_FILE:target.projectRoot,
          NEXUS_UAP_EDITOR_PID:String(target.processId),NEXUS_UAP_RC_PORT:rc.port || '80',
          PYTHONPATH:path.join(sourceEvidence.sourceRoot ?? backendConfig.sourceRoot,'mcp-server','src')};
      }
      if (provider === 'ue-mcp' && backendConfig.transport.type === 'stdio') {
        backendConfig.transport.env = {...backendConfig.transport.env,UE_MCP_SERVER_MODE:'in-process'};
      }
      let connection;
      try {
        connection = await connect(backendConfig.transport, {timeoutMs:config.timeoutMs,startupTimeoutMs:Math.min(config.timeoutMs,30000)});
        const tools = await connection.listTools({timeoutMs:Math.min(config.timeoutMs,10000)});
        const probe = probeFactory({provider,connection,tools,target,
          endpointUrl:backendConfig.transport.url,rcEndpoint:backendConfig.rcEndpoint,
          nativeEndpoint:provider==='hayba'?'http://127.0.0.1:'+backendConfig.transport.env.UE_TCP_PORT:undefined,
          timeoutMs:Math.min(config.timeoutMs,10000),processInspector});
        const identity = await probe.attestIdentity();
        if (identity.identityVerified !== true || identity.target.projectRoot !== target.projectRoot
          || identity.target.editorInstanceId !== target.editorInstanceId) {
          throw new NexusError('BACKEND_ATTESTATION_FAILED','Live target attestation did not match the selected editor.');
        }
        const specialist = ['claireon','hayba'].includes(provider)
          ? createSpecialistAdapter({provider,tools,callTool:connection.callTool.bind(connection)}) : null;
        evidence.set(provider,{source:sourceEvidence,identity:identity.evidence});
        return {
          tools:new Set(tools.map(t=>t.name)),sourceCommit:sourceEvidence.commit,
          identityVerified:true,target,
          supports:async (operation,options = {}) => {
            if (operation.requiredCompatibility && sourceEvidence.compatibilityPatch !== operation.requiredCompatibility) return false;
            if (specialist) {
              // Specialized schema probes must not precede independent identity.
              await probe.attestIdentity(options);
              return specialist.supports(operation,options);
            }
            return probe.supports(operation,options);
          },
          preflight:call => specialist?.validateCall(call),
          call:async (call,timeoutMs,{signal} = {}) => specialist
            ? specialist.call(call,timeoutMs,{signal})
            : connection.callTool(call.name,call.arguments,{timeoutMs,signal}),
          close:async () => {await specialist?.close();await connection.close();},
        };
      } catch (error) {
        try { await connection?.close(); } catch { /* Keep the original pre-dispatch refusal. */ }
        if (error instanceof NexusError) throw error;
        throw new NexusError('BACKEND_PREPARATION_FAILED','Backend connection or verification failed for ' + provider + '. No operation was dispatched.');
      }
    });
  }
  const gateway = new Gateway(catalog,{enabledCapabilities:enabled,backendFactories:factories,
    allowWrites:config.allowWrites,timeoutMs:config.timeoutMs,target});
  const guidance = await guidanceLoader();
  // Check mapping before accepting protocol traffic, without contacting backends.
  guidance.forOperations(enabled.map(id=>catalog.get(id)));
  return {
    gateway,guidance,
    status:() => ({...gateway.status(),networkTransport:config.server.transport,
      editorIdentity:target===null?'unconfigured':'OS process epoch pinned; each selected provider must corroborate the exact project/editor before dispatch',
      guidanceSha256:guidance.sha256,sourceAndIdentityEvidence:Object.fromEntries(evidence),
      liveUnrealQualification:'pending; protocol integration tests use fixture backends'}),
    close:() => gateway.close(),
  };
}
