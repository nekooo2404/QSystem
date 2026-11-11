-- IAM refresh tokens (additive, Task 3).
--
-- ADDITIVE ONLY: creates refresh_tokens + lookup helper. Does NOT touch any
-- Task 2 table or policy (R1). Fresh deploys apply in order; existing dev DBs
-- keep their journal history intact (no rewrite of old migrations).
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey"
  FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ SECURITY DEFINER refresh-token lookup (pre-identity) ============
-- Same pattern as auth_user_lookup: the refresh endpoint runs BEFORE any
-- request identity exists, so it must resolve the token through a DEFINER
-- function instead of querying refresh_tokens directly (RLS would deny it).
CREATE OR REPLACE FUNCTION auth_refresh_lookup(p_token_hash TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  expires_at TIMESTAMP(3),
  revoked_at TIMESTAMP(3),
  replaced_by_id TEXT
) AS $$
  SELECT t.id, t.user_id, t.expires_at, t.revoked_at, t.replaced_by_id
  FROM refresh_tokens t
  WHERE t.token_hash = p_token_hash;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============ RLS (self-scoped: a token row belongs to its user) ============
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refresh_tokens_company ON refresh_tokens;
CREATE POLICY refresh_tokens_company ON refresh_tokens
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS refresh_tokens_self ON refresh_tokens;
CREATE POLICY refresh_tokens_self ON refresh_tokens
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- NOTE: no FORCE ROW LEVEL SECURITY. qsystem_app is non-owner without
-- BYPASSRLS, so RLS always applies to app traffic; owner stays exempt for
-- migrate/seed/bootstrap (same rule as Task 2 hardening).

GRANT SELECT, INSERT, UPDATE ON refresh_tokens TO qsystem_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qsystem_app;
GRANT EXECUTE ON FUNCTION auth_refresh_lookup(TEXT) TO qsystem_app;
