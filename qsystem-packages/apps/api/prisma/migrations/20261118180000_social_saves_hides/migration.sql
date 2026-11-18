CREATE TABLE "social_post_saves" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_post_saves_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "social_post_hides" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_post_hides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_post_saves_post_id_user_id_key" ON "social_post_saves"("post_id", "user_id");
CREATE UNIQUE INDEX "social_post_hides_post_id_user_id_key" ON "social_post_hides"("post_id", "user_id");
CREATE INDEX "social_post_saves_user_id_idx" ON "social_post_saves"("user_id");
CREATE INDEX "social_post_hides_user_id_idx" ON "social_post_hides"("user_id");
ALTER TABLE "social_post_saves" ADD CONSTRAINT "social_post_saves_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_saves" ADD CONSTRAINT "social_post_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_hides" ADD CONSTRAINT "social_post_hides_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_hides" ADD CONSTRAINT "social_post_hides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
