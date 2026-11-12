import { randomBytes } from 'node:crypto';
import { buildCall, nativeToolName } from './routing.mjs';
import { normalizeResult } from './results.mjs';
import { EditorQueue } from './queue.mjs';
import { BackendPool } from './backends.mjs';
import { selectCapabilities } from './packs.mjs';
import { NexusError } from './errors.mjs';
import { ProviderSurface } from './provider-surface.mjs';

// These reviewed routes remain held where native target or ownership
// boundaries cannot be established before dispatch.
const held = new Map([
  ['automation.tests.run',{code:'AUTOMATION_RUN_OWNERSHIP_UNVERIFIED',reason:'native run start can replace an independently owned active run'}],
  ...['blueprint.compile.memory.asset','blueprint.compile.memory.session'].map(id =>
    [id,{code:'BLUEPRINT_SESSION_OWNERSHIP_UNVERIFIED',reason:'native Blueprint session ownership and reuse unverified'}]),
  ['insights.trace.open',{code:'TRACE_READER_OWNERSHIP_UNVERIFIED',reason:'native open can stop expired readers owned by other clients'}],
  ...['insights.capture.start','insights.capture.stop'].map(id =>
    [id,{code:'TRACE_CAPTURE_OWNERSHIP_UNVERIFIED',reason:'native trace output and global capture ownership unverified'}]),
]);

// Canonical routing core shared by all connections to the MCP host.
// Only trusted host code supplies backend factories, enablement and write grants.
export class Gateway {
  #enabled;
  #pool;
  #closed = false;
  #inputHolds = new Map();
  #allowLevelExternalPackageDeletion;
  #targetResolver;
  #targetPromise = null;

  constructor(catalog, {
    enabledPacks = [], enabledCapabilities = [], backendFactories = new Map(), providerTools = [],
    allowWrites = false, allowLevelExternalPackageDeletion = false, timeoutMs = 120000, target = null, targetResolver = null,
  } = {}) {
    if (typeof allowWrites !== 'boolean' || typeof allowLevelExternalPackageDeletion !== 'boolean' || !Number.isInteger(timeoutMs)
      || timeoutMs < 100 || timeoutMs > 600000) {
      throw new NexusError('INVALID_CONFIGURATION', 'Invalid write flag or timeout (100–600000 ms).');
    }
    if (target !== null && (typeof target !== 'object'
      || typeof target.projectRoot !== 'string' || !target.projectRoot.trim()
      || typeof target.editorInstanceId !== 'string' || !target.editorInstanceId.trim())) {
      throw new NexusError('INVALID_CONFIGURATION', 'Target needs projectRoot and editorInstanceId.');
    }
    if (targetResolver !== null && typeof targetResolver !== 'function') throw new NexusError('INVALID_CONFIGURATION','Target resolver must be a function.');
    this.#targetResolver = targetResolver;
    this.catalog = catalog;
    this.#enabled = new Set(selectCapabilities(catalog, {enabledPacks,enabledCapabilities}));
    this.allowWrites = allowWrites;
    this.#allowLevelExternalPackageDeletion = allowLevelExternalPackageDeletion;
    this.timeoutMs = timeoutMs;
    this.target = target === null ? null : Object.freeze({...target});
    this.queue = new EditorQueue();
    this.#pool = new BackendPool(backendFactories, catalog.upstreams.sources, this.target);
    this.providerSurface = new ProviderSurface({providers:providerTools, queue:this.queue,
      allowWrites, timeoutMs, getBackend:async (provider, options) => {
        if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway is closed.');
        await this.#ensureTarget();
        return this.#pool.get(provider, options);
      }});
  }

  listProviderTools(options) { return this.providerSurface.listTools(options); }
  isProviderTool(name) { return this.providerSurface.isTool(name); }
  executeProviderTool(name, args, options) { return this.providerSurface.callTool(name, args, options); }

