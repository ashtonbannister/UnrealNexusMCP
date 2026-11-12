// Explicit reviewed compatibility relation; revisions are never ordered generically.
export function compatibilitySatisfied(provider, required, actual) {
  return actual === required || (provider === 'ue-mcp' && required === 'ue-mcp-nexus-pagination-count-v1' && ['ue-mcp-nexus-guarded-save-v2','ue-mcp-nexus-direct-pie-v1','ue-mcp-nexus-owned-hold-v1','ue-mcp-nexus-checked-delete-v1'].includes(actual))
    || (provider === 'ue-mcp' && required === 'ue-mcp-nexus-guarded-save-v2' && ['ue-mcp-nexus-direct-pie-v1','ue-mcp-nexus-owned-hold-v1','ue-mcp-nexus-checked-delete-v1'].includes(actual))
    || (provider === 'ue-mcp' && required === 'ue-mcp-nexus-direct-pie-v1' && ['ue-mcp-nexus-owned-hold-v1','ue-mcp-nexus-checked-delete-v1'].includes(actual))
    || (provider === 'ue-mcp' && required === 'ue-mcp-nexus-owned-hold-v1' && actual === 'ue-mcp-nexus-checked-delete-v1')
    || (provider === 'claireon' && required === 'claireon-nexus-no-autosave-v1' && actual === 'claireon-nexus-compile-loaded-v2')
    || (provider === 'hayba' && required === 'hayba-nexus-no-retry-v1' && actual === 'hayba-nexus-material-receipt-v2')
    || (provider === 'unrealagentplayer'
    && ((required === 'uap-nexus-no-replay-v1' && ['uap-nexus-strict-status-v2','uap-nexus-queued-status-v3','uap-nexus-owned-pie-v4'].includes(actual))
      || (required === 'uap-nexus-strict-status-v2' && ['uap-nexus-queued-status-v3','uap-nexus-owned-pie-v4'].includes(actual))
      || (required === 'uap-nexus-queued-status-v3' && actual === 'uap-nexus-owned-pie-v4')));
}
