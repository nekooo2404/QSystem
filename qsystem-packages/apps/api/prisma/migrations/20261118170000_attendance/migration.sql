CREATE TABLE "attendance_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "check_in_at" TIMESTAMP(3),
  "check_out_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Chưa chấm công',
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'WEB',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_records_user_id_date_key" ON "attendance_records"("user_id", "date");
CREATE INDEX "attendance_records_date_idx" ON "attendance_records"("date");
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
