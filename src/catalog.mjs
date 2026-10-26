import operations from '../catalog/operations.json' with { type: 'json' };
import upstreams from '../catalog/upstreams.lock.json' with { type: 'json' };
import decisions from '../catalog/decisions.json' with { type: 'json' };
import { compileSchema } from './validation.mjs';
import { NexusError } from './errors.mjs';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const loadCatalog = () => new Catalog(operations, upstreams, decisions);

export class Catalog {
  #operations = new Map();
  #validators = new Map();

  constructor(document, sourceLock, decisionDocument) {
    this.upstreams = freeze(structuredClone(sourceLock));
    const decisionMap = new Map();
    for (const decision of decisionDocument.decisions) {
      if (decisionMap.has(decision.id)) throw new Error('Duplicate decision ' + decision.id);
      decisionMap.set(decision.id, decision);
    }
    const contracts = new Set();
    const routes = new Set();
    for (const original of document.operations) {
      const operation = freeze(structuredClone(original));
      if (!/^[a-z][a-z0-9_.-]+$/.test(operation.id) || this.#operations.has(operation.id)) {
        throw new Error('Invalid or duplicate operation id: ' + operation.id);
      }
      const decision = decisionMap.get(operation.decision);
      if (!this.upstreams.sources[operation.provider] || !decision
        || decision.status !== 'selected' || decision.winner.provider !== operation.provider
        || !decision.operations.includes(operation.id)) {
        throw new Error('Missing executable selection evidence for ' + operation.id);
      }
      if (!['read', 'write', 'destructive', 'lifecycle'].includes(operation.effect)) {
        throw new Error('Invalid effect for ' + operation.id);
      }
      if (!operation.contract || contracts.has(operation.contract)) throw new Error('Duplicate semantic contract');
      contracts.add(operation.contract);
      const route = operation.route;
      const validRoute = (route?.kind === 'direct' && operation.provider === 'unrealagentplayer' && typeof route.tool === 'string')
        || (route?.kind === 'ue-micro' && operation.provider === 'ue-mcp' && typeof route.category === 'string' && typeof route.method === 'string')
        || (route?.kind === 'enginewire' && operation.provider === 'enginewire' && typeof route.tool === 'string' && typeof route.action === 'string');
      if (!validRoute) throw new Error('Unimplemented provider/adapter for ' + operation.id);
      const routeKey = [operation.provider, route.kind, route.tool ?? route.category,
        route.action ?? route.method ?? '', JSON.stringify(Object.entries(route.fixed ?? {}).sort())].join('|');
      if (routes.has(routeKey)) throw new Error('Duplicate native route for ' + operation.id);
      routes.add(routeKey);
      if (operation.parameters.type !== 'object' || operation.parameters.additionalProperties !== false) {
        throw new Error('Parameters must reject unreviewed fields for ' + operation.id);
      }
      for (const key of Object.keys(route.fixed ?? {})) {
        if (Object.hasOwn(operation.parameters.properties, key)) throw new Error('Fixed field is caller-editable: ' + key);
      }
      if (!Array.isArray(operation.postconditions) || !operation.postconditions.length) throw new Error('Missing postconditions');
      this.#validators.set(operation.id, compileSchema(operation.parameters));
      this.#operations.set(operation.id, operation);
    }
    for (const decision of decisionMap.values()) {
      if (decision.status === 'selected') {
        for (const id of decision.operations) {
          if (!this.#operations.has(id)) throw new Error('Selection references missing operation ' + id);
        }
      }
    }
  }

  get size() { return this.#operations.size; }
  list() { return [...this.#operations.values()]; }

  get(id) {
    const operation = this.#operations.get(id);
    if (!operation) throw new NexusError('OPERATION_NOT_EXPOSED', 'Unknown or excluded Nexus operation: ' + id);
    return operation;
  }

  validate(id, args) {
    const operation = this.get(id);
    this.#validators.get(id)(args);
    return operation;
  }

  describe(id) {
    return { ...this.get(id), source: this.upstreams.sources[this.get(id).provider],
      qualification: 'source-reviewed; live Unreal qualification pending' };
  }

  search(query = '', limit = 10) {
    if (typeof query !== 'string' || query.length > 256 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new NexusError('INVALID_SEARCH', 'Query maximum 256 characters; integer limit 1–50.');
    }
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.list().map((op) => ({ op, score: words.reduce((n, w) =>
      n + Number((op.id + ' ' + op.description).toLowerCase().includes(w)), 0) }))
      .filter(({score}) => !words.length || score > 0)
      .sort((a,b) => b.score - a.score || a.op.id.localeCompare(b.op.id))
      .slice(0,limit).map(({op}) => ({id:op.id,description:op.description,effect:op.effect,provider:op.provider}));
  }
}
