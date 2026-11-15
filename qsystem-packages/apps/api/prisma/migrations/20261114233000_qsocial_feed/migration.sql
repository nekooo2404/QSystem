-- Additive migration for QSocial internal company social feed (`social_posts`, `social_comments`, `social_post_likes`).

CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "author_name" TEXT NOT NULL DEFAULT '',
  "author_role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "department_id" TEXT,
  "department_name" TEXT,
  "category" TEXT NOT NULL DEFAULT 'SHARING',
  "content" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "tenant_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "social_posts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "author_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "author_role" "Role" NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "department_name" TEXT;

UPDATE "social_posts" sp
SET
  "author_name" = COALESCE(NULLIF(sp."author_name", ''), u."name"),
  "author_role" = u."role"
FROM "users" u
WHERE sp."author_id" = u."id"
  AND sp."author_name" = '';

UPDATE "social_posts" sp
SET "department_name" = d."name"
FROM "departments" d
WHERE sp."department_id" = d."id"
  AND sp."department_name" IS NULL;

CREATE INDEX IF NOT EXISTS "social_posts_pinned_created_at_idx" ON "social_posts" ("pinned", "created_at");
CREATE INDEX IF NOT EXISTS "social_posts_department_id_created_at_idx" ON "social_posts" ("department_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_posts_author_id_idx" ON "social_posts" ("author_id");

CREATE TABLE IF NOT EXISTS "social_comments" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "author_name" TEXT NOT NULL DEFAULT '',
  "author_role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "content" TEXT NOT NULL,
  "tenant_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "social_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "social_comments" ADD COLUMN IF NOT EXISTS "author_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "social_comments" ADD COLUMN IF NOT EXISTS "author_role" "Role" NOT NULL DEFAULT 'EMPLOYEE';

UPDATE "social_comments" sc
SET
  "author_name" = COALESCE(NULLIF(sc."author_name", ''), u."name"),
  "author_role" = u."role"
FROM "users" u
WHERE sc."author_id" = u."id"
  AND sc."author_name" = '';

CREATE INDEX IF NOT EXISTS "social_comments_post_id_created_at_idx" ON "social_comments" ("post_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_comments_author_id_idx" ON "social_comments" ("author_id");

CREATE TABLE IF NOT EXISTS "social_post_likes" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "social_post_likes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "social_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_post_likes_post_id_user_id_key" ON "social_post_likes" ("post_id", "user_id");
CREATE INDEX IF NOT EXISTS "social_post_likes_post_id_idx" ON "social_post_likes" ("post_id");
CREATE INDEX IF NOT EXISTS "social_post_likes_user_id_idx" ON "social_post_likes" ("user_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "social_posts" TO qsystem_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "social_comments" TO qsystem_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "social_post_likes" TO qsystem_app;

ALTER TABLE "social_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_posts" NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_posts_select ON "social_posts";
CREATE POLICY social_posts_select ON "social_posts"
  FOR SELECT
  USING (NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL);

DROP POLICY IF EXISTS social_posts_insert ON "social_posts";
CREATE POLICY social_posts_insert ON "social_posts"
  FOR INSERT
  WITH CHECK (author_id = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS social_posts_update ON "social_posts";
CREATE POLICY social_posts_update ON "social_posts"
  FOR UPDATE
  USING (
    author_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR app_current_role() IN ('DIRECTOR', 'MANAGER')
  )
  WITH CHECK (
    author_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR app_current_role() IN ('DIRECTOR', 'MANAGER')
  );

DROP POLICY IF EXISTS social_posts_delete ON "social_posts";
CREATE POLICY social_posts_delete ON "social_posts"
  FOR DELETE
  USING (
    author_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR app_current_role() = 'DIRECTOR'
  );

ALTER TABLE "social_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_comments" NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_comments_select ON "social_comments";
CREATE POLICY social_comments_select ON "social_comments"
  FOR SELECT
  USING (NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL);

DROP POLICY IF EXISTS social_comments_insert ON "social_comments";
CREATE POLICY social_comments_insert ON "social_comments"
  FOR INSERT
  WITH CHECK (author_id = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS social_comments_delete ON "social_comments";
CREATE POLICY social_comments_delete ON "social_comments"
  FOR DELETE
  USING (
    author_id = NULLIF(current_setting('app.current_user_id', true), '')
    OR app_current_role() = 'DIRECTOR'
  );

ALTER TABLE "social_post_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_post_likes" NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_post_likes_select ON "social_post_likes";
CREATE POLICY social_post_likes_select ON "social_post_likes"
  FOR SELECT
  USING (NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL);

DROP POLICY IF EXISTS social_post_likes_write ON "social_post_likes";
CREATE POLICY social_post_likes_write ON "social_post_likes"
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), ''));

CREATE OR REPLACE FUNCTION app_department_name(p_dept_id TEXT) RETURNS TEXT AS $$
  SELECT d.name FROM departments d WHERE d.id = p_dept_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION app_department_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_department_name(TEXT) TO qsystem_app;
