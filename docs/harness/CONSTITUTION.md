# QSystem Agent Constitution

This document is binding for every CLI, IDE adapter, subagent, and Harness run
in this repository.

## Mandatory order

Every deliverable follows exactly this order:

1. `constitution` - read and accept this constitution.
2. `specify` - write the task scope, constraints, acceptance criteria, and non-goals.
3. `plan` - write the implementation plan, dependencies, risks, and verification plan.
4. `implement` - execute only the approved plan and record direct evidence.
5. `tasks` - publish the resulting task list to GitHub Issues for tracking.

An agent must not implement without completed `constitution`, `specify`, and
`plan` artifacts. An agent must not sync GitHub Issues without implementation
evidence. Missing evidence is a block, not an approval.

## Agent budget and context

Binding on every agent and subagent dispatch:

1. **Context isolation** - a subagent gets a self-contained brief, never the
   parent's history. It returns a summary, evidence, and a handoff message only.
2. **Token budget** - state the task's limit before starting; when exceeded,
   stop and report the partial result instead of continuing silently.
3. **Smart model routing** - use the cheapest tier that completes the task:
   mechanical search and listing on the small tier, test/UI edits on the middle
   tier, security, race, scope, or money logic on the strongest tier.
4. **Selective file reading** - read the files the change touches and their
   callers; never dump whole directories or the whole repository.
5. **Lazy loading** - load a skill, rule, or document only when the task needs
   it, not preemptively in the brief.
6. **Tool output filtering** - report the conclusion and the failing lines, not
   raw logs; raw CLI output stays in process logs, never in memory or issues.
7. **Context compaction** - compress long history to decisions, evidence, and
   open risks; drop superseded attempts and duplicated output.
8. **Task deduplication** - consult `sharedMemory` and the run ledger for an
   existing run of the same task before investigating it again.
9. **Prompt caching** - keep the stable prefix stable (contract, instructions,
   and tool definitions first; volatile task content last) so the cache can be
   reused across turns and runs.
10. **Budget observability** - the run result records wall time for every task
    and, when the provider reports them, token count, turn count, and retry
    count. Reporting "done" without those numbers where the agent could have
    supplied them is incomplete evidence.

## Authority and safety

- The direct user request, repository policy, and human approval outrank agent output.
- No agent may hide a failure, rewrite evidence, or mark a skipped stage complete.
- No lifecycle hook may stop an agent because it is idle or a heartbeat is late.
- GitHub mutation is explicit, authenticated, auditable, and idempotent by task key.
- Secrets never belong in specs, plans, task manifests, memory, issues, or logs.
