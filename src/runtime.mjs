import { compatibilitySatisfied } from './compatibility.mjs';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { loadCatalog } from './catalog.mjs';
import { Gateway } from './gateway.mjs';
import { selectCapabilities } from './packs.mjs';
import { loadGuidance } from './guidance.mjs';
import { createMcpConnection } from './transport-client.mjs';
import { createProviderProbe, inspectEditorProcess, selectEditorForProject } from './provider-probes.mjs';
import { verifySourceSnapshot } from './source-verification.mjs';
import { createWindowsProcessInspector } from './windows-process-inspector.mjs';
import { resolveProjectEndpoint } from './project-endpoints.mjs';
import { createSpecialistAdapter } from './specialist-adapters.mjs';
import { NexusError, markCleanupIncomplete, cleanupIncomplete, boundedCleanup } from './errors.mjs';

// Construct UAP's fixed native binding from host-verified target and source.
// The returned environment never accepts caller-selected discovery overrides.
export function createUapBindingEnv({existingEnv, target, rcEndpoint, sourceRoot}) {
  const rc = new URL(rcEndpoint);
  return {...existingEnv, NEXUS_UAP_PROJECT_FILE:target.projectRoot,
    NEXUS_UAP_EDITOR_PID:String(target.processId), NEXUS_UAP_RC_PORT:rc.port || '80',
    PYTHONPATH:path.join(sourceRoot,'mcp-server','src')};
}