  async #ensureTarget() {
    if (this.target !== null) return this.target;
    if (!this.#targetResolver) throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED','Configure the intended project/editor.');
    if (!this.#targetPromise) {
      this.#targetPromise = Promise.resolve().then(() => this.#targetResolver()).then(target => {
        if (this.#closed) throw new NexusError('GATEWAY_CLOSED','Gateway closed while selecting the editor.');
        if (!target || typeof target.projectRoot !== 'string' || !target.projectRoot.trim()
          || typeof target.editorInstanceId !== 'string' || !target.editorInstanceId.trim()
          || !Number.isSafeInteger(target.processId) || target.processId < 1) {
          throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED','The editor target could not be established.');
        }
        const pinned = Object.freeze({...target});
        this.#pool.bindTarget(pinned);
        this.target = pinned;
        return pinned;
      }).finally(() => {this.#targetPromise = null;});
    }
    return this.#targetPromise;
  }

  #operation(id) {
    const operation = this.catalog.get(id);
    if (!this.#enabled.has(id)) throw new NexusError('CAPABILITY_DISABLED', 'Capability is not enabled: ' + id);
    return operation;
  }

  list() {
    return [...this.#enabled].map((id) => {
      const op = this.catalog.get(id);
      return {id, description:op.description, provider:op.provider, effect:op.effect};
    });
  }

