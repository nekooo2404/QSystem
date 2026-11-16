ALTER TABLE "tasks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP POLICY IF EXISTS tasks_department ON "tasks";
CREATE POLICY tasks_department ON "tasks"
  USING (
    app_current_role() = 'MANAGER'
    AND (
      department_id IN (SELECT app_managed_departments())
      OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')
      OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')
    )
  )
  WITH CHECK (
    app_current_role() = 'MANAGER'
    AND (
      department_id IN (SELECT app_managed_departments())
      OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')
      OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')
    )
  );

DROP POLICY IF EXISTS tasks_self ON "tasks";
CREATE POLICY tasks_self ON "tasks"
  USING (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')
  );