export async function createRuntime(config, {
  catalog = loadCatalog(), guidanceLoader = loadGuidance,
  connect = createMcpConnection, probeFactory = createProviderProbe,
  processInspector = inspectEditorProcess, sourceVerifier = verifySourceSnapshot,
  processInspectorFactory = process.platform === 'win32' ? createWindowsProcessInspector : null,
  resolvePath = realpath, editorSelector = selectEditorForProject, endpointResolver = resolveProjectEndpoint,
} = {}) {
  const enabled = selectCapabilities(catalog,config);
  const providers = new Set(enabled.map(id => catalog.get(id).provider));
  for (const provider of providers) {
    if (!config.backends[provider]) throw new NexusError('INVALID_CONFIGURATION','Missing backend configuration for enabled provider ' + provider + '.');
    const required = new Set(enabled.map(id=>catalog.get(id)).filter(op=>op.provider===provider)
      .map(op=>op.requiredCompatibility).filter(Boolean));
    if ([...required].some(id => !compatibilitySatisfied(provider,id,config.backends[provider].compatibilityPatch))) {
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
      if (backend.transport.type !== 'stdio' || (backend.rcEndpoint !== 'editor-auto' && (!rc || rc.protocol !== 'http:' || rc.hostname !== '127.0.0.1'
        || rc.username || rc.password || rc.search || rc.hash || rc.pathname !== '/'))) {
        throw new NexusError('BACKEND_BINDING_REQUIRED','UAP requires launched stdio and an explicit local RC base URL for the selected editor.');
      }
    }
  }
  const ownedInspector = config.target && processInspector === inspectEditorProcess && processInspectorFactory
    ? processInspectorFactory() : null;
  try {
    if (ownedInspector && (typeof ownedInspector.inspect !== 'function' || typeof ownedInspector.close !== 'function'))
      throw new NexusError('INVALID_CONFIGURATION','Process inspector factory returned an invalid helper.');
    if (ownedInspector) processInspector = ownedInspector.inspect;
    let target = null;
    const resolveTarget = async () => {
      const process = config.target.processId === 'auto'
        ? await editorSelector(config.target.projectRoot, {processInspector})
        : await processInspector(config.target.processId);
      if (config.target.editorInstanceId && config.target.editorInstanceId !== process.editorInstanceId) {
        throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED','Configured editor process has restarted.');
      }
      target = Object.freeze({projectRoot:await resolvePath(config.target.projectRoot),
        processId:config.target.processId === 'auto' ? process.processId : config.target.processId,editorInstanceId:process.editorInstanceId});
      return target;
    };
    if (config.target && config.target.processId !== 'auto') await resolveTarget();
    const evidence = new Map();
    const factories = new Map();
    // Register factories for enabled providers only. None of these bodies runs
    // during server startup, manifest/resource/prompt discovery or dry-run planning.
    for (const provider of providers) {
      const backendConfig = structuredClone(config.backends[provider]);
      factories.set(provider, async ({source}) => {
        const sourceEvidence = await sourceVerifier(provider,backendConfig,source);
        const endpointOptions = ownedInspector?.inspectListener ? {listenerInspector:ownedInspector.inspectListener} : {};
        if (provider === 'claireon' && backendConfig.transport.url === 'editor-auto')
          backendConfig.transport.url = await endpointResolver(provider,target,endpointOptions);
        if (provider === 'unrealagentplayer' && backendConfig.rcEndpoint === 'editor-auto')
          backendConfig.rcEndpoint = await endpointResolver(provider,target,endpointOptions);
        if (provider === 'unrealagentplayer') {
          // The reviewed optional UAP patch consumes these values when it builds
          // both native clients. Never accept a caller-selected discovery target.
          backendConfig.transport.env = createUapBindingEnv({existingEnv:backendConfig.transport.env,
            target,rcEndpoint:backendConfig.rcEndpoint,sourceRoot:sourceEvidence.sourceRoot ?? backendConfig.sourceRoot});
        }
        if (provider === 'ue-mcp' && backendConfig.transport.type === 'stdio') {
          backendConfig.transport.env = {...backendConfig.transport.env,UE_MCP_SERVER_MODE:'in-process'};
        }
        let connection;
        try {
          connection = await connect(backendConfig.transport, {timeoutMs:config.timeoutMs,
            startupTimeoutMs:Math.min(Math.floor(config.timeoutMs / 2),30000),
            closeTimeoutMs:Math.min(Math.floor(config.timeoutMs / 4),5000)});
          const tools = await connection.listTools({timeoutMs:Math.min(config.timeoutMs,10000)});
          const probe = probeFactory({provider,connection,tools,target,compatibilityPatch:sourceEvidence.compatibilityPatch,
            endpointUrl:backendConfig.transport.url,rcEndpoint:backendConfig.rcEndpoint,
            nativeEndpoint:provider==='hayba'?'http://127.0.0.1:'+backendConfig.transport.env.UE_TCP_PORT:undefined,
            timeoutMs:Math.min(config.timeoutMs,provider==='unrealagentplayer'?30000:10000),processInspector,
          ...(ownedInspector?.inspectListener ? {listenerInspector:ownedInspector.inspectListener} : {})});
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
              if (operation.requiredCompatibility && !compatibilitySatisfied(provider,operation.requiredCompatibility,sourceEvidence.compatibilityPatch)) return false;
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
          const refusal = error instanceof NexusError ? error
            : new NexusError('BACKEND_PREPARATION_FAILED','Backend connection or verification failed for ' + provider + '. No operation was dispatched.');
          if (cleanupIncomplete(error)) markCleanupIncomplete(refusal);
          try { await boundedCleanup(() => connection?.close(), Math.min(5000, Math.floor(config.timeoutMs / 2))); }
          catch { markCleanupIncomplete(refusal); }
          throw refusal;
        }
      });
    }
    const gateway = new Gateway(catalog,{enabledCapabilities:enabled,backendFactories:factories,
      allowWrites:config.allowWrites,allowLevelExternalPackageDeletion:config.allowLevelExternalPackageDeletion,timeoutMs:config.timeoutMs,target,
      targetResolver:config.target?.processId === 'auto' ? resolveTarget : null});
    const guidance = await guidanceLoader();
    // Check mapping before accepting protocol traffic, without contacting backends.
    guidance.forOperations(enabled.map(id=>catalog.get(id)));
    let closePromise;
    return {
      gateway,guidance,
      status:() => ({...gateway.status(),networkTransport:config.server.transport,
        editorIdentity:target===null?(config.target?'awaiting editor selection':'unconfigured'):'OS process epoch pinned; each selected provider must corroborate the exact project/editor before dispatch',
        guidanceSha256:guidance.sha256,sourceAndIdentityEvidence:Object.fromEntries(evidence),
        liveUnrealQualification:'pending; protocol integration tests use fixture backends'}),
      close:() => closePromise ??= (async()=>{
        let failure;
        try {await gateway.close();} catch (error) {failure=error;}
        try {await ownedInspector?.close();} catch (error) {
          failure = failure ? markCleanupIncomplete(failure) : markCleanupIncomplete(error);
        }
        if (failure) throw failure;
      })(),
    };
  } catch (error) {
    if (ownedInspector) {
      try {
        if (typeof ownedInspector.close !== 'function') throw new Error('Inspector cleanup is unavailable');
        await ownedInspector.close();
      } catch {
        if (typeof error === 'object' && error !== null) markCleanupIncomplete(error);
      }
    }
    throw error;
  }
}
