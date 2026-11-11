# Agent Protocol v1

The stable seam is a task envelope plus an append-only event stream. A provider
adapter may translate this envelope to its native CLI or IDE integration, but
the provider must not change the Harness lifecycle rules.

Governance order is mandatory: `constitution -> specify -> plan -> implement -> tasks`.
The adapter must refuse a stage when its predecessor artifact is missing.

## Task input

```json
{
  "runId": "run-id",
  "taskId": "implementation",
  "objective": "The user outcome",
  "title": "Implement the approved plan",
  "role": "backend",
  "agentId": "backend-agent",
  "mandatoryContextSha256": "sha256-of-required-files",
  "mandatoryContext": "The required file contents are injected here",
  "sharedMemory": {
    "digest": "sha256-of-memory-snapshot",
    "recent": [],
    "similarTasks": [],
    "inbox": []
  }
}
```

## Result output

```json
{
  "status": "completed",
  "summary": "What was done",
  "evidence": [
    { "kind": "tests", "summary": "12 tests passed", "path": "artifacts/test.log" }
  ],
  "messages": [
    { "to": "qa-agent", "subject": "Handoff", "content": "Verify retry behavior" }
  ]
}
```

Unknown or missing evidence is a failed gate. Plain text output can be retained
as diagnostic output, but it cannot satisfy a typed evidence gate by itself.
The process may return `interrupted` when the OS or user ends it before a normal
exit; that state is resumable and must not be rewritten as `completed`.

## Lifecycle rules

The adapter may emit heartbeats and output events. Heartbeats are observability,
not a lease. The Harness must not infer cancellation from a missing heartbeat,
window focus, rate-limit display, or a provider-specific stop event.
