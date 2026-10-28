import { NexusError } from './errors.mjs';
import { buildSpecialistCall, specialistNativeToolName } from './specialist-adapters.mjs';

// Fixed, reviewed routes only. No user-selected provider, native action,
// arbitrary Python, automatic fallback or synthetic native consent.
export function buildCall(operation, args) {
  const route = operation.route;
  const params = { ...structuredClone(args), ...route.fixed };
  switch (route.kind) {
    case 'direct':
      return { name: route.tool, arguments: params };
    case 'ue-micro':
      return { name: 'tools', arguments: { action: 'call', category: route.category, method: route.method, args: params } };
    case 'enginewire':
      return { name: 'unreal', arguments: { operation: 'execute', tool: route.tool, action: route.action, params } };
    case 'claireon-specialist':
    case 'hayba-specialist':
      return buildSpecialistCall(operation, args);
    default:
      throw new NexusError('ADAPTER_REQUIRED', 'No reviewed adapter for ' + operation.id);
  }
}
export function nativeToolName(operation) {
  if (operation.route.kind.endsWith('-specialist')) return specialistNativeToolName(operation);
  return operation.route.kind === 'ue-micro' ? 'tools'
    : operation.route.kind === 'enginewire' ? 'unreal' : operation.route.tool;
}
