// Explicit reviewed compatibility relation; revisions are never ordered generically.
export function compatibilitySatisfied(provider, required, actual) {
  return actual === required || (provider === 'unrealagentplayer'
    && required === 'uap-nexus-no-replay-v1' && actual === 'uap-nexus-strict-status-v2');
}
