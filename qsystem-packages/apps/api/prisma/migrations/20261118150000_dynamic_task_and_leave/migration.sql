CREATE TABLE "task_comments" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "task_history" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_history_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "task_attachments" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "uploader_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "size" INTEGER,
  "mime_type" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "leave_requests" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "from_date" TEXT NOT NULL,
  "to_date" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'Phép năm',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewer_id" TEXT,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_requests_code_key" ON "leave_requests"("code");
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");
CREATE INDEX "task_history_task_id_created_at_idx" ON "task_history"("task_id", "created_at");
CREATE INDEX "task_attachments_task_id_created_at_idx" ON "task_attachments"("task_id", "created_at");
CREATE INDEX "leave_requests_user_id_created_at_idx" ON "leave_requests"("user_id", "created_at");
CREATE INDEX "leave_requests_status_created_at_idx" ON "leave_requests"("status", "created_at");
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
