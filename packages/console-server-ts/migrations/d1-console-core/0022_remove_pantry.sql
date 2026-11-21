-- Remove Seams Pantry (service id 'satyr'). Pantry owns its accounts and no longer calls this Console.
-- This deletes every row of a Pantry service instance, the Pantry prices, and every row of the
-- Pantry-only tables satyr_service_bindings, billing_jev_hours and billing_isolated_test_accounts.
-- Organization ledger entries, invoices and credit limits stay: they are the organization's money history.
-- The three Pantry-only tables stay, empty. The Console Worker that runs while this migration applies
-- still names them in Wallet usage and funds queries. Drop them in a later migration, after every lane
-- runs a Console Worker without them.
-- SQLite cannot change a CHECK constraint in place. The CHECK constraints that still list 'satyr' or a
-- Pantry meter stay as they are, and no code writes those values now.
PRAGMA defer_foreign_keys = ON;

-- These views and triggers name Pantry tables or meters. They are created again below without them.
DROP VIEW billing_document_line_items;
DROP VIEW billing_charge_attributions;
DROP TRIGGER platform_provision_scope_guard;
DROP TRIGGER platform_provision_receipt_guard;
DROP TRIGGER billing_usage_events_scope_guard;

-- These guards stop deletes. Each one is created again below with the same text.
DROP TRIGGER billing_usage_receipts_immutable_delete;
DROP TRIGGER billing_usage_events_immutable_delete;
DROP TRIGGER billing_execution_charges_immutable_delete;
DROP TRIGGER billing_funds_terminal_immutable_delete;
DROP TRIGGER platform_service_principal_immutable_delete;
DROP TRIGGER platform_instance_access_retained;
DROP TRIGGER platform_service_invitation_immutable_delete;
DROP TRIGGER platform_automation_grant_retained;
DROP TRIGGER billing_prices_immutable_delete;
DROP TRIGGER billing_jev_hours_immutable_delete;
DROP TRIGGER billing_test_accounts_immutable_delete;

-- Children first: usage, then funds, then access, then provisioning, then the instances.
DELETE FROM billing_jev_hours;
DELETE FROM billing_usage_receipts WHERE producer_service_id = 'satyr';
DELETE FROM billing_usage_events WHERE producer_service_id = 'satyr';
DELETE FROM billing_execution_charges WHERE EXISTS (SELECT 1 FROM billing_funds_reservations r
    WHERE r.namespace = billing_execution_charges.namespace AND r.id = billing_execution_charges.reservation_id
      AND r.service_id = 'satyr');
DELETE FROM billing_funds_terminal_receipts WHERE EXISTS (SELECT 1 FROM billing_funds_reservations r
    WHERE r.namespace = billing_funds_terminal_receipts.namespace AND r.id = billing_funds_terminal_receipts.reservation_id
      AND r.service_id = 'satyr');
DELETE FROM billing_funds_reservations WHERE service_id = 'satyr';
DELETE FROM platform_service_principals WHERE EXISTS (SELECT 1 FROM platform_service_instances i
    WHERE i.namespace = platform_service_principals.namespace AND i.id = platform_service_principals.instance_id
      AND i.service_id = 'satyr');
DELETE FROM platform_instance_access WHERE EXISTS (SELECT 1 FROM platform_service_instances i
    WHERE i.namespace = platform_instance_access.namespace AND i.id = platform_instance_access.instance_id
      AND i.service_id = 'satyr');
DELETE FROM platform_service_invitation_grants WHERE EXISTS (SELECT 1 FROM platform_service_instances i
    WHERE i.namespace = platform_service_invitation_grants.namespace AND i.id = platform_service_invitation_grants.instance_id
      AND i.service_id = 'satyr');
DELETE FROM platform_automation_grants WHERE EXISTS (SELECT 1 FROM platform_service_instances i
    WHERE i.namespace = platform_automation_grants.namespace AND i.id = platform_automation_grants.instance_id
      AND i.service_id = 'satyr');
DELETE FROM platform_provision_receipts WHERE EXISTS (SELECT 1 FROM platform_provision_operations o
    WHERE o.namespace = platform_provision_receipts.namespace AND o.id = platform_provision_receipts.operation_id
      AND o.service_id = 'satyr');
