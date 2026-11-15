-- Shared login rate-limit state (multi-instance safe). Pre-auth data with no
-- identity, so no RLS: the restricted app role gets exactly the DML it needs.
CREATE TABLE "rate_limit_hits" (
    "id" BIGSERIAL PRIMARY KEY,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "rate_limit_hits_bucket_key_at_idx" ON "rate_limit_hits" ("bucket", "key", "at");

GRANT SELECT, INSERT, DELETE ON rate_limit_hits TO qsystem_app;
GRANT USAGE, SELECT ON SEQUENCE rate_limit_hits_id_seq TO qsystem_app;
