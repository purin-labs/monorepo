import { expect, test } from '@playwright/test';
import {
  createCloudflareConsoleRouter,
  type ConsoleAuthClaims,
} from '@seams-internal/wallet-console-server/router/cloudflare-adaptor';
import type { ConsoleApiKeyService } from '../../packages/wallet-console-server-ts/src/apiKeys/service';
import { createD1ConsoleWalletEnvironmentService } from '../../packages/wallet-console-server-ts/src/environments/d1';
import { callCf, makeConsoleAuthAdapter } from './helpers';
import {
  applyD1MigrationFiles,
  cleanupTemporaryD1Database,
  createTemporaryD1Database,
  listD1MigrationFiles,
} from '../helpers/sqliteD1';

const namespace = 'api-key-environment-state';
const orgId = 'org-api-key-environment-state';
const projectId = 'api-key-environment-state-project';
const disabledId = `${projectId}:prod`;
const archivedId = `${projectId}:staging`;

const OWNER: ConsoleAuthClaims = {
  userId: 'owner',
  orgId,
  platformSupport: false,
  membershipId: 'membership-owner',
  role: 'OWNER',
  authorizationVersion: 1,
  adminPermissions: [],
  projectAccess: { kind: 'all' },
};

const fixtureDirectories: string[] = [];

test.afterEach(() => {
  for (const directory of fixtureDirectories) cleanupTemporaryD1Database(directory);
  fixtureDirectories.length = 0;
});

async function createRouter() {
  const temporary = createTemporaryD1Database();
  fixtureDirectories.push(temporary.tempDir);
  await applyD1MigrationFiles(temporary.database, listD1MigrationFiles('d1-console'));
  await temporary.database.exec(`
    INSERT INTO organizations (namespace, id, name, slug, created_by_user_id, status, created_at_ms, updated_at_ms)
      VALUES ('${namespace}', '${orgId}', 'State', 'state', 'owner', 'ACTIVE', 1, 1);
    INSERT INTO projects (namespace, id, org_id, name, slug, status, created_at_ms, updated_at_ms)
      VALUES ('${namespace}', '${projectId}', '${orgId}', 'State', 'state', 'ACTIVE', 1, 1);
    INSERT INTO environments (namespace, id, org_id, project_id, env_key, runtime_version, name, status, created_at_ms, updated_at_ms)
      VALUES
        ('${namespace}', '${disabledId}', '${orgId}', '${projectId}', 'prod', 'default', 'Production', 'DISABLED', 1, 1),
        ('${namespace}', '${archivedId}', '${orgId}', '${projectId}', 'staging', 'default', 'Staging', 'ARCHIVED', 1, 1);
  `);
  const walletEnvironments = await createD1ConsoleWalletEnvironmentService({
    database: temporary.database,
    namespace,
    ensureSchema: false,
  });
  // The route refuses the environment before it calls the key service.
  const apiKeys = {
    createApiKey: async () => {
      throw new Error('An API key must not be created for an environment that is not active');
    },
  } as unknown as ConsoleApiKeyService;
  return createCloudflareConsoleRouter({
    auth: makeConsoleAuthAdapter(OWNER),
    walletEnvironments,
    apiKeys,
  });
}

function createKey(router: Awaited<ReturnType<typeof createRouter>>, environmentId: string) {
  return callCf(router, {
    method: 'POST',
    path: '/console/api-keys',
    body: {
      kind: 'publishable_key',
      name: 'State check',
      environmentId,
      allowedOrigins: ['https://app.example.test'],
      rateLimitBucket: 'default',
      quotaBucket: 'default',
    },
  });
}

test('a disabled environment is refused as disabled, and an archived one as archived', async () => {
  const router = await createRouter();

  const disabled = await createKey(router, disabledId);
  expect(disabled.status, disabled.text).toBe(409);
  expect(disabled.json).toMatchObject({ ok: false, code: 'environment_disabled' });
  expect(String(disabled.json?.message)).toContain('is disabled');

  const archived = await createKey(router, archivedId);
  expect(archived.status, archived.text).toBe(409);
  expect(archived.json).toMatchObject({ ok: false, code: 'environment_archived' });
  expect(String(archived.json?.message)).toContain('is archived');
});
