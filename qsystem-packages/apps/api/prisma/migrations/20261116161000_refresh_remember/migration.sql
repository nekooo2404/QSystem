ALTER TABLE "refresh_tokens" ADD COLUMN "remember" BOOLEAN NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS auth_refresh_lookup(TEXT);
CREATE FUNCTION auth_refresh_lookup(p_token_hash TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  expires_at TIMESTAMP(3),
  revoked_at TIMESTAMP(3),
  replaced_by_id TEXT,
  remember BOOLEAN
) AS $$
  SELECT t.id, t.user_id, t.expires_at, t.revoked_at, t.replaced_by_id, t.remember
  FROM refresh_tokens t
  WHERE t.token_hash = p_token_hash;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION auth_refresh_lookup(TEXT) TO qsystem_app;
