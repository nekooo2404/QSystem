import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateGate } from '../src/gates.js';
import { Harness } from '../src/harness.js';
import { JsonlLedger } from '../src/ledger.js';
import { JsonlMemoryStore } from '../src/memory.js';
import { softwareDeliveryWorkflow } from '../src/company.js';
import { AgentRegistry } from '../src/registry.js';
import type { AgentAdapter } from '../src/types.js';

const mandatoryContext = { files: [], sha256: 'test-context', prompt: 'required context' };

describe('evidence gates and ledger', () => {
  it('fails closed when required evidence is absent and detects tampering', () => {
    const task = { id: 'verify', title: 'Verify', role: 'qa', dependsOn: [], gate: 'verification' as const, requiredEvidence: ['test-results'] };
    expect(evaluateGate(task, []).status).toBe('failed');
    const file = join(mkdtempSync(join(tmpdir(), 'qsystem-harness-')), 'run.jsonl');
    const ledger = new JsonlLedger(file);
    ledger.append({ type: 'run.started', runId: 'run-1', at: new Date(0).toISOString() });
    ledger.append({ type: 'run.completed', runId: 'run-1', at: new Date(0).toISOString() });
    ledger.verify();
    expect(readFileSync(file, 'utf8').trim().split(/\r?\n/)).toHaveLength(2);
  });

  it('blocks a run when the company has no configured agent for the first role', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'qsystem-harness-')), 'run.jsonl');
    const adapter: AgentAdapter = { id: 'test', execute: async () => ({ status: 'completed', summary: 'unexpected', evidence: [] }) };
    const result = await new Harness(new AgentRegistry(), adapter, new JsonlLedger(file), mandatoryContext).run(softwareDeliveryWorkflow, 'test objective');
    expect(result.status).toBe('blocked');
    expect(result.results.discovery.error).toBe('AGENT_FOR_ROLE_MISSING: product');
  });

  it('resumes completed tasks from the hash-chained ledger without rerunning them', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'qsystem-harness-')), 'run.jsonl');
    let executions = 0;
    const adapter: AgentAdapter = {
      id: 'test',
      execute: async () => {
        executions += 1;
        return { status: 'completed', summary: 'done', evidence: [] };
      },
    };
    const workflow = { id: 'tiny', tasks: [
      { id: 'one', title: 'One', role: 'product', dependsOn: [], requiredEvidence: [] },
      { id: 'two', title: 'Two', role: 'product', dependsOn: ['one'], requiredEvidence: [] },
    ] };
    const registry = new AgentRegistry([{ id: 'agent', provider: 'generic', mode: 'cli', roles: ['product'], capabilities: [], command: 'test-agent' }]);
    const first = await new Harness(registry, adapter, new JsonlLedger(file), mandatoryContext).run(workflow, 'objective', { runId: 'run-1' });
    const resumed = await new Harness(registry, adapter, new JsonlLedger(file), mandatoryContext).run(workflow, 'objective', { runId: first.runId, resume: true });
    expect(first.status).toBe('completed');
    expect(resumed.status).toBe('completed');
    expect(executions).toBe(2);
  });

  it('passes the first agent handoff and similar work to the next agent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qsystem-harness-'));
    const memory = new JsonlMemoryStore(join(dir, 'memory.jsonl'));
    let nextSnapshot: { inbox: unknown[]; similarTasks: unknown[] } | undefined;
    const adapter: AgentAdapter = {
      id: 'test',
      execute: async (context) => {
        if (context.task.id === 'discovery') return { status: 'completed', summary: 'Defined notification retry requirements', evidence: [], messages: [{ to: 'architect-agent', subject: 'Discovery handoff', content: 'Retry requires a dead-letter path' }] };
        nextSnapshot = context.sharedMemory;
        return { status: 'completed', summary: 'Designed notification retry', evidence: [] };
      },
    };
    const registry = new AgentRegistry([
      { id: 'product-agent', provider: 'generic', mode: 'cli', roles: ['product'], capabilities: [], command: 'test-agent' },
      { id: 'architect-agent', provider: 'generic', mode: 'cli', roles: ['architect'], capabilities: [], command: 'test-agent' },
    ]);
    const workflow = { id: 'handoff', tasks: [
      { id: 'discovery', title: 'Define notification retry', role: 'product', dependsOn: [], requiredEvidence: [] },
      { id: 'architecture', title: 'Design notification retry', role: 'architect', dependsOn: ['discovery'], requiredEvidence: [] },
    ] };
    const result = await new Harness(registry, adapter, new JsonlLedger(join(dir, 'run.jsonl')), mandatoryContext, memory).run(workflow, 'notification retry');
    expect(result.status).toBe('completed');
    expect(nextSnapshot?.inbox).toHaveLength(1);
    expect(nextSnapshot?.similarTasks.length).toBeGreaterThan(0);
  });
});
