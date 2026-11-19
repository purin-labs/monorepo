import { expect, test } from '@playwright/test';
import { createD1ConsoleSponsorshipSpendCapService } from '../../packages/wallet-console-server-ts/src/sponsorshipSpendCaps/d1';
import { ConsoleSponsorshipSpendCapError } from '../../packages/wallet-console-server-ts/src/sponsorshipSpendCaps/errors';
import {
  applyD1MigrationFiles,
  cleanupTemporaryD1Database,
  createTemporaryD1Database,
  listD1MigrationFiles,
} from '../helpers/sqliteD1';

const ctx = { orgId: 'org_spend_cap', actorUserId: 'system:test' };

function reservation(sourceEventId: string, estimatedSpendMinor: number) {
  return {
    sourceEventId,
    environmentId: 'env_spend_cap',
    policyId: 'pol_spend_cap',
    accountRef: null,
    chainId: 42_431,
    mode: 'CHAIN_TOTAL',
    period: 'MONTHLY',
    capMinor: 1_000,
    estimatedSpendMinor,
  } as const;
}

async function spendCapsFixture() {
  const temp = createTemporaryD1Database();
  await applyD1MigrationFiles(temp.database, listD1MigrationFiles('d1-console'));
  const spendCaps = await createD1ConsoleSponsorshipSpendCapService({
    database: temp.database,
    namespace: 'spend-cap-conflict',
    ensureSchema: false,
    now: () => new Date('2026-11-18T00:00:00.000Z'),
  });
  return { database: temp.database, spendCaps, tempDir: temp.tempDir };
}

test('a reservation above the cap is refused as spend_cap_exceeded', async () => {
  const { spendCaps, tempDir } = await spendCapsFixture();
  try {
    await spendCaps.reserve(ctx, reservation('event_a', 900));
    const refused = await spendCaps.reserve(ctx, reservation('event_b', 200)).catch((e) => e);
    expect(refused).toBeInstanceOf(ConsoleSponsorshipSpendCapError);
    expect((refused as ConsoleSponsorshipSpendCapError).code).toBe('spend_cap_exceeded');
  } finally {
    cleanupTemporaryD1Database(tempDir);
  }
});

test('a UNIQUE failure that is not a replay is a conflict, not spend_cap_exceeded', async () => {
  const { database, spendCaps, tempDir } = await spendCapsFixture();
  try {
    // A test-only index makes a second event in the same environment collide, far below the cap.
    await database.exec(`
      CREATE UNIQUE INDEX test_one_reservation_per_environment
        ON sponsorship_spend_cap_reservations (namespace, org_id, environment_id);
    `);
    const first = await spendCaps.reserve(ctx, reservation('event_a', 100));
    expect(first.disposition).not.toBe('replayed');

    const replay = await spendCaps.reserve(ctx, reservation('event_a', 100));
    expect(replay.disposition).toBe('replayed');

    const conflict = await spendCaps.reserve(ctx, reservation('event_b', 100)).catch((e) => e);
    expect(conflict).toBeInstanceOf(ConsoleSponsorshipSpendCapError);
    expect((conflict as ConsoleSponsorshipSpendCapError).code).toBe('reservation_conflict');
    expect((conflict as ConsoleSponsorshipSpendCapError).status).toBe(409);
  } finally {
    cleanupTemporaryD1Database(tempDir);
  }
});
