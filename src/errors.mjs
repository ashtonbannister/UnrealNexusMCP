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