  toolDefinitions() {
    return [...this.#enabled].map((id) => {
      const op = this.catalog.get(id);
      return { name:id, description:op.description, inputSchema:op.parameters,
        annotations:{readOnlyHint:op.effect==='read' && !['screenshot.viewport.current','screenshot.pie'].includes(op.id),destructiveHint:op.effect!=='read',
          idempotentHint:op.effect==='read',openWorldHint:true} };
    });
  }

  describe(id) { this.#operation(id); return this.catalog.describe(id); }

  plan(id, args = {}) {
    const operation = this.#operation(id);
    this.catalog.validate(id, args);
    const call = buildCall(operation, args);
    if (id.startsWith('input.action.hold.')) {
      delete call.arguments.args.injection_id;
      call.arguments.args.native_id = '<generated by host>';
      call.arguments.args.owner_token = '<private host token>';
      if (id === 'input.action.hold.start') call.arguments.args.lease_seconds ??= 300;
    }
    return { id, provider: operation.provider, effect: operation.effect,
      source: this.catalog.upstreams.sources[operation.provider],
      call, postconditions: operation.postconditions, dispatched: false };
  }

  async execute(id, args = {}, {signal,clientContext,onprogress} = {}) {
    if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway is closed.');
    this.#operation(id);
    this.catalog.validate(id, args); // Reject accessors before structuredClone can invoke them.
    const expectedArgs = structuredClone(args);
    const plan = this.plan(id, expectedArgs);
    const operation = this.#operation(id);
    if (id === 'screenshot.pie') {
      const nonce = randomBytes(16).toString('hex');
      plan.call.arguments.args.nonce = nonce;
      expectedArgs.nonce = nonce;
    }
    if (this.target === null && !this.#targetResolver) {
      throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED', 'Configure the intended project/editor; the factory must attest its live target.');
    }
    if (operation.effect !== 'read' && !this.allowWrites) {
      throw new NexusError('WRITES_DISABLED', 'Mutations are disabled. Only trusted host/operator configuration may enable them.');
    }
    // Held routes cannot establish their required target or ownership before mutation.
    const hold = held.get(id);
    if (hold) throw new NexusError(hold.code, 'Capability is held: ' + hold.reason + '.');
    const result = await this.queue.run(async (prepared) => {
      const {backend,ownedHold} = prepared;
      if (id.startsWith('input.action.hold.')) {
        const entry = id === 'input.action.hold.start'
          ? {nativeId:randomBytes(16).toString('hex'),ownerToken:randomBytes(16).toString('hex'),state:'pending'}
          : ownedHold;
        if (id === 'input.action.hold.start') this.#inputHolds.set(expectedArgs.injection_id,entry);
        plan.call.arguments.args.native_id = entry.nativeId;
        plan.call.arguments.args.owner_token = entry.ownerToken;
        expectedArgs.native_id = entry.nativeId;
        if (id === 'input.action.hold.start') expectedArgs.lease_seconds ??= 300;
      }
      let raw = await backend.call(plan.call, this.timeoutMs, {signal,clientContext,onprogress});
      let leakedToken = false;
      if (id.startsWith('input.action.hold.')) {
        const token = this.#inputHolds.get(expectedArgs.injection_id).ownerToken;
        const serialized = JSON.stringify(raw);
        if (serialized.includes(token)) {
          leakedToken = true;
          raw = JSON.parse(serialized.replaceAll(token,'[redacted]'));
        }
      }
      const out = normalizeResult(operation, raw, expectedArgs);
      if (leakedToken) {
        out.isError = true;
        out._meta['unreal-nexus/result-policy'] = {
          ...out._meta['unreal-nexus/result-policy'],outcomeUnknown:true,classification:'outcome-unknown',
          note:'A private hold token appeared in the backend response and was redacted; reconcile externally.',
        };
      }
      if (id === 'screenshot.pie' || id.startsWith('input.action.hold.')) {
        try {
          if (await backend.supports(operation,{signal,timeoutMs:this.timeoutMs}) !== true) {
            throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED','PIE operation target could not be re-attested.');
          }
        } catch (error) {
          const failure = new NexusError('EDITOR_IDENTITY_UNCONFIRMED','PIE operation target changed or could not be re-attested.');
          failure.backendResult = out;
          throw failure;
        }
      }
      if (id.startsWith('input.action.hold.') && out.isError !== true
        && out._meta?.['unreal-nexus/result-policy']?.outcomeUnknown !== true) {
        if (id === 'input.action.hold.start') this.#inputHolds.get(expectedArgs.injection_id).state = 'active';
        if (id === 'input.action.hold.stop') this.#inputHolds.delete(expectedArgs.injection_id);
      }
      return out;
    }, {
      effect:operation.effect, timeoutMs:this.timeoutMs, operation:id, signal,
      prepare:async () => {
        if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway is closed.');
        await this.#ensureTarget();
        let ownedHold;
        if (id.startsWith('input.action.hold.')) {
          ownedHold = this.#inputHolds.get(expectedArgs.injection_id);
          if (id === 'input.action.hold.start') {
            if (ownedHold || this.#inputHolds.size >= 64)
              throw new NexusError('HOLD_ID_UNAVAILABLE','Hold ID is already owned or the gateway hold limit is reached.');
          } else if (!ownedHold || ownedHold.state !== 'active') {
            throw new NexusError('HOLD_NOT_OWNED','This gateway does not own an active hold with that ID.');
          }
        }
        const backend = await this.#pool.get(operation.provider, {clientContext});
        if (!backend.tools.has(nativeToolName(operation))) {
          throw new NexusError('BACKEND_SURFACE_MISMATCH', 'Selected public tool is not advertised; check surface mode.');
        }
        if (await backend.supports(operation,{signal,timeoutMs:this.timeoutMs,clientContext}) !== true) {
          throw new NexusError('CAPABILITY_UNAVAILABLE', 'Selected operation is not confirmed available in the connected editor.');
        }
        await backend.preflight?.(plan.call);
        if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway closed during preparation.');
        return {backend,ownedHold};
      },
      isUncertain:(out) => out._meta?.['unreal-nexus/result-policy']?.outcomeUnknown === true,
    });
    return {...result, _meta:{...result._meta, 'unreal-nexus/receipt': {
      id, provider:operation.provider, sourceCommit:plan.source.commit,
      outcome:result._meta?.['unreal-nexus/result-policy']?.outcomeUnknown === true ? 'outcome_unknown' : 'response_received',
      liveQualification:'pending',
    }}};
  }

  status() {
    return {allowWrites:this.allowWrites, allowLevelExternalPackageDeletion:this.#allowLevelExternalPackageDeletion, queue:this.queue.status,
      heldCapabilities:[...this.#enabled].filter(id=>held.has(id)).map(id=>({id,reason:held.get(id).reason})),
      enabledCapabilities:[...this.#enabled],
      ownedInputHolds:[...this.#inputHolds].map(([id,entry])=>({id,state:entry.state})),
      providerTools:this.providerSurface.providers,
      requiredProviders:[...new Set([...this.list().map((op)=>op.provider),...this.providerSurface.providers])].sort(),
      backends:this.#pool.status,
      editorIdentity:this.target === null ? (this.#targetResolver ? 'awaiting editor selection' : 'unconfigured') : 'verified by host adapter on load; not independently attested by this core',
      liveUnrealQualification:'not performed', networkTransport:'not included'};
  }

  async close() {
    this.#closed = true;
    this.providerSurface.close();
    await this.#pool.close();
  }
}
