# QSystem Production Operations & Runbook

This runbook defines release verification, backup/restore drills, storage lifecycle, search rebuilds, observability, secret rotation, TLS ingress, scaling, and rollback procedures for QSystem (`apps/api`, `apps/web`, PostgreSQL, S3-compatible object storage, Meilisearch, and Redis).

## 1. Environment Separation & Secret Management

| Environment | Purpose | Runtime Config | Secrets Source |
| :--- | :--- | :--- | :--- |
| Development | Local feature work | `NODE_ENV=development` | Developer `.env` (gitignored, non-prod credentials only) |
| Staging | Pre-release smoke, migration drill, E2E | `APP_ENV=staging`, `COOKIE_SECURE=true`, `COOKIE_PATH=/` | Container/orchestrator secret mounts (`*_FILE`) |
| Production | Live tenant traffic | `APP_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_PATH=/`, `STRICT_CSRF_ORIGIN=true` | Secret manager (AWS Secrets Manager / Vault / K8s Sealed Secrets) mounted to `/run/secrets/*` |

Rules enforced by `apps/api/src/config/env.config.ts`:
- This checkout explicitly runs in `TENANCY_MODE=single-tenant`; the UI does not
  expose a fake tenant/workspace switcher. Multi-tenant SaaS requires a separate
  organization/membership/RLS rollout before it can be enabled.
