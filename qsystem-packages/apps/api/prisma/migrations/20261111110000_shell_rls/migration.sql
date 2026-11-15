-- Shell RLS: SELF / DEPARTMENT / COMPANY scopes.
--
-- Every statement runs with `app.current_user_id` set by PrismaService
-- (SET LOCAL per transaction). Empty setting = no identity -> only DIRECTOR
-- bypass matters, and WITH CHECK blocks anonymous writes.
--
-- Helper: current actor's role, NULL when no user is set.
CREATE OR REPLACE FUNCTION app_current_role()
RETURNS "Role" AS $$
  SELECT u.role FROM users u WHERE u.id = current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE;

-- Helper: departments managed by the current actor.
CREATE OR REPLACE FUNCTION app_managed_departments()
RETURNS SETOF TEXT AS $$
  SELECT d.id FROM departments d WHERE d.manager_id = current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE;

-- ============ files (business rows: ownerId + departmentId) ============
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS files_company ON files;
CREATE POLICY files_company ON files
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS files_self ON files;
CREATE POLICY files_self ON files
  FOR ALL
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS files_department ON files;
CREATE POLICY files_department ON files
  FOR ALL
  USING (
    app_current_role() = 'MANAGER'
    AND department_id IS NOT NULL
    AND department_id IN (SELECT app_managed_departments())
  )
  WITH CHECK (
    app_current_role() = 'MANAGER'
    AND department_id IS NOT NULL
    AND department_id IN (SELECT app_managed_departments())
  );

-- ============ notifications (recipient-scoped outbox rows) ============
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_company ON notifications;
CREATE POLICY notifications_company ON notifications
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS notifications_self ON notifications;
CREATE POLICY notifications_self ON notifications
  FOR ALL
  USING (recipient_id = current_setting('app.current_user_id', true))
  WITH CHECK (recipient_id = current_setting('app.current_user_id', true));

-- ============ audit_logs (append-only; readers see own scope) ============
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_company ON audit_logs;
CREATE POLICY audit_logs_company ON audit_logs
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS audit_logs_self ON audit_logs;
CREATE POLICY audit_logs_self ON audit_logs
  FOR SELECT
  USING (actor_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS audit_logs_department ON audit_logs;
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

-- ============ approval_delegations (participant-scoped) ============
ALTER TABLE approval_delegations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delegations_company ON approval_delegations;
CREATE POLICY delegations_company ON approval_delegations
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS delegations_self ON approval_delegations;
CREATE POLICY delegations_self ON approval_delegations
  FOR ALL
  USING (
    from_user_id = current_setting('app.current_user_id', true)
    OR to_user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    from_user_id = current_setting('app.current_user_id', true)
    OR to_user_id = current_setting('app.current_user_id', true)
  );

-- ============ users / departments (org lookup stays readable) ============
-- Users and departments must remain readable during login/org lookups (which
-- run before/without a request identity), so no blanket RLS denial here.
-- Row scoping for non-DIRECTOR viewers is enforced by the Prisma extension
-- layer (scopeFor/isAllowed). No ENABLE ROW LEVEL SECURITY on these two.
