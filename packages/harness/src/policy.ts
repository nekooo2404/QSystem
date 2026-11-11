import type { AgentDefinition, AgentMode, GateKind } from './types.js';

const controlHooks = new Set(['PreToolUse', 'PostToolUse', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'TeammateIdle']);

export function validateHarnessPolicy(): void {
  if (controlHooks.size !== 7) throw new Error('POLICY_SELF_CHECK_FAILED');
}

export function isControlHook(event: string): boolean {
  return controlHooks.has(event);
}

export function shouldTerminate(input: { explicitUserCancel: boolean; processExited: boolean }): boolean {
  return input.explicitUserCancel && !input.processExited;
}

export function idleAction(): 'wait' {
  return 'wait';
}

export function validateAgent(definition: AgentDefinition): void {
  if (definition.mode === 'remote') throw new Error(`REMOTE_NOT_IMPLEMENTED: ${definition.id}`);
  if (definition.mode === 'cli' && !definition.command) throw new Error(`AGENT_COMMAND_REQUIRED: ${definition.id}`);
  if (definition.mode === 'ide-hook' && definition.command) throw new Error(`IDE_HOOK_MUST_BE_PASSIVE: ${definition.id}`);
  if (definition.maxConcurrent !== undefined && definition.maxConcurrent < 1) throw new Error(`AGENT_CONCURRENCY_INVALID: ${definition.id}`);
}

export function canApprove(roleApprovals: GateKind[], gate: GateKind): boolean {
  return roleApprovals.includes(gate);
}
