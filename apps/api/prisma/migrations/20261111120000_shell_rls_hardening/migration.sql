-- Shell RLS hardening (additive, Task 2 fix round 1).
--
-- 1. ENABLE ROW LEVEL SECURITY on users + departments with SELF/DEPARTMENT/
--    COMPANY policies keyed on app.current_user_id.
-- 2. SECURITY DEFINER login lookup: pre-identity auth reads users through
--    auth_user_lookup(email) only — Task 3 must never query users directly.
-- 3. Restricted LOGIN role qsystem_app (least privilege) for app/test traffic;
--    seed/migrate keep running as the owner role.
-- 4. audit_logs INSERT policy: anyone authenticated may insert only rows
--    stamped with their own actor_id; updates/deletes stay director-only.

-- Helper functions must be SECURITY DEFINER: policies on users/departments
-- call them, and they query those same tables — with caller rights that
-- would infinitely recurse under RLS. Fixed search_path included.
CREATE OR REPLACE FUNCTION app_current_role()
RETURNS "Role" AS $$
  SELECT u.role FROM users u WHERE u.id = current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION app_managed_departments()
RETURNS SETOF TEXT AS $$
  SELECT d.id FROM departments d WHERE d.manager_id = current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============ SECURITY DEFINER login lookup ============
CREATE OR REPLACE FUNCTION auth_user_lookup(p_email TEXT)
RETURNS TABLE (
  id TEXT,
  password_hash TEXT,
  role "Role",
  department_id TEXT
) AS $$
  SELECT u.id, u.password_hash, u.role, u.department_id
  FROM users u
  WHERE u.email = p_email;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============ users: RLS ============
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_company ON users;
CREATE POLICY users_company ON users
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS users_self ON users;
CREATE POLICY users_self ON users
  FOR ALL
  USING (id = current_setting('app.current_user_id', true))
  WITH CHECK (id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS users_department ON users;
CREATE POLICY users_department ON users
  FOR SELECT
  USING (
    app_current_role() = 'MANAGER'
    AND department_id IS NOT NULL
    AND department_id IN (SELECT app_managed_departments())
  );

-- ============ departments: RLS ============
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_company ON departments;
CREATE POLICY departments_company ON departments
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS departments_managed ON departments;
CREATE POLICY departments_managed ON departments
  FOR ALL
  USING (
    app_current_role() = 'MANAGER'
    AND id IN (SELECT app_managed_departments())
  )
  WITH CHECK (
    app_current_role() = 'MANAGER'
    AND id IN (SELECT app_managed_departments())
  );

DROP POLICY IF EXISTS departments_member ON departments;
CREATE POLICY departments_member ON departments
  FOR SELECT
  USING (
    id IN (
      SELECT u.department_id FROM users u
      WHERE u.id = current_setting('app.current_user_id', true)
    )
  );

-- ============ audit_logs: rework to explicit per-command policies ============
-- Previous migration had audit_logs_company FOR ALL (director bypass) plus
-- SELECT-only self/department policies. Rework into explicit per-command
-- policies so the rules are auditable and INSERT/UPDATE/DELETE stay tight:
-- directors keep full access; anyone authenticated may INSERT only rows
-- stamped with their own actor_id; UPDATE/DELETE are director-only.
DROP POLICY IF EXISTS audit_logs_company ON audit_logs;
DROP POLICY IF EXISTS audit_logs_self ON audit_logs;
DROP POLICY IF EXISTS audit_logs_department ON audit_logs;

CREATE POLICY audit_logs_company_select ON audit_logs
  FOR SELECT
  USING (app_current_role() = 'DIRECTOR');

CREATE POLICY audit_logs_company_insert ON audit_logs
  FOR INSERT
  WITH CHECK (app_current_role() = 'DIRECTOR');

CREATE POLICY audit_logs_company_update ON audit_logs
  FOR UPDATE
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

CREATE POLICY audit_logs_company_delete ON audit_logs
  FOR DELETE
  USING (app_current_role() = 'DIRECTOR');

CREATE POLICY audit_logs_self ON audit_logs
  FOR SELECT
  USING (actor_id = current_setting('app.current_user_id', true));

CREATE POLICY audit_logs_department ON audit_logs
  FOR SELECT
  USING (
    app_current_role() = 'MANAGER'
    AND actor_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = audit_logs.actor_id
        AND u.department_id IN (SELECT app_managed_departments())
    )
  );

DROP POLICY IF EXISTS audit_logs_insert_self ON audit_logs;
CREATE POLICY audit_logs_insert_self ON audit_logs
  FOR INSERT
  WITH CHECK (
    actor_id IS NOT NULL
    AND actor_id = current_setting('app.current_user_id', true)
  );

-- ============ restricted LOGIN role for app/test traffic ============
-- No password is baked in here: tracked files must stay credential-free.
-- The owner/bootstrap operator sets the password out-of-band via env, e.g.
--   ALTER ROLE qsystem_app WITH LOGIN PASSWORD '<from env>';
-- dev/test setups do this in migrate/seed/test bootstrap (gitignored .env).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qsystem_app') THEN
    CREATE ROLE qsystem_app LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE qsystem TO qsystem_app;
GRANT USAGE ON SCHEMA public TO qsystem_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  departments, users, approval_delegations, audit_logs, notifications, files
  TO qsystem_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qsystem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO qsystem_app;

-- NOTE: no FORCE ROW LEVEL SECURITY. The app connects as qsystem_app
-- (non-owner, no BYPASSRLS), so RLS always applies to app traffic — the
-- negative test pins this. Migrate/seed/backup keep running as the owner
-- role, which stays exempt (operational bootstrap would otherwise have a
-- chicken-and-egg problem: the first user row cannot satisfy any policy).

-- The SECURITY DEFINER lookup must be callable by the restricted role.
GRANT EXECUTE ON FUNCTION auth_user_lookup(TEXT) TO qsystem_app;
GRANT EXECUTE ON FUNCTION app_current_role() TO qsystem_app;
GRANT EXECUTE ON FUNCTION app_managed_departments() TO qsystem_app;
