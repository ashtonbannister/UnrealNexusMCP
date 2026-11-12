import {ProtocolError} from '@modelcontextprotocol/client';
import {NexusError} from './errors.mjs';

export const PROVIDER_RESOURCE_PREFIX = 'unreal-nexus-provider://';
export const PROVIDER_GUIDANCE_URI = 'unreal-nexus://guidance/providers';
const named = (provider, name) => `${provider}__${name}`;
const resourceUri = (provider, uri) => `${PROVIDER_RESOURCE_PREFIX}${provider}/${uri}`;

// A complete live MCP surface, backed by the SAME connections and editor queue
// as the canonical routes. Provider code owns its schemas and implementation.
export class ProviderSurface {
  #providers;
  #getBackend;
  #queue;
  #allowWrites;
  #timeoutMs;
  #tools = new Map();
  #subscriptions = new Map();
  #listeners = new Set();

  constructor({providers, getBackend, queue, allowWrites, timeoutMs}) {
    this.#providers = new Set(providers);
    this.#getBackend = getBackend;
    this.#queue = queue;
    this.#allowWrites = allowWrites;
    this.#timeoutMs = timeoutMs;
  }

  get providers() { return [...this.#providers]; }

  #splitName(name) {
    if (typeof name !== 'string') return null;
    const separator = name.indexOf('__');
    const provider = name.slice(0, separator);
    return separator > 0 && this.#providers.has(provider)
      ? {provider, name:name.slice(separator + 2)} : null;
  }

  isTool(name) { return this.#splitName(name) !== null; }
  isPrompt(name) { return this.#splitName(name) !== null; }

  parseResource(uri) {
    if (typeof uri !== 'string' || !uri.startsWith(PROVIDER_RESOURCE_PREFIX)) return null;
    const rest = uri.slice(PROVIDER_RESOURCE_PREFIX.length);
    const separator = rest.indexOf('/');
    const provider = rest.slice(0, separator);
    return separator > 0 && this.#providers.has(provider)
      ? {provider, uri:rest.slice(separator + 1)} : null;
  }

  onNotification(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #backend(provider, options) {
    const backend = await this.#getBackend(provider, options);
    if (!this.#subscriptions.has(provider)) {
      const unsubscribe = backend.onNotification?.(notification => {
        if (notification.method === 'notifications/tools/list_changed') this.#tools.delete(provider);
        const forwarded = notification.method === 'notifications/resources/updated'
          ? {...notification, params:{...notification.params, uri:resourceUri(provider, notification.params.uri)}}
          : notification;
        for (const listener of this.#listeners) listener(forwarded);
      });
      this.#subscriptions.set(provider, unsubscribe);
    }
    return backend;
  }

  async #listTools(provider, options) {
    const backend = await this.#backend(provider, options);
    const tools = await backend.listTools(options);
    this.#tools.set(provider, new Map(tools.map(tool => [tool.name, tool])));
    return tools.map(tool => ({...tool, name:named(provider, tool.name)}));
  }

  async listTools(options = {}) {
    // A failed provider fails discovery explicitly; never advertise a silently
    // incomplete union as the master toolset. Transport handles all pages.
    return (await Promise.all(this.providers.map(provider => this.#listTools(provider, options)))).flat();
  }

  async #invoke(provider, operation, effect, work, options = {}, preflight) {
    const receipt = await this.#queue.run(async backend => {
      try { return {value:await work(backend)}; }
      catch (error) {
        // A received JSON-RPC refusal is a completed response, not a lost
        // transport. Preserve code/message/data and do not replay the call.
        if (error instanceof ProtocolError) return {protocolError:error};
        throw error;
      }
    }, {
      effect, operation, timeoutMs:this.#timeoutMs, signal:options.signal,
      prepare:async () => {
        const backend = await this.#backend(provider, options);
        await preflight?.(backend);
        await backend.attestIdentity({...options, timeoutMs:this.#timeoutMs});
        return backend;
      },
    });
    if (receipt.protocolError) throw receipt.protocolError;
    return receipt.value;
  }

  async callTool(name, args = {}, options = {}) {
    const route = this.#splitName(name);
    if (!route) throw new NexusError('PROVIDER_TOOL_NOT_FOUND', 'Unknown namespaced provider tool.');
    return this.#invoke(route.provider, name, 'provider', backend =>
      backend.callTool(route.name, args, {...options, timeoutMs:this.#timeoutMs}), options, async () => {
      if (!this.#tools.has(route.provider)) await this.#listTools(route.provider, options);
      const tool = this.#tools.get(route.provider).get(route.name);
      if (!tool) throw new NexusError('PROVIDER_TOOL_NOT_FOUND', 'The provider does not advertise this tool.');
      if (!this.#allowWrites && tool.annotations?.readOnlyHint !== true)
        throw new NexusError('WRITES_DISABLED', 'This provider tool may write. Enable allowWrites in the host configuration.');
    });
  }

  async #list(method, field, capability, transform, options = {}) {
    return (await Promise.all(this.providers.map(async provider => {
      const backend = await this.#backend(provider, options);
      if (!backend.capabilities?.[capability]) return [];
      const entries = [];
      const cursors = new Set();
      let cursor;
      for (let page = 0; page < 256; page++) {
        const result = await backend.request(method, cursor === undefined ? {} : {cursor}, options);
        entries.push(...result[field].map(entry => transform(provider, entry)));
        if (result.nextCursor === undefined) return entries;
        if (cursors.has(result.nextCursor)) throw new NexusError('BACKEND_CURSOR_CYCLE', 'Provider listing repeated a cursor.');
        cursors.add(result.nextCursor);
        cursor = result.nextCursor;
      }
      throw new NexusError('BACKEND_PAGE_LIMIT', 'Provider listing exceeded the page limit.');
    }))).flat();
  }

  listResources(options) {
    return this.#list('resources/list', 'resources', 'resources', (provider, entry) =>
      ({...entry, uri:resourceUri(provider, entry.uri)}), options);
  }

  listResourceTemplates(options) {
    return this.#list('resources/templates/list', 'resourceTemplates', 'resources', (provider, entry) =>
      ({...entry, uriTemplate:resourceUri(provider, entry.uriTemplate)}), options);
  }

  listPrompts(options) {
    return this.#list('prompts/list', 'prompts', 'prompts', (provider, entry) =>
      ({...entry, name:named(provider, entry.name)}), options);
  }

  requestResource(method, params, options = {}) {
    const route = this.parseResource(params.uri);
    if (!route) throw new NexusError('PROVIDER_RESOURCE_NOT_FOUND', 'Unknown namespaced provider resource.');
    return this.#invoke(route.provider, method, 'read', backend =>
      backend.request(method, {...params, uri:route.uri}, {...options, timeoutMs:this.#timeoutMs}), options);
  }

  getPrompt(params, options = {}) {
    const route = this.#splitName(params.name);
    if (!route) throw new NexusError('PROVIDER_PROMPT_NOT_FOUND', 'Unknown namespaced provider prompt.');
    return this.#invoke(route.provider, 'prompts/get', 'read', backend =>
      backend.request('prompts/get', {...params, name:route.name}, {...options, timeoutMs:this.#timeoutMs}), options);
  }

  complete(params, options = {}) {
    const route = params.ref.type === 'ref/prompt' ? this.#splitName(params.ref.name) : this.parseResource(params.ref.uri);
    if (!route) throw new NexusError('PROVIDER_REFERENCE_NOT_FOUND', 'Unknown namespaced completion reference.');
    const ref = params.ref.type === 'ref/prompt' ? {...params.ref, name:route.name} : {...params.ref, uri:route.uri};
    return this.#invoke(route.provider, 'completion/complete', 'read', backend =>
      backend.request('completion/complete', {...params, ref}, {...options, timeoutMs:this.#timeoutMs}), options);
  }

  async guidance(options) {
    const sections = await Promise.all(this.providers.map(async provider => {
      const backend = await this.#backend(provider, options);
      return `## ${provider}\n\nUse ${provider}__ before each native tool or prompt name. `
        + `Prefix native resource URIs with ${resourceUri(provider, '')}.\n\n`
        + (backend.instructions || 'Use the provider tool schemas and discovery operations.');
    }));
    return '# Full provider interfaces\n\nNamespacing changes routing names only. Native arguments, results, errors and content are preserved.\n\n' + sections.join('\n\n');
  }

  close() {
    for (const unsubscribe of this.#subscriptions.values()) unsubscribe?.();
    this.#subscriptions.clear();
    this.#listeners.clear();
  }
}
