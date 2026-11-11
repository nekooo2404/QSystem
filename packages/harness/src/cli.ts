import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { companyRoles, softwareDeliveryWorkflow } from './company.js';
import { loadAgents } from './config.js';
import { loadMandatoryContext } from './context.js';
import { inspectClaudeSettings } from './doctor.js';
import { GitHubIssueSync, loadTaskManifest } from './github.js';
import { Harness } from './harness.js';
import { JsonlLedger } from './ledger.js';
import { JsonlMemoryStore } from './memory.js';
import { GovernanceStore } from './governance.js';
import { CommandAdapter } from './runner.js';
import { AgentRegistry } from './registry.js';
import type { AgentDefinition } from './types.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const projectRoot = findProjectRoot(process.cwd());
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});
const valueAfter = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

if (command === 'roles') {
  console.log(JSON.stringify(companyRoles, null, 2));
} else if (command === 'constitution') {
  const governance = new GovernanceStore(projectRoot);
  console.log(JSON.stringify(governance.complete('constitution', undefined, valueAfter('--artifact') ?? 'docs/harness/CONSTITUTION.md', valueAfter('--actor') ?? 'agent'), null, 2));
} else if (command === 'specify') {
  const taskId = requiredTaskId();
  const artifact = valueAfter('--artifact');
  if (!artifact) throw new Error('GOVERNANCE_ARTIFACT_REQUIRED: specify');
  console.log(JSON.stringify(new GovernanceStore(projectRoot).complete('specify', taskId, artifact, valueAfter('--actor') ?? 'agent'), null, 2));
} else if (command === 'plan') {
  const objective = valueAfter('--objective') ?? args.slice(1).filter((item) => item !== '--objective').join(' ');
  const harness = new Harness(new AgentRegistry(), new CommandAdapter(), new JsonlLedger(resolve(projectRoot, '.harness', 'runs.jsonl')));
  const plan = harness.plan(softwareDeliveryWorkflow, objective);
  const taskId = valueAfter('--task-id');
  if (taskId) {
    const artifact = artifactPath(valueAfter('--artifact') ?? `.harness/plans/${taskId}.json`);
    writeFileSync(artifact.absolute, JSON.stringify({ taskId, objective, workflow: plan }, null, 2), 'utf8');
    new GovernanceStore(projectRoot).complete('plan', taskId, artifact.relative, valueAfter('--actor') ?? 'agent');
    console.log(JSON.stringify({ artifact: artifact.relative, plan }, null, 2));
  } else {
    process.stderr.write('HARNESS_GOVERNANCE_BYPASS: plan printed without --task-id; no governance stage recorded.\n');
    console.log(JSON.stringify(plan, null, 2));
  }
} else if (command === 'run' || command === 'implement') {
  const objective = valueAfter('--objective') ?? args.slice(1).filter((item) => item !== '--objective').join(' ');
  const taskId = requiredTaskId();
  const governance = new GovernanceStore(projectRoot);
  governance.assertReadyToImplement(taskId);
  mkdirSync(resolve(projectRoot, '.harness'), { recursive: true });
  const requiredFilesPath = projectPath(valueAfter('--required-files') ?? join('.harness', 'required-files.json'));
  const requiredFiles = JSON.parse(readFileSync(requiredFilesPath, 'utf8')) as { requiredFiles?: unknown };
  if (!Array.isArray(requiredFiles.requiredFiles) || requiredFiles.requiredFiles.some((file) => typeof file !== 'string')) throw new Error('MANDATORY_CONTEXT_CONFIG_INVALID');
  const mandatoryContext = loadMandatoryContext(projectRoot, requiredFiles.requiredFiles);
  const agentsFileValue = valueAfter('--agents') ?? join('.harness', 'agents.json');
  const agentsFile = projectPath(agentsFileValue, false);
  const agents: AgentDefinition[] = agentsFile
    ? loadAgents(agentsFile, projectRoot)
    : process.env.HARNESS_AGENT_COMMAND
    ? [{ id: 'configured-cli', provider: 'generic', mode: 'cli', roles: ['product', 'architect', 'backend', 'frontend', 'qa', 'security', 'reviewer'], capabilities: ['general'], command: process.env.HARNESS_AGENT_COMMAND }]
    : [];
  const harness = new Harness(new AgentRegistry(agents), new CommandAdapter(projectRoot), new JsonlLedger(resolve(projectRoot, '.harness', 'runs.jsonl')), mandatoryContext, new JsonlMemoryStore(resolve(projectRoot, '.harness', 'memory.jsonl')));
  const resumeId = valueAfter('--resume');
  const runId = resumeId ?? randomUUID();
  process.stderr.write(`HARNESS_RUN_ID=${runId}\n`);
  const result = await harness.run(softwareDeliveryWorkflow, objective, { runId, resume: Boolean(resumeId) });
  if (result.status === 'completed') {
    const artifact = artifactPath(valueAfter('--artifact') ?? `.harness/artifacts/${taskId}-implementation.json`);
    writeFileSync(artifact.absolute, JSON.stringify({ taskId, objective, result }, null, 2), 'utf8');
    governance.complete('implement', taskId, artifact.relative, valueAfter('--actor') ?? 'agent');
  }
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'tasks') {
  if (args[1] !== 'sync') throw new Error('Usage: harness tasks sync --task-id <id> --manifest <path> [--repo owner/name]');
  const taskId = requiredTaskId();
  const governance = new GovernanceStore(projectRoot);
  governance.assertReadyForTasks(taskId);
  const manifestPath = valueAfter('--manifest');
  if (!manifestPath) throw new Error('TASK_MANIFEST_REQUIRED');
  const manifest = loadTaskManifest(projectPath(manifestPath));
  if (manifest.taskId !== taskId) throw new Error(`TASK_MANIFEST_ID_MISMATCH: ${manifest.taskId}`);
  const synced = new GitHubIssueSync(valueAfter('--repo') ?? inferGitHubRepo()).sync(manifest);
  const artifact = artifactPath(`.harness/artifacts/${taskId}-github-issues.json`);
  writeFileSync(artifact.absolute, JSON.stringify({ taskId, repo: valueAfter('--repo') ?? inferGitHubRepo(), synced }, null, 2), 'utf8');
  governance.complete('tasks', taskId, artifact.relative, valueAfter('--actor') ?? 'agent');
  console.log(JSON.stringify({ taskId, synced }, null, 2));
} else if (command === 'governance') {
  if (args[1] !== 'status') throw new Error('Usage: harness governance status --task-id <id>');
  console.log(JSON.stringify(new GovernanceStore(projectRoot).status(valueAfter('--task-id')), null, 2));
} else if (command === 'context') {
  const requiredFilesPath = projectPath(valueAfter('--required-files') ?? join('.harness', 'required-files.json'));
  const requiredFiles = JSON.parse(readFileSync(requiredFilesPath, 'utf8')) as { requiredFiles?: unknown };
  if (!Array.isArray(requiredFiles.requiredFiles) || requiredFiles.requiredFiles.some((file) => typeof file !== 'string')) throw new Error('MANDATORY_CONTEXT_CONFIG_INVALID');
  console.log(loadMandatoryContext(projectRoot, requiredFiles.requiredFiles).prompt);
} else if (command === 'memory') {
  mkdirSync(resolve(projectRoot, '.harness'), { recursive: true });
  const memory = new JsonlMemoryStore(resolve(projectRoot, '.harness', 'memory.jsonl'));
  const action = args[1] ?? 'status';
  if (action === 'search') {
    console.log(JSON.stringify(memory.search({ text: valueAfter('--query') ?? args.slice(2).join(' '), limit: Number(valueAfter('--limit') ?? 20) }), null, 2));
  } else if (action === 'similar') {
    console.log(JSON.stringify(memory.findSimilarTasks(valueAfter('--task') ?? args.slice(2).join(' '), Number(valueAfter('--limit') ?? 5)), null, 2));
  } else if (action === 'inbox') {
    const agentId = valueAfter('--agent');
    if (!agentId) throw new Error('MEMORY_AGENT_REQUIRED');
    console.log(JSON.stringify(memory.inbox(agentId, Number(valueAfter('--limit') ?? 20)), null, 2));
  } else if (action === 'send') {
    const from = valueAfter('--from') ?? 'cli';
    const to = valueAfter('--to');
    const message = valueAfter('--message') ?? args.slice(2).join(' ');
    if (!message.trim()) throw new Error('MEMORY_MESSAGE_REQUIRED');
    console.log(JSON.stringify(memory.append({ kind: 'message', agentId: from, toAgentId: to, title: valueAfter('--subject') ?? `Message from ${from}`, content: message, tags: ['manual'], relatedTaskIds: [] }), null, 2));
  } else if (action === 'status') {
    memory.verify();
    const records = memory.search({ limit: 100_000 });
    console.log(JSON.stringify({ file: resolve(projectRoot, '.harness', 'memory.jsonl'), records: records.length, last: records[0] ?? null, status: 'ok' }, null, 2));
  } else {
    console.log('Usage: harness memory search --query "..." | similar --task "..." | inbox --agent <id> | send --from <id> [--to <id>] --message "..." | status');
  }
} else if (command === 'doctor') {
  const settingsPath = valueAfter('--settings') ?? join(homedir(), '.claude', 'settings.json');
  const findings = inspectClaudeSettings(JSON.parse(readFileSync(settingsPath, 'utf8')));
  console.log(JSON.stringify({ settingsPath, status: findings.some((finding) => finding.level === 'error') ? 'fail' : 'pass', findings }, null, 2));
  if (findings.some((finding) => finding.level === 'error')) process.exitCode = 1;
} else {
  console.log('Usage: harness roles | constitution | specify | plan | run | implement | tasks sync | governance status | context | memory ... | doctor');
}

