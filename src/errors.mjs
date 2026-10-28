export class NexusError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NexusError';
    this.code = code;
  }
}

const cleanupFailures = new WeakSet();
export function markCleanupIncomplete(error) { cleanupFailures.add(error); return error; }
export function cleanupIncomplete(error) { return typeof error === 'object' && error !== null && cleanupFailures.has(error); }

// Bound cleanup independently of the operation; timeout does not cancel cleanup.
export async function boundedCleanup(work, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new NexusError(
        'BACKEND_CLOSE_TIMEOUT', 'Backend cleanup did not finish before its deadline.')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