DELETE FROM satyr_service_bindings;
DELETE FROM platform_provision_operations WHERE service_id = 'satyr';
DELETE FROM platform_service_instances WHERE service_id = 'satyr';
DELETE FROM billing_price_definitions WHERE meter_id IN ('satyr.completed_turn.test', 'satyr.jev_input_tokens');
DELETE FROM billing_isolated_test_accounts;

CREATE TRIGGER billing_usage_receipts_immutable_delete BEFORE DELETE ON billing_usage_receipts
    BEGIN SELECT RAISE(ABORT, 'usage_receipt_immutable'); END;

CREATE TRIGGER billing_usage_events_immutable_delete BEFORE DELETE ON billing_usage_events
    BEGIN SELECT RAISE(ABORT, 'usage_event_immutable'); END;

CREATE TRIGGER billing_execution_charges_immutable_delete
    BEFORE DELETE ON billing_execution_charges
    BEGIN SELECT RAISE(ABORT, 'funds_operation_conflict'); END;

CREATE TRIGGER billing_funds_terminal_immutable_delete
    BEFORE DELETE ON billing_funds_terminal_receipts
    BEGIN SELECT RAISE(ABORT, 'funds_operation_conflict'); END;

CREATE TRIGGER platform_service_principal_immutable_delete BEFORE DELETE ON platform_service_principals
    BEGIN SELECT RAISE(ABORT, 'platform_identity_immutable'); END;

CREATE TRIGGER platform_instance_access_retained
BEFORE DELETE ON platform_instance_access
WHEN OLD.access <> 'allowed' OR OLD.access_revision <> 1 OR OLD.source_invitation_id IS NOT NULL
 OR NOT EXISTS (
   SELECT 1 FROM platform_service_instances i
   WHERE i.namespace = OLD.namespace AND i.id = OLD.instance_id AND i.service_id = 'wallet'
     AND NOT EXISTS (SELECT 1 FROM wallet_service_bindings b
       WHERE b.namespace = i.namespace AND b.instance_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM platform_provision_operations o
       WHERE o.namespace = i.namespace AND o.instance_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM platform_service_principals p
       WHERE p.namespace = i.namespace AND p.instance_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM billing_funds_reservations r
       WHERE r.namespace = i.namespace AND r.instance_id = i.id)
     AND NOT EXISTS (SELECT 1 FROM billing_usage_receipts u
       WHERE u.namespace = i.namespace AND u.instance_id = i.id)
 )
BEGIN
  SELECT RAISE(ABORT, 'platform_access_retained');
END;

CREATE TRIGGER platform_service_invitation_immutable_delete BEFORE DELETE ON platform_service_invitation_grants
    BEGIN SELECT RAISE(ABORT, 'platform_invitation_grant_immutable'); END;

CREATE TRIGGER platform_automation_grant_retained BEFORE DELETE ON platform_automation_grants
    BEGIN SELECT RAISE(ABORT, 'platform_automation_grant_retained'); END;

CREATE TRIGGER billing_prices_immutable_delete BEFORE DELETE ON billing_price_definitions
    BEGIN SELECT RAISE(ABORT, 'billing_price_immutable'); END;

CREATE TRIGGER billing_jev_hours_immutable_delete BEFORE DELETE ON billing_jev_hours
    BEGIN SELECT RAISE(ABORT, 'usage_event_immutable'); END;

CREATE TRIGGER billing_test_accounts_immutable_delete BEFORE DELETE ON billing_isolated_test_accounts
    BEGIN SELECT RAISE(ABORT, 'billing_test_account_immutable'); END;

