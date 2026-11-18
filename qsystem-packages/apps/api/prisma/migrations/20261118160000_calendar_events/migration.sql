CREATE TABLE "calendar_events" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3),
  "color" TEXT NOT NULL DEFAULT 'blue',
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calendar_events_owner_id_starts_at_idx" ON "calendar_events"("owner_id", "starts_at");
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
