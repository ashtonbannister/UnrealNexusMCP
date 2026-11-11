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
  #closeTimeoutMs;

  constructor(factories, sources, target, closeTimeoutMs = 5000) {
    if (!Number.isInteger(closeTimeoutMs) || closeTimeoutMs < 1 || closeTimeoutMs > 60000) {
      throw new NexusError('INVALID_CONFIGURATION', 'Backend close timeout must be 1–60000 ms.');
    }
    this.#factories = new Map(factories);
    this.#sources = sources;
    this.#target = target;
    this.#closeTimeoutMs = closeTimeoutMs;
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

  // Every wait during shutdown is bounded. A startup or close that does not settle
  // in time is reported as unconfirmed cleanup rather than hanging the host.
  // The result is memoized, so repeated shutdown reports the same outcome.
  close() {
    if (!this.#closePromise) {
      this.#closed = true;
      this.#closePromise = (async () => {
        let incomplete = false;
        await Promise.all([...this.#promises].map(async ([provider, promise]) => {
          const started = await settle(promise, this.#closeTimeoutMs);
          if (started.state === 'timeout') {
            this.#cleanupFailures.add(provider);
            incomplete = true;
            return;
          }
          if (started.state === 'rejected') return; // Already reported through status/state.
          const closed = await settle(Promise.resolve().then(() => started.value.close?.()), this.#closeTimeoutMs);
          if (closed.state !== 'fulfilled') {
            this.#cleanupFailures.add(provider);
            incomplete = true;
          }
        }));
        if (incomplete || this.#cleanupFailures.size) {
          throw new NexusError('BACKEND_CLEANUP_INCOMPLETE', 'One or more backend connections did not confirm shutdown. Inspect the host before restarting.');
        }
      })();
    }
    return this.#closePromise;
  }
}

function settle(promise, ms) {
  let timer;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve({ state: 'timeout' }), ms); });
  const outcome = promise.then(
    (value) => ({ state: 'fulfilled', value }),
    (reason) => ({ state: 'rejected', reason }),
  );
  return Promise.race([outcome, deadline]).finally(() => clearTimeout(timer));
}
