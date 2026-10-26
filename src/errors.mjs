export class NexusError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NexusError';
    this.code = code;
  }
}
