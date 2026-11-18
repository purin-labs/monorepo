import { expect, test } from '@playwright/test';
import { isD1UniqueConstraintError } from '../../packages/console-server-ts/src/boundary/d1';
import { createD1ConsoleApprovalService } from '../../packages/wallet-console-server-ts/src/approvals/d1';
import { ConsoleApprovalsError } from '../../packages/wallet-console-server-ts/src/approvals/errors';
import {
  applyD1MigrationFiles,
  cleanupTemporaryD1Database,
  createTemporaryD1Database,
  listD1MigrationFiles,
} from '../helpers/sqliteD1';

async function sqliteError(
  database: ReturnType<typeof createTemporaryD1Database>['database'],
  sql: string,
): Promise<unknown> {
  try {
    await database.exec(sql);
  } catch (error: unknown) {
    return error;
  }
  throw new Error(`Expected SQLite to refuse: ${sql}`);
}

test('only a UNIQUE or PRIMARY KEY failure counts as a D1 conflict', async () => {
  const temp = createTemporaryD1Database();
  try {
    const { database } = temp;
    await database.exec(`
      CREATE TABLE parents (id TEXT PRIMARY KEY);
      CREATE TABLE rows (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        email TEXT UNIQUE,
        amount INTEGER NOT NULL CHECK (amount >= 0),
        parent_id TEXT REFERENCES parents(id),
        PRIMARY KEY (namespace, id)
      );
      INSERT INTO parents (id) VALUES ('p1');
      INSERT INTO rows (namespace, id, email, amount, parent_id) VALUES ('n', 'r1', 'a@example.test', 1, 'p1');
    `);

    const primaryKey = await sqliteError(
      database,
      `INSERT INTO rows (namespace, id, email, amount) VALUES ('n', 'r1', 'b@example.test', 1);`,
    );
    const unique = await sqliteError(
      database,
      `INSERT INTO rows (namespace, id, email, amount) VALUES ('n', 'r2', 'a@example.test', 1);`,
    );
    const notNull = await sqliteError(
      database,
      `INSERT INTO rows (namespace, id, email, amount) VALUES ('n', 'r3', 'c@example.test', NULL);`,
    );
    const check = await sqliteError(
      database,
      `INSERT INTO rows (namespace, id, email, amount) VALUES ('n', 'r4', 'd@example.test', -1);`,
    );
    const foreignKey = await sqliteError(
      database,
      `PRAGMA foreign_keys = ON;
       INSERT INTO rows (namespace, id, email, amount, parent_id) VALUES ('n', 'r5', 'e@example.test', 1, 'missing');`,
    );

    expect(isD1UniqueConstraintError(primaryKey)).toBe(true);
    expect(isD1UniqueConstraintError(unique)).toBe(true);
    expect(isD1UniqueConstraintError(notNull)).toBe(false);
    expect(isD1UniqueConstraintError(check)).toBe(false);
    expect(isD1UniqueConstraintError(foreignKey)).toBe(false);

    // D1 can name the extended result code instead of the SQLite text.
    expect(isD1UniqueConstraintError(new Error('D1_ERROR: SQLITE_CONSTRAINT_PRIMARYKEY'))).toBe(
      true,
    );
    expect(isD1UniqueConstraintError(new Error('D1_ERROR: SQLITE_CONSTRAINT_NOTNULL'))).toBe(false);
  } finally {
    cleanupTemporaryD1Database(temp.tempDir);
  }
});

test('a D1 store reports a duplicate as a conflict and a NOT NULL failure as an error', async () => {
  const temp = createTemporaryD1Database();
  try {
    await applyD1MigrationFiles(temp.database, listD1MigrationFiles('d1-console'));
    const approvals = await createD1ConsoleApprovalService({
      database: temp.database,
      namespace: 'unique-constraint-test',
      ensureSchema: false,
    });
    const ctx = { orgId: 'org_unique', actorUserId: 'user_unique' };
    const request = {
      id: 'apr_unique',
      operationType: 'KEY_EXPORT',
      resourceType: 'key_export',
      reason: 'Export a key',
      resourceId: 'kx_unique',
    } as const;

    await approvals.createApprovalRequest(ctx, request);

    const duplicate = await approvals.createApprovalRequest(ctx, request).catch((e) => e);
    expect(duplicate).toBeInstanceOf(ConsoleApprovalsError);
    expect((duplicate as ConsoleApprovalsError).code).toBe('approval_request_exists');

    // A NULL in a NOT NULL column is a bug in the caller, not "already exists".
    const callerBug = await approvals
      .createApprovalRequest(ctx, {
        ...request,
        id: 'apr_caller_bug',
        reason: null as unknown as string,
      })
      .catch((e) => e);
    expect(callerBug).not.toBeInstanceOf(ConsoleApprovalsError);
    expect(String((callerBug as Error).message)).toContain('NOT NULL constraint failed');
  } finally {
    cleanupTemporaryD1Database(temp.tempDir);
  }
});
