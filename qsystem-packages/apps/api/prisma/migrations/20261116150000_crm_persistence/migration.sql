CREATE TABLE "crm_customers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "segment" TEXT NOT NULL,
  "owner_initials" TEXT NOT NULL,
  "owner_name" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "last_contact" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "department_id" TEXT,
  "tenant_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_customers_email_key" UNIQUE ("email"),
  CONSTRAINT "crm_customers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "crm_customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "crm_customers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "crm_deals" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "probability" INTEGER NOT NULL DEFAULT 0,
  "stage" TEXT NOT NULL,
  "close_date" TIMESTAMP(3),
  "tenant_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_deals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "crm_customers_owner_id_idx" ON "crm_customers" ("owner_id");
CREATE INDEX "crm_customers_department_id_idx" ON "crm_customers" ("department_id");
CREATE INDEX "crm_customers_stage_idx" ON "crm_customers" ("stage");
CREATE INDEX "crm_deals_customer_id_stage_idx" ON "crm_deals" ("customer_id", "stage");

ALTER TABLE "crm_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_deals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_customers_company ON "crm_customers"
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');
CREATE POLICY crm_customers_manager ON "crm_customers"
  USING (app_current_role() = 'MANAGER' AND (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR
    department_id IN (SELECT app_managed_departments())
  ))
  WITH CHECK (app_current_role() = 'MANAGER' AND (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR
    department_id IN (SELECT app_managed_departments())
  ));
CREATE POLICY crm_customers_self ON "crm_customers"
  USING (app_current_role() = 'EMPLOYEE' AND (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR
    created_by_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (app_current_role() = 'EMPLOYEE' AND (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR
    created_by_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY crm_deals_company ON "crm_deals"
  USING (app_current_role() = 'DIRECTOR')
  WITH CHECK (app_current_role() = 'DIRECTOR');
CREATE POLICY crm_deals_scoped ON "crm_deals"
  USING (EXISTS (SELECT 1 FROM crm_customers c WHERE c.id = customer_id));
CREATE POLICY crm_deals_scoped_insert ON "crm_deals"
  WITH CHECK (EXISTS (SELECT 1 FROM crm_customers c WHERE c.id = customer_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON "crm_customers", "crm_deals" TO qsystem_app;