function projectPath(value: string): string;
function projectPath(value: string, required: false): string | undefined;
function projectPath(value: string, required = true): string | undefined {
  const path = isAbsolute(value) ? value : resolve(projectRoot, value);
  if (required || existsSync(path)) return path;
  return undefined;
}

function findProjectRoot(start: string): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, '.harness', 'required-files.json'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

function requiredTaskId(): string {
  const taskId = valueAfter('--task-id');
  if (!taskId?.trim()) throw new Error('GOVERNANCE_TASK_ID_REQUIRED');
  return taskId;
}

function artifactPath(value: string): { absolute: string; relative: string } {
  if (!value || isAbsolute(value)) throw new Error(`GOVERNANCE_ARTIFACT_PATH_INVALID: ${value}`);
  const absolute = resolve(projectRoot, value);
  const relativePath = relative(projectRoot, absolute);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) throw new Error(`GOVERNANCE_ARTIFACT_PATH_ESCAPE: ${value}`);
  mkdirSync(dirname(absolute), { recursive: true });
  return { absolute, relative: relativePath.replaceAll(sep, '/') };
}

function inferGitHubRepo(): string {
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const match = remote.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (!match) throw new Error(`GITHUB_REMOTE_NOT_GITHUB: ${remote}`);
  return match[1];
}
