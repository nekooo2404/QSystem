-- Notification outbox worker/system path (Task 6, ruling R17). Forward-only.
--
-- Worker/system path: qsystem_app connections that have NOT set
-- app.current_user_id (no identity) may read/insert/update the outbox.
-- Any request that sets an identity keeps the existing SELF/COMPANY
-- policies only -- this policy must never widen a user-scoped connection.
--
-- "No identity" is NULLIF(current_setting(..., true), '') IS NULL, not a bare
-- IS NULL: once a pooled connection has run set_config(..., is_local = true)
-- in a transaction, the custom GUC reverts to '' (empty string), NOT to NULL.
-- A bare IS NULL would lock the worker out of any connection that previously
-- served a request. Real identities are never the empty string (the JWT guard
-- rejects tokens without a subject), so '' is safely "no identity".
DROP POLICY IF EXISTS notifications_worker ON notifications;
CREATE POLICY notifications_worker ON notifications
  FOR ALL
  USING (NULLIF(current_setting('app.current_user_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.current_user_id', true), '') IS NULL);
