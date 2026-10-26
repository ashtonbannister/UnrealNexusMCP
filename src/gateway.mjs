import { buildCall, nativeToolName } from './routing.mjs';
import { normalizeResult } from './results.mjs';
import { EditorQueue } from './queue.mjs';
import { BackendPool } from './backends.mjs';
import { selectCapabilities } from './packs.mjs';
import { NexusError } from './errors.mjs';

// Canonical routing core shared by all connections to the MCP host.
// Only trusted host code supplies backend factories, enablement and write grants.
export class Gateway {
  #enabled;
  #pool;
  #closed = false;

  constructor(catalog, {
    enabledPacks = [], enabledCapabilities = [], backendFactories = new Map(),
    allowWrites = false, timeoutMs = 120000, target = null,
  } = {}) {
    if (typeof allowWrites !== 'boolean' || !Number.isInteger(timeoutMs)
      || timeoutMs < 100 || timeoutMs > 600000) {
      throw new NexusError('INVALID_CONFIGURATION', 'Invalid write flag or timeout (100–600000 ms).');
    }
    if (target !== null && (typeof target !== 'object'
      || typeof target.projectRoot !== 'string' || !target.projectRoot.trim()
      || typeof target.editorInstanceId !== 'string' || !target.editorInstanceId.trim())) {
      throw new NexusError('INVALID_CONFIGURATION', 'Target needs projectRoot and editorInstanceId.');
    }
    this.catalog = catalog;
    this.#enabled = new Set(selectCapabilities(catalog, {enabledPacks,enabledCapabilities}));
    this.allowWrites = allowWrites;
    this.timeoutMs = timeoutMs;
    this.target = target === null ? null : Object.freeze({...target});
    this.queue = new EditorQueue();
    this.#pool = new BackendPool(backendFactories, catalog.upstreams.sources, this.target);
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
        annotations:{readOnlyHint:op.effect==='read',destructiveHint:op.effect!=='read',
          idempotentHint:op.effect==='read',openWorldHint:true} };
    });
  }

  describe(id) { this.#operation(id); return this.catalog.describe(id); }

  plan(id, args = {}) {
    const operation = this.#operation(id);
    this.catalog.validate(id, args);
    return { id, provider: operation.provider, effect: operation.effect,
      source: this.catalog.upstreams.sources[operation.provider],
      call: buildCall(operation, args), postconditions: operation.postconditions, dispatched: false };
  }

  async execute(id, args = {}, {signal} = {}) {
    if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway is closed.');
    this.#operation(id);
    this.catalog.validate(id, args); // Reject accessors before structuredClone can invoke them.
    const expectedArgs = structuredClone(args);
    const plan = this.plan(id, expectedArgs);
    const operation = this.#operation(id);
    if (this.target === null) {
      throw new NexusError('EDITOR_IDENTITY_UNCONFIRMED', 'Configure the intended project/editor; the factory must attest its live target.');
    }
    if (operation.effect !== 'read' && !this.allowWrites) {
      throw new NexusError('WRITES_DISABLED', 'Mutations are disabled. Only trusted host/operator configuration may enable them.');
    }
    const result = await this.queue.run(async (backend) => {
      return normalizeResult(operation, await backend.call(plan.call, this.timeoutMs, {signal}), expectedArgs);
    }, {
      effect:operation.effect, timeoutMs:this.timeoutMs, operation:id, signal,
      prepare:async () => {
        if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway is closed.');
        const backend = await this.#pool.get(operation.provider);
        if (!backend.tools.has(nativeToolName(operation))) {
          throw new NexusError('BACKEND_SURFACE_MISMATCH', 'Selected public tool is not advertised; check surface mode.');
        }
        if (await backend.supports(operation,{signal,timeoutMs:this.timeoutMs}) !== true) {
          throw new NexusError('CAPABILITY_UNAVAILABLE', 'Selected operation is not confirmed available in the connected editor.');
        }
        await backend.preflight?.(plan.call);
        if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Gateway closed during preparation.');
        return backend;
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
    return {allowWrites:this.allowWrites, queue:this.queue.status,
      enabledCapabilities:[...this.#enabled],
      requiredProviders:[...new Set(this.list().map((op)=>op.provider))].sort(),
      backends:this.#pool.status,
      editorIdentity:this.target === null ? 'unconfigured' : 'verified by host adapter on load; not independently attested by this core',
      liveUnrealQualification:'not performed', networkTransport:'not included'};
  }

  async close() {
    this.#closed = true;
    await this.#pool.close();
  }
}
