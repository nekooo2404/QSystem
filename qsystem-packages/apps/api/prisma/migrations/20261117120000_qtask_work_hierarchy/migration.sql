CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "owner_id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_packages" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "manager_id" TEXT NOT NULL,
  "assigned_by_id" TEXT NOT NULL,
  "due_date" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "tenant_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_packages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks"
  ADD COLUMN "project_id" TEXT,
  ADD COLUMN "work_package_id" TEXT,
  ADD COLUMN "assignment_mode" TEXT NOT NULL DEFAULT 'TASK_TO_EMPLOYEE',
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");
CREATE INDEX "work_packages_project_id_idx" ON "work_packages"("project_id");
CREATE INDEX "work_packages_manager_id_idx" ON "work_packages"("manager_id");
CREATE INDEX "work_packages_assigned_by_id_idx" ON "work_packages"("assigned_by_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_work_package_id_idx" ON "tasks"("work_package_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "work_packages"
  ADD CONSTRAINT "work_packages_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "work_packages_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "work_packages_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "tasks_work_package_id_fkey"
  FOREIGN KEY ("work_package_id") REFERENCES "work_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
