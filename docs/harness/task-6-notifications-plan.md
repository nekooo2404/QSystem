# Task 6 Plan: Notifications

1. Write `apps/api/test/notify.spec.ts` for enqueue, retry/dead-letter,
   interruption recovery, and scoped offline reads. Capture RED evidence.
2. Add the minimum API module, outbox service, worker, provider interfaces and
   local providers required by those tests.
3. Register the module in `AppModule` without changing IAM/RLS behavior.
4. Run the focused notification suite, API suite sequentially, and TypeScript
   typecheck. Capture GREEN evidence.
5. Run the independent review/security and local Tester gates before marking the
   implementation complete.

Risks: BullMQ/Redis and provider packages may be absent; use existing workspace
dependencies or a local deterministic adapter and record the limitation. Do not
add credentials or call external providers during tests.