- Production/staging startup fails closed (`validateRuntimeEnv()`) if any required secret (`JWT_SECRET`, `DATABASE_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `MEILI_MASTER_KEY`, or `REDIS_URL` when Redis rate limiting is enabled) is missing, too short, or matches a development placeholder.
- Every secret key supports `<KEY>_FILE` (e.g. `JWT_SECRET_FILE=/run/secrets/jwt_secret`) so plain secret values never sit in container environment inspection or CI logs.
- Never commit real credentials or run `prisma migrate dev` outside local development. Release pipelines run `prisma migrate deploy` only under the `RLS_OWNER_URL` maintenance credential, while runtime pods connect via the RLS-restricted `qsystem_app` PostgreSQL role (`DATABASE_URL`).

## 2. PostgreSQL Backup, Restore Verification & Migration Rollback

### Backup & Retention Policy
- **Automated physical WAL/base backups + PITR**: Continuous WAL archiving every 5 minutes (RPO <= 5 minutes; RTO <= 30 minutes).
- **Logical daily snapshots** (`pg_dump --format=custom --no-owner --no-acl` against replica or read-consistent snapshot):
  - Daily snapshots retained **30 days**.
  - Weekly snapshots retained **90 days**.
  - Monthly archive retained **365 days** (encrypted with KMS).

### Quarterly Restore Drill
1. Provision an isolated scratch Postgres 16 instance.
2. Restore latest base backup + replay WAL to target timestamp (or `pg_restore` latest daily dump).
3. Run integrity & RLS checks:
   - Verify all tables, row counts, and RLS enabled (`SELECT relname, relrowsecurity FROM pg_class WHERE relrowsecurity = true;`).
   - Run `corepack pnpm --filter api db:migrate:deploy` cleanly (`No pending migrations`).
   - Execute `node scripts/ops/smoke-check.mjs` against a staging API pointed at the restored database.
4. Record restore duration (RTO verification) and checksums in the operations log.

### Migration Rollback Plan
- QSystem uses **forward-only additive migrations**. Never run `prisma migrate reset` in staging or production.
- **Before deploying a schema change**: take an on-demand pre-release Postgres snapshot.
- **If a deployment fails after `prisma migrate deploy`**:
  1. Roll application containers (`api`, `web`) back to the previous immutable image digest first (schema changes must remain backward-compatible with `N-1` application code).
  2. If the migration itself corrupted state and application rollback is insufficient, deploy a new forward corrective migration (`prisma migrate deploy`) or restore PostgreSQL from the pre-release PITR/snapshot taken in step 1.

## 3. S3-Compatible Storage Lifecycle & Backup

- **Buckets**: configure `S3_BUCKET` as the logical document bucket and keep it in the
  server-side allowlist (`qsystem-docs`/`qsystem-avatars`). Do not use the old
  `qsystem-prod-docs` or `qsystem-staging-docs` template values unless the
  allowlist and deployment provisioning are changed together.
- **Versioning**: Enable bucket versioning on `qsystem-docs` and `qsystem-avatars` so accidental overwrites or deletes can be recovered.
- **Lifecycle rules**:
  - Abort incomplete multipart uploads after **7 days**.
  - Transition noncurrent object versions to Infrequent Access after **30 days** and expire noncurrent versions after **90 days**.
- **Replication / Backup**: Enable continuous asynchronous Cross-Region Replication (or scheduled nightly `mc mirror` / `rclone` sync with checksum verification) to a secondary locked backup bucket.
- **Orphan reconciliation**: Weekly job verifies S3 keys against PostgreSQL `files` metadata table before purging unreferenced test/abandoned uploads older than 30 days.

## 4. Meilisearch Zero-Downtime Index Rebuild Strategy

PostgreSQL (`tasks`, `files`, and indexed documents) is always the authoritative source of truth; Meilisearch indexes are rebuildable projections.

### Rebuild Procedure
1. Create a timestamped shadow index (e.g. `documents_rebuild_YYYYMMDDHHMM`) with identical filterable/searchable attributes and tenant/scope filter configuration.
2. Stream records from PostgreSQL in batches of `500` using a read-only replica/owner reader and push into the shadow index via Meilisearch batch `/documents` API.
3. Wait until Meilisearch task queue drains (`status: succeeded`) and verify document count matches PostgreSQL expected count.
4. Perform atomic index swap (`/swap-indexes`) between `documents` and `documents_rebuild_YYYYMMDDHHMM`.
5. Run smoke search verification via `GET /search?q=...` for both restricted `EMPLOYEE` and `DIRECTOR` scopes.
6. Delete the previous index after a 24-hour soak window.

## 5. Observability: Metrics, Structured Logs, Traces & Alerts

### Structured Logs & Request Correlation
- `apps/api/src/common/http-hardening.ts` attaches `X-Request-Id` to every HTTP request/response (preserving valid inbound `X-Request-Id` from reverse proxy or generating UUIDv4) and emits single-line JSON logs `{ timestamp, level, type: "http_request", requestId, method, path, status, durationMs }`.
- Query strings, cookies, `Authorization` headers, request bodies, and secrets are stripped and never logged.

### Health & Readiness Signals
- **Liveness probe**: `GET /health/live` (process alive, no downstream checks; restart pod if failing continuously).
- **Readiness probe**: `GET /health/ready` (2s bounded probes to PostgreSQL, S3 endpoint, and Meilisearch `/health`; removes pod from load balancer pool on HTTP 503).

### Recommended Alert Thresholds

| Signal | Condition | Severity | Action |
| :--- | :--- | :--- | :--- |
| API 5xx error rate | > 1% over 5 minutes | Critical | Page on-call, inspect JSON logs by `requestId`, consider rollback |
| API p95 latency | > 500ms for 10 minutes | Warning | Check Postgres connections, slow queries, Redis latency |
| `/health/ready` failures | >= 2 consecutive checks | Critical | Inspect DB/S3/Meilisearch dependency health |
| PostgreSQL connection usage | > 80% `max_connections` | Warning | Check Prisma pool size and PgBouncer saturation |
| Notification `DEAD` count | Any increase in `status='DEAD'` rows | Warning | Inspect delivery provider logs and replay after remediation |
| Login `429 RATE_LIMITED` spike | Sustained brute-force anomaly | Warning | Inspect source IP / WAF logs; verify Redis limiter availability |
| Container memory / CPU | > 85% limit sustained 5m | Warning | Trigger horizontal scale-out / verify leak |

## 6. Secret Rotation & Audit Log Retention

### Secret Rotation Cadence
- **Every 90 days (or immediately on suspected exposure)**:
  1. **`JWT_SECRET`**: Update `/run/secrets/jwt_secret` and perform rolling restart across API pods (short-lived access tokens expire within minutes; refresh sessions can either rotate gracefully via versioned secret window or enforce clean re-login).
  2. **`QSYSTEM_APP_PASSWORD` / `DATABASE_URL`**: Provision second DB user/dual-password window, update `*_FILE` secret, rolling restart API, then revoke old credential.
  3. **`S3_ACCESS_KEY` / `S3_SECRET_KEY` & `MEILI_MASTER_KEY`**: Create secondary key, update `*_FILE` mounts cleanly, rolling restart API, revoke superseded key.
  4. **`REDIS_URL`**: Rotate Redis ACL password with dual-password transition, restart API, drop old ACL password.

### Audit Log Retention
- PostgreSQL `audit_logs` records capture security-sensitive mutations (`CREATE`, `UPDATE`, user provisioning, permission checks) without sensitive credential fields.
- Retain online in Postgres for **180 days**, export monthly immutable compressed archives (checksummed SHA-256 + object-lock S3 compliance retention) for **7 years** before pruning online partitions older than 180 days.

## 7. TLS, Reverse Proxy, Resource Limits & Autoscaling

### Reverse Proxy & TLS
- Terminate **TLS 1.2 / TLS 1.3** (modern ciphers, HSTS enforced by API in `APP_ENV=staging|production`) at Nginx / Caddy / Cloud ALB on `443`.
- Route `/api/*` through `apps/web` same-origin proxy (or directly strip `/api` -> `apps/api:3001` at ingress). Keep `COOKIE_PATH=/` so middleware can see the refresh cookie on protected page routes.
- Forward `X-Request-Id`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` cleanly, and configure `TRUST_PROXY=1` on `apps/api`.
- Disable response buffering (`X-Accel-Buffering: no`, `proxy_read_timeout 3600s`) on `/api/notifications/stream` SSE connections.

### Resource Limits & Autoscaling Baseline

| Workload | Requests (CPU / Mem) | Limits (CPU / Mem) | Min Replicas | Max Replicas | Autoscale Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `apps/api` | `250m / 512Mi` | `1000m / 1Gi` | 2 (Multi-AZ) | 10 | CPU 70% or p95 latency > 300ms |
| `apps/web` | `200m / 384Mi` | `750m / 768Mi` | 2 (Multi-AZ) | 8 | CPU 70% |
| PostgreSQL 16 | Managed HA / Primary+Replica | Storage auto-grow | 1 Primary + 1 Standby | - | Manual/managed tiering |
| Redis | `100m / 128Mi` | `500m / 256Mi` | 1 Primary + Replica | - | Sentinel / Managed failover |

Note: Ensure `RATE_LIMIT_STORE=redis` and `REDIS_URL_FILE` are configured whenever `apps/api` runs with multiple replicas; verify Redis/Socket pub-sub adapter before horizontally scaling SSE `/notifications/stream` across multiple pods with active real-time push expectations.

## 8. Staging Promotion & Rollback Gate Checklist

1. CI passes `contracts-and-ui`, `api` (migrated sequential tests), `web` (unit, `tsc`, `next build`), `playwright` (`1440x900`, `1024x768`, `390x844` Dark/Light), and `containers` (immutable image digest built & health-smoked).
2. Staging deploy runs pre-deploy DB backup -> `prisma migrate deploy` -> rolling update to digest `sha256:...` -> `node scripts/ops/smoke-check.mjs --api https://staging.example/api --web https://staging.example`.
3. Production promotion deploys the exact immutable digest verified in staging (never re-building from source between staging and production).
4. If `smoke-check.mjs` or post-deploy error/latency SLO breaches within 10 minutes: execute rollback command to the previous known-good digest and verify `/health/ready` returns `200`.

