import { expect, test } from '@playwright/test';
import { createD1ConsoleApprovalService } from '../../packages/wallet-console-server-ts/src/approvals/d1';
import {
  applyD1MigrationFiles,
  cleanupTemporaryD1Database,
  createTemporaryD1Database,
  listD1MigrationFiles,
} from '../helpers/sqliteD1';

const namespace = 'approval-stored-values';
const orgId = 'org_approval_stored_values';
const approvalId = 'apr_stored_values';

async function approvalsWithStoredDecisions(decisionsJson: string) {
  const temp = createTemporaryD1Database();
  await applyD1MigrationFiles(temp.database, listD1MigrationFiles('d1-console'));
  // Two approvals are required, and one is already stored with the given decision.
  await temp.database.exec(`
    INSERT INTO approvals (
      namespace, org_id, id, operation_type, status, reason, requested_by_user_id,
      required_approvals, require_mfa, project_id, environment_id, resource_type, resource_id,
      policy_rules_digest, metadata_json, decisions_json, created_at_ms, updated_at_ms, resolved_at_ms
    ) VALUES (
      '${namespace}', '${orgId}', '${approvalId}', 'POLICY_PUBLISH', 'PENDING', 'Publish',
      'requester', 2, 0, NULL, NULL, 'policy', 'pol_1', 'digest', '{}',
      '${decisionsJson}', 1, 1, NULL
    );
  `);
  const approvals = await createD1ConsoleApprovalService({
    database: temp.database,
    namespace,
    ensureSchema: false,
  });
  return { approvals, tempDir: temp.tempDir };
}

/** One stored decision, in the exact form that the store writes and compares. */
function storedDecision(decision: string): string {
  return JSON.stringify([
    {
      decision,
      actorUserId: 'first',
      reason: 'Stored',
      mfaVerified: false,
      decidedAt: '2026-11-18T00:00:00.000Z',
    },
  ]);
}

test('a stored approval counts toward the threshold', async () => {
  const { approvals, tempDir } = await approvalsWithStoredDecisions(storedDecision('APPROVE'));
  try {
    const approved = await approvals.approveApprovalRequest(
      { orgId, actorUserId: 'second' },
      approvalId,
      { kind: 'without_step_up', reason: 'Second approval' },
    );
    expect(approved?.status).toBe('APPROVED');
  } finally {
    cleanupTemporaryD1Database(tempDir);
  }
});

test('a stored decision that the server does not know never counts as an approval', async () => {
  const { approvals, tempDir } = await approvalsWithStoredDecisions(storedDecision('ABSTAIN'));
  try {
    const ctx = { orgId, actorUserId: 'second' };
    await expect(approvals.getApprovalRequest(ctx, approvalId)).rejects.toThrow(
      'Stored approval has an unknown decision: "ABSTAIN"',
    );
    await expect(
      approvals.approveApprovalRequest(ctx, approvalId, {
        kind: 'without_step_up',
        reason: 'Second approval',
      }),
    ).rejects.toThrow('unknown decision');
  } finally {
    cleanupTemporaryD1Database(tempDir);
  }
});
