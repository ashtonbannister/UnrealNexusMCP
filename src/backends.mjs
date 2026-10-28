import { NexusError, markCleanupIncomplete, cleanupIncomplete } from './errors.mjs';

// Host-owned factories supply actual MCP transports. No server processes start
// during construction, discovery or planning. A failed start is cached, not retried.
export class BackendPool {
  #factories;
  #promises = new Map();
  #states = new Map();
  #sources;
  #target;
  #closed = false;
  #closePromise;
  #cleanupFailures = new Set();

  constructor(factories, sources, target) {
    this.#factories = new Map(factories);
    this.#sources = sources;
    this.#target = target;
  }

  async get(provider) {
    if (this.#closed) throw new NexusError('GATEWAY_CLOSED', 'Backend pool is closed.');
    if (!this.#promises.has(provider)) {
      const factory = this.#factories.get(provider);
      if (typeof factory !== 'function') {
        throw new NexusError('BACKEND_UNAVAILABLE', 'No factory for selected backend ' + provider + '; no fallback.');
      }
      this.#states.set(provider, 'starting');
      const promise = Promise.resolve().then(() => factory({
        provider, source: this.#sources[provider], target: this.#target,
      })).then(async (backend) => {
        const invalid = !backend || typeof backend.call !== 'function' || typeof backend.supports !== 'function' || !(backend.tools instanceof Set)
          || backend.sourceCommit !== this.#sources[provider].commit
          || backend.identityVerified !== true
          || backend.target?.projectRoot !== this.#target.projectRoot
          || backend.target?.editorInstanceId !== this.#target.editorInstanceId;
        if (invalid || this.#closed) {
          const refusal = new NexusError(invalid ? 'BACKEND_ATTESTATION_FAILED' : 'GATEWAY_CLOSED',
            'Backend contract, reviewed source pin or host-verified editor identity did not match.');
          try { await backend?.close?.(); } catch { markCleanupIncomplete(refusal); }
          throw refusal;
        }
        this.#states.set(provider, 'ready');
        return backend;
      }).catch((error) => {
        this.#states.set(provider, 'failed');
        if (cleanupIncomplete(error)) this.#cleanupFailures.add(provider);
        throw error;
      });
      this.#promises.set(provider, promise);
    }
    return this.#promises.get(provider);
  }

  get status() {
    return [...this.#states].map(([provider,state]) => ({provider,state,...(this.#cleanupFailures.has(provider) ? {cleanup:'unconfirmed'} : {})}));
  }

  close() {
    if (!this.#closePromise) {
      this.#closed = true;
      this.#closePromise = (async () => {
        const results = await Promise.allSettled([...this.#promises.values()]);
        const closed = await Promise.allSettled(results.filter((r) => r.status === 'fulfilled').map((r) => r.value.close?.()));
        if (this.#cleanupFailures.size || closed.some(r => r.status === 'rejected')) {
          throw new NexusError('BACKEND_CLEANUP_INCOMPLETE', 'One or more backend connections did not confirm shutdown. Inspect the host before restarting.');
        }
      })();
    }
    return this.#closePromise;
  }
}
