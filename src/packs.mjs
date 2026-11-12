import packs from '../catalog/packs.json' with { type: 'json' };
import { NexusError } from './errors.mjs';

export function selectCapabilities(catalog, { enabledPacks = [], enabledCapabilities = [] } = {}) {
  if (!Array.isArray(enabledPacks) || !Array.isArray(enabledCapabilities)) {
    throw new NexusError('INVALID_CONFIGURATION', 'Enabled packs/capabilities must be arrays.');
  }
  const selected = new Set(enabledCapabilities);
  for (const id of enabledPacks) {
    const pack = packs.packs.find((p) => p.id === id);
    if (!pack) throw new NexusError('UNKNOWN_PACK', 'Unknown capability pack: ' + id);
    if (pack.status === 'adapter-required') {
      throw new NexusError('ADAPTER_REQUIRED', 'This optional specialist pack is not implemented: ' + id);
    }
    for (const operation of pack.operations) selected.add(operation);
  }
  for (const id of selected) catalog.get(id);
  return [...selected].sort();
}
