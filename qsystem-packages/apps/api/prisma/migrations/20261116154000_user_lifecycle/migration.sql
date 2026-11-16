ALTER TABLE "users"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspended_at" TIMESTAMP(3),
  ADD COLUMN "deactivated_at" TIMESTAMP(3);

DROP FUNCTION IF EXISTS auth_user_lookup(TEXT);
CREATE FUNCTION auth_user_lookup(p_email TEXT)
RETURNS TABLE (
  id TEXT,
  password_hash TEXT,
  role "Role",
  department_id TEXT,
  status TEXT
) AS $$
  SELECT u.id, u.password_hash, u.role, u.department_id, u.status
  FROM users u
  WHERE u.email = p_email;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION auth_user_lookup(TEXT) TO qsystem_app;
