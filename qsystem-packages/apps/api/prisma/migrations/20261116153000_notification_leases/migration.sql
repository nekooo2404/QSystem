ALTER TABLE "notifications"
  ADD COLUMN "locked_by" TEXT,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "next_attempt_at" TIMESTAMP(3);
CREATE INDEX "notifications_status_next_attempt_at_locked_until_idx"
  ON "notifications" ("status", "next_attempt_at", "locked_until");
