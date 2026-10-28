import { NexusError } from './errors.mjs';

const cancelled = () => new NexusError('REQUEST_CANCELLED', 'The client cancelled the request before a confirmed result.');
const checkAbort = signal => { if (signal?.aborted) throw cancelled(); };

async function bounded(work, timeoutMs, code, message, signal) {
  checkAbort(signal);
  let timer, onAbort;
  try {
    return await Promise.race([
      Promise.resolve().then(() => { checkAbort(signal); return work(); }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new NexusError(code, message)), timeoutMs);
        if (signal) {
          onAbort = () => reject(cancelled());
          signal.addEventListener('abort', onAbort, {once:true});
        }
      }),
    ]);
  } finally { clearTimeout(timer); if (onAbort) signal.removeEventListener('abort', onAbort); }
}

// One process / one configured editor. This is NOT an editor-native lock,
// a cross-process mutex, rollback, or proof of target identity.
export class EditorQueue {
  #tail = Promise.resolve();
  #pending = 0;
  #uncertain = null;

  constructor({ maxPending = 32 } = {}) {
    if (!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 1024) {
      throw new NexusError('INVALID_CONFIGURATION', 'Queue capacity must be an integer from 1 to 1024.');
    }
    this.maxPending = maxPending;
  }
  get status() {
    return { pending:this.#pending, blocked:this.#uncertain !== null,
      reason:this.#uncertain === null ? null : {...this.#uncertain} };
  }

  run(task, { effect, timeoutMs, operation, prepare, isUncertain = () => false, signal }) {
    if (this.#pending >= this.maxPending) {
      return Promise.reject(new NexusError('QUEUE_FULL', 'The editor queue is full.'));
    }
    this.#pending += 1;
    const job = this.#tail.then(async () => {
      checkAbort(signal);
      if (this.#uncertain !== null) {
        throw new NexusError('EDITOR_OUTCOME_UNKNOWN',
          'Execution is fenced after an uncertain call. Reconcile externally; no automatic retry or reset is provided.');
      }
      // Preparation is serialized too, but MUST NOT execute the requested operation.
      // A late preparation result cannot dispatch: only this continuation may do so.
      // Its failures retain their real codes and do not imply a dispatched mutation.
      const prepared = prepare ? await bounded(prepare, timeoutMs, 'BACKEND_PREPARATION_TIMEOUT',
        'Backend preparation timed out before dispatch: ' + operation, signal) : undefined;
      let dispatched = false;
      try {
        const result = await bounded(() => {
          checkAbort(signal);
          dispatched = true;
          return task(prepared);
        }, timeoutMs, 'BACKEND_TIMEOUT',
        'Timeout after dispatch: ' + operation + '; backend work may still be running.', signal);
        if (isUncertain(result)) {
          this.#uncertain = {operation,effect,code:'NATIVE_WORK_OUTSTANDING'};
        }
        // Keep the native queued/timeout receipt. Future work is fenced even
        // though this call returned a syntactically valid MCP response.
        return result;
      } catch (error) {
        if (!dispatched) throw error;
        // Even a read can remain on the game thread after a transport timeout.
        this.#uncertain = {operation,effect,code:error?.code ?? 'BACKEND_TRANSPORT_ERROR'};
        const failure = new NexusError('EDITOR_OUTCOME_UNKNOWN',
          'No automatic retry: ' + operation + ' has an uncertain outcome. Inspect outstanding work before restarting Nexus.');
        if (error?.backendResult && Array.isArray(error.backendResult.content)) failure.backendResult = error.backendResult;
        throw failure;
      }
    });
    this.#tail = job.catch(() => {});
    return job.finally(() => { this.#pending -= 1; });
  }
}