CREATE TRIGGER platform_provision_scope_guard
  BEFORE INSERT ON platform_provision_operations
  BEGIN
    SELECT RAISE(ABORT, 'platform_scope_forbidden') WHERE NOT EXISTS (
      SELECT 1 FROM organizations o
      JOIN organization_memberships m ON m.namespace = o.namespace AND m.org_id = o.id
      JOIN projects p ON p.namespace = o.namespace AND p.org_id = o.id
      WHERE o.namespace = NEW.namespace AND o.id = NEW.org_id AND o.status = 'ACTIVE'
        AND o.authorization_version = NEW.authority_revision AND p.id = NEW.project_id
        AND p.status = 'ACTIVE' AND m.user_id = NEW.actor_user_id AND m.kind = 'ACTIVE'
        AND (m.role = 'OWNER' OR (m.role = 'ADMIN' AND EXISTS (
          SELECT 1 FROM organization_admin_permissions a
          WHERE a.namespace = m.namespace AND a.org_id = m.org_id
            AND a.membership_id = m.id AND a.permission = 'projects.manage'
        )))
    );
    SELECT RAISE(ABORT, 'platform_scope_forbidden') WHERE EXISTS (
      SELECT 1 FROM platform_service_instances i WHERE i.namespace = NEW.namespace AND i.id = NEW.instance_id
      AND (i.org_id <> NEW.org_id OR i.project_id <> NEW.project_id
        OR i.billing_account_id <> NEW.billing_account_id OR i.service_id <> NEW.service_id
        OR i.deployment_id <> NEW.deployment_id)
    );
    SELECT RAISE(ABORT, 'platform_instance_archived') WHERE EXISTS (
      SELECT 1 FROM platform_service_instances i
      WHERE i.namespace = NEW.namespace AND i.id = NEW.instance_id AND i.phase = 'archived'
    );
    SELECT RAISE(ABORT, 'platform_binding_conflict') WHERE EXISTS (
      SELECT 1 FROM platform_service_instances i
      WHERE i.namespace = NEW.namespace AND i.id = NEW.instance_id
      AND json_extract(NEW.payload_json, '$.binding') <> i.target_json
      AND NOT EXISTS (SELECT 1 FROM wallet_service_bindings b
        WHERE b.namespace = i.namespace AND b.instance_id = i.id
        AND b.binding_json = json_extract(NEW.payload_json, '$.binding'))
    );
    SELECT RAISE(ABORT, 'platform_transition_conflict') WHERE NOT (
      COALESCE((NEW.command = 'enable' AND NEW.desired_revision = 1
        AND json_extract(NEW.payload_json, '$.binding.kind') IN ('create_native_scope', 'attach_existing_scope')
        AND NOT EXISTS (SELECT 1 FROM platform_service_instances
          WHERE namespace = NEW.namespace AND id = NEW.instance_id)), 0)
      OR EXISTS (
        SELECT 1 FROM platform_service_instances i
        JOIN platform_provision_operations previous
          ON previous.namespace = i.namespace AND previous.id = i.operation_id
        WHERE i.namespace = NEW.namespace AND i.id = NEW.instance_id
        AND NEW.desired_revision = i.desired_revision + 1
        AND (
          (i.phase = 'failed' AND NEW.command = previous.command)
          OR (NEW.command = 'enable' AND i.phase = 'disabled' AND i.desired_state = 'disabled')
          OR (NEW.command = 'enable' AND NEW.service_id = 'wallet' AND i.phase = 'active')
          OR (NEW.command = 'disable' AND i.phase IN ('provisioning', 'active'))
          OR (NEW.command = 'archive' AND i.phase = 'disabled' AND i.desired_state = 'disabled'
            AND i.observed_state = 'disabled' AND i.observed_revision = i.desired_revision)
        )
      )
    );
  END;

CREATE TRIGGER platform_provision_receipt_guard
  BEFORE INSERT ON platform_provision_receipts
  BEGIN
    SELECT RAISE(ABORT, 'platform_receipt_conflict') WHERE NOT EXISTS (
      SELECT 1 FROM platform_provision_operations o
      WHERE o.namespace = NEW.namespace AND o.id = NEW.operation_id
      AND o.instance_id = json_extract(NEW.payload_json, '$.instanceId')
      AND o.desired_revision = json_extract(NEW.payload_json, '$.desiredRevision')
      AND NEW.disposition = CASE WHEN o.desired_revision = (
        SELECT desired_revision FROM platform_service_instances
        WHERE namespace = o.namespace AND id = o.instance_id
      ) THEN 'applied' ELSE 'stale' END
      AND NEW.result = CASE o.command WHEN 'enable' THEN 'active' WHEN 'disable' THEN 'disabled' ELSE 'archived' END
      AND EXISTS (SELECT 1 FROM wallet_service_bindings b
        WHERE b.namespace = o.namespace AND b.instance_id = o.instance_id
        AND b.binding_json = json_extract(NEW.payload_json, '$.binding'))
    );
  END;

