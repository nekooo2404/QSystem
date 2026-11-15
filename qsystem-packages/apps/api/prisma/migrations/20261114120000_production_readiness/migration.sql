-- Additive migration for QSystem Production Readiness (forward-only):
-- 1. Notification server-side read state (`read_at`).
-- 2. QTask persistent `tasks` table + `task_code_seq` sequence + RLS policies.
-- 3. `users_department_insert` policy so MANAGER can create EMPLOYEE in managed departments.

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "notifications_recipient_id_read_at_idx"
  ON "notifications" ("recipient_id", "read_at");

CREATE SEQUENCE IF NOT EXISTS "task_code_seq" START WITH 1001 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "what" TEXT NOT NULL,
  "who" TEXT NOT NULL,
  "when" TEXT NOT NULL,
  "where" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Đang làm',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "flow" TEXT,
  "due_date" TEXT NOT NULL,
  "assignee_id" TEXT,
  "assignee_name" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "department_id" TEXT,
  "tenant_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tasks_code_key" UNIQUE ("code"),
  CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "tasks_owner_id_idx" ON "tasks" ("owner_id");
CREATE INDEX IF NOT EXISTS "tasks_department_id_idx" ON "tasks" ("department_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
CREATE INDEX IF NOT EXISTS "tasks_assignee_id_idx" ON "tasks" ("assignee_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tasks" TO qsystem_app;
GRANT USAGE, SELECT ON SEQUENCE "task_code_seq" TO qsystem_app;

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_company ON "tasks";
CREATE POLICY tasks_company ON "tasks"
  FOR ALL
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');

DROP POLICY IF EXISTS tasks_department ON "tasks";
CREATE POLICY tasks_department ON "tasks"
  FOR ALL
  USING (
    app_current_role() = 'MANAGER'
    AND (
      (department_id IS NOT NULL AND department_id IN (SELECT app_managed_departments()))
      OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')
    )
  )
  WITH CHECK (
    app_current_role() = 'MANAGER'
    AND (
      (department_id IS NOT NULL AND department_id IN (SELECT app_managed_departments()))
      OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')
    )
  );

DROP POLICY IF EXISTS tasks_self ON "tasks";
CREATE POLICY tasks_self ON "tasks"
  FOR ALL
  USING (owner_id = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS users_department_insert ON "users";
CREATE POLICY users_department_insert ON "users"
  FOR INSERT
  WITH CHECK (
    app_current_role() = 'MANAGER'
    AND role = 'EMPLOYEE'
    AND department_id IS NOT NULL
    AND department_id IN (SELECT app_managed_departments())
  );
