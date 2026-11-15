# Task 6 Specify: Notifications

Task ID: `qsystem-task-6`

## Scope

Implement the QSystem notification module behind the existing Prisma/CASL
contracts: outbox enqueue, local worker/provider adapters, retry/dead-letter
behavior, socket namespace/rooms, and `GET /notifications` offline sync.

## Acceptance criteria

- `NotifyService.enqueue` persists a pending notification and enqueues work in
  the same transaction boundary.
- Provider failure retries at most three times and ends in failed/dead-letter
  state with direct test evidence.
- A worker interruption leaves pending work recoverable.
- Email, Viber fallback, Socket.IO, VideoProvider mock, and AiProvider mock have
  explicit interfaces and no production credentials in source.
- Offline notification reads respect the existing viewer scope.
- Focused tests, typecheck, and the local Tester pass.

## Non-goals

- No frontend/UI work.
- No live provider credentials or production deployment.
- No real LiveKit/OpenAI integration; interfaces and local mocks only.