CREATE TRIGGER billing_usage_events_scope_guard BEFORE INSERT ON billing_usage_events
    WHEN NOT EXISTS (SELECT 1 FROM platform_service_instances i WHERE i.namespace = NEW.namespace AND i.id = NEW.instance_id
      AND i.org_id = NEW.org_id AND i.project_id = NEW.project_id AND i.billing_account_id = NEW.billing_account_id
      AND i.service_id = NEW.producer_service_id AND i.deployment_id = NEW.producer_deployment_id
      AND EXISTS (SELECT 1 FROM platform_provision_receipts r JOIN platform_provision_operations o
        ON o.namespace = r.namespace AND o.id = r.operation_id
        WHERE o.namespace = i.namespace AND o.instance_id = i.id AND r.result = 'active' AND r.disposition = 'applied')
      AND EXISTS (SELECT 1 FROM wallet_service_bindings w WHERE w.namespace = i.namespace AND w.instance_id = i.id))
    BEGIN SELECT RAISE(ABORT, 'usage_scope_forbidden'); END;

CREATE VIEW billing_charge_attributions AS
    SELECT e.namespace, r.ledger_entry_id, e.org_id, e.project_id, e.billing_account_id, e.instance_id,
      e.producer_service_id AS service_id, e.meter_id, e.price_version, e.quantity, e.unit
    FROM billing_usage_events e
    JOIN billing_usage_receipts r USING (namespace, producer_service_id, producer_deployment_id, instance_id, event_id)
    WHERE e.meter_id = 'wallet.monthly_active_resource' AND r.outcome = 'charged'
    UNION ALL
    SELECT c.namespace, c.ledger_entry_id, c.org_id, c.project_id, c.billing_account_id, c.instance_id,
      'wallet' AS service_id, c.meter_id, c.price_version, 1 AS quantity, 'execution' AS unit
    FROM billing_execution_charges c WHERE c.meter_id = 'wallet.execution' AND c.ledger_entry_id IS NOT NULL;

CREATE VIEW billing_document_line_items AS
 SELECT * FROM invoice_line_items
 UNION ALL
 SELECT i.namespace,i.org_id,
   'monthly-item:'||i.month_utc||':'||i.usage_month_utc||':'||l.entry_type||':'||COALESCE(a.project_id,'account')||':'||COALESCE(a.price_version,'plan'),
   'monthly:'||i.org_id||':'||i.month_utc,i.month_utc,
     CASE   l.entry_type WHEN 'PRODUCT_EXECUTION_DEBIT' THEN 'PRODUCT_EXECUTION_DEBIT' WHEN 'PLAN_BASE_CHARGE' THEN 'PLAN_BASE_FEE' WHEN 'PLAN_USAGE_CHARGE' THEN 'PLAN_SIGNING_USAGE' ELSE 'MANUAL_ADJUSTMENT'   END  ,
     CASE   l.entry_type WHEN 'PRODUCT_EXECUTION_DEBIT' THEN COALESCE(a.service_id,'Product')||' execution / '||COALESCE(a.project_id,'organization')||' / '||COALESCE(a.price_version,'accepted quote')
     ELSE MAX(l.description)   END  ||' [usage month '||i.usage_month_utc||']',
   1,SUM(i.amount_minor),SUM(i.amount_minor),MAX(c.cutoff_ms)
 FROM billing_monthly_invoice_items i JOIN billing_monthly_closes c USING(namespace,org_id,month_utc)
 JOIN billing_ledger_entries l ON l.namespace=i.namespace AND l.org_id=i.org_id AND l.id=i.ledger_entry_id
 LEFT JOIN billing_charge_attributions a ON a.namespace=l.namespace AND a.org_id=l.org_id AND a.ledger_entry_id=l.id
 GROUP BY i.namespace,i.org_id,i.month_utc,i.usage_month_utc,l.entry_type,a.project_id,a.service_id,a.price_version
 HAVING SUM(i.amount_minor)<>0;
PRAGMA defer_foreign_keys = OFF;
