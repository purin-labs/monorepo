import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CONSOLE_UNKNOWN_STATUS,
  decodeConsoleEnum,
  decodeConsoleMinorAmount,
  decodeConsoleStatus,
} from '../../apps/wallet-console/src/core/dashboard/consoleDecode';
import type * as ApiKeysApi from '../../apps/wallet-console/src/core/dashboard/routes/api-keys/consoleApiKeysApi';
import type * as BillingApi from '../../apps/wallet-console/src/core/dashboard/routes/billing/consoleBillingApi';
import type * as ApprovalsApi from '../../apps/wallet-console/src/products/wallet/approvals/consoleApprovalsApi';
import type * as GasSponsorshipApi from '../../apps/wallet-console/src/products/wallet/gas-sponsorship/consoleGasSponsorshipApi';
import type * as PoliciesApi from '../../apps/wallet-console/src/products/wallet/policy-engine/consolePoliciesApi';

const appRoot = path.resolve(import.meta.dirname, '../../apps/wallet-console');
const CONSOLE_BASE_URL = 'https://console.example.test';

/** Bundles one Console API module for Node. The deployment and the Wallet SDK are stubs. */
async function loadConsoleModule<T>(relativePath: string): Promise<T> {
  const result = await build({
    entryPoints: [path.join(appRoot, relativePath)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    tsconfig: path.join(appRoot, 'tsconfig.json'),
    logLevel: 'silent',
    plugins: [
      {
        name: 'console-stubs',
        setup(builder) {
          builder.onResolve({ filter: /^(@core\/runtime|@seams\/wallet\/advanced)$/ }, (args) => ({
            path: args.path,
            namespace: 'stub',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
            loader: 'js',
            contents:
              args.path === '@core/runtime'
                ? `export const getActiveFrontendDeployment = () => ({ consoleBaseUrl: '${CONSOLE_BASE_URL}' });`
                : [
                    'export const parseWalletSessionLimits = (value) => value;',
                    'export const keccak256Bytes = () => new Uint8Array(32);',
                  ].join('\n'),
          }));
        },
      },
    ],
  });
  const directory = mkdtempSync(path.join(tmpdir(), 'console-decoders-'));
  const file = path.join(directory, 'module.mjs');
  writeFileSync(file, result.outputFiles[0]?.text ?? '');
  try {
    return (await import(pathToFileURL(file).href)) as T;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Answers every Console request with one JSON body until the returned function runs. */
function answerConsoleRequests(body: unknown): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  return () => {
    globalThis.fetch = original;
  };
}

test('the decode rules never turn a missing or unknown value into a good one', () => {
  expect(decodeConsoleStatus('REVOKED')).toBe('REVOKED');
  expect(decodeConsoleStatus(undefined)).toBe(CONSOLE_UNKNOWN_STATUS);
  expect(decodeConsoleStatus('  ')).toBe(CONSOLE_UNKNOWN_STATUS);

  expect(decodeConsoleEnum('B', ['A', 'B'], 'letter')).toBe('B');
  expect(() => decodeConsoleEnum('C', ['A', 'B'], 'letter')).toThrow(
    'The Console response has an unknown letter: "C"',
  );
  expect(() => decodeConsoleEnum(undefined, ['A', 'B'], 'letter')).toThrow(
    'The Console response has no letter',
  );

  expect(decodeConsoleMinorAmount(-250, 'amount')).toBe(-250);
  expect(decodeConsoleMinorAmount(0, 'amount')).toBe(0);
  expect(() => decodeConsoleMinorAmount(undefined, 'amount')).toThrow('has no amount');
  expect(() => decodeConsoleMinorAmount('250', 'amount')).toThrow('has an unknown amount');
  expect(() => decodeConsoleMinorAmount(2.5, 'amount')).toThrow('has an unknown amount');
});

test('an API key without a status is unknown, and an unknown kind is an error', async () => {
  const api = await loadConsoleModule<typeof ApiKeysApi>(
    'src/core/dashboard/routes/api-keys/consoleApiKeysApi.ts',
  );
  const key = { id: 'key_1', orgId: 'org_1', kind: 'publishable_key', status: 'REVOKED' };

  let restore = answerConsoleRequests({
    ok: true,
    apiKeys: [key, { ...key, id: 'key_2', status: undefined }],
  });
  try {
    const keys = await api.listDashboardApiKeys();
    expect(keys.map((entry) => [entry.id, entry.kind, entry.status])).toEqual([
      ['key_1', 'publishable_key', 'REVOKED'],
      ['key_2', 'publishable_key', CONSOLE_UNKNOWN_STATUS],
    ]);
  } finally {
    restore();
  }

  restore = answerConsoleRequests({ ok: true, apiKeys: [{ ...key, kind: 'service_key' }] });
  try {
    await expect(api.listDashboardApiKeys()).rejects.toThrow('unknown API key kind');
  } finally {
    restore();
  }
});

test('a billing entry of an unknown type or without an amount is an error', async () => {
  const api = await loadConsoleModule<typeof BillingApi>(
    'src/core/dashboard/routes/billing/consoleBillingApi.ts',
  );
  const entry = {
    id: 'ble_1',
    orgId: 'org_1',
    type: 'REFUND',
    amountMinor: -500,
    actorType: 'PROVIDER',
    createdAt: '2026-11-18T00:00:00.000Z',
  };
  expect(api.parseDashboardBillingAccountActivityEntry(entry)).toMatchObject({
    type: 'REFUND',
    amountMinor: -500,
    actorType: 'PROVIDER',
  });
  expect(() =>
    api.parseDashboardBillingAccountActivityEntry({ ...entry, type: 'CHARGEBACK' }),
  ).toThrow('unknown billing activity type');
  expect(() =>
    api.parseDashboardBillingAccountActivityEntry({ ...entry, amountMinor: undefined }),
  ).toThrow('has no billing activity amountMinor');
  expect(() =>
    api.parseDashboardBillingAccountActivityEntry({ ...entry, actorType: 'ROBOT' }),
  ).toThrow('unknown billing activity actorType');
});

test('an approval decision or status that is not known is an error, not APPROVE or PENDING', async () => {
  const api = await loadConsoleModule<typeof ApprovalsApi>(
    'src/products/wallet/approvals/consoleApprovalsApi.ts',
  );
  const approval = {
    id: 'apr_1',
    orgId: 'org_1',
    operationType: 'KEY_EXPORT',
    status: 'REJECTED',
    reason: 'Export a key',
    requestedByUserId: 'user_1',
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    decisions: [
      {
        decision: 'REJECT',
        actorUserId: 'user_2',
        reason: 'No',
        decidedAt: '2026-11-18T00:00:00.000Z',
      },
    ],
  };

  let restore = answerConsoleRequests({ ok: true, approvals: [approval] });
  try {
    const [decoded] = await api.listDashboardApprovals();
    expect(decoded?.status).toBe('REJECTED');
    expect(decoded?.decisions.map((entry) => entry.decision)).toEqual(['REJECT']);
  } finally {
    restore();
  }

  restore = answerConsoleRequests({
    ok: true,
    approvals: [{ ...approval, decisions: [{ ...approval.decisions[0], decision: 'ABSTAIN' }] }],
  });
  try {
    await expect(api.listDashboardApprovals()).rejects.toThrow('unknown approval decision');
  } finally {
    restore();
  }

  restore = answerConsoleRequests({ ok: true, approvals: [{ ...approval, status: undefined }] });
  try {
    await expect(api.listDashboardApprovals()).rejects.toThrow('has no approval status');
  } finally {
    restore();
  }
});

test('the policy simulator refuses a decision it does not know and keeps an unknown deny code', async () => {
  const api = await loadConsoleModule<typeof PoliciesApi>(
    'src/products/wallet/policy-engine/consolePoliciesApi.ts',
  );
  const simulation = {
    policyId: 'pol_1',
    decision: 'DENY',
    denyReasons: [
      { code: 'CHAIN_NOT_ALLOWED', message: 'Chain 1 is not allowed' },
      { code: 'VELOCITY_LIMIT_EXCEEDED', message: 'Too many calls' },
      { code: 'GEOFENCE' },
    ],
    evaluatedAt: '2026-11-18T00:00:00.000Z',
    policyVersion: 3,
    normalizedRequest: { action: 'transfer' },
  };
  const simulate = () => api.simulateDashboardPolicy({ policyId: 'pol_1', action: 'transfer' });

  let restore = answerConsoleRequests({ ok: true, simulation });
  try {
    const result = await simulate();
    expect(result.decision).toBe('DENY');
    expect(result.denyReasons).toEqual([
      { code: 'CHAIN_NOT_ALLOWED', message: 'Chain 1 is not allowed' },
      { code: 'VELOCITY_LIMIT_EXCEEDED', message: 'Too many calls' },
      { code: 'GEOFENCE', message: '' },
    ]);
  } finally {
    restore();
  }

  for (const decision of ['MAYBE', 'allow ', undefined]) {
    restore = answerConsoleRequests({ ok: true, simulation: { ...simulation, decision } });
    try {
      await expect(simulate()).rejects.toThrow('policy simulation decision');
    } finally {
      restore();
    }
  }

  restore = answerConsoleRequests({
    ok: true,
    simulation: { ...simulation, denyReasons: [{ message: 'No code' }] },
  });
  try {
    await expect(simulate()).rejects.toThrow('has no policy deny reason code');
  } finally {
    restore();
  }
});

test('a gas sponsorship spend cap never reads as no cap or as a guessed period', async () => {
  const api = await loadConsoleModule<typeof GasSponsorshipApi>(
    'src/products/wallet/gas-sponsorship/consoleGasSponsorshipApi.ts',
  );
  const spendCap = {
    mode: 'WALLET_CHAIN_TOTAL',
    period: 'WEEKLY',
    capsByChain: [{ chainId: 42_431, capMinor: 5_000 }],
  };
  const policyWith = (cap: unknown) => ({
    id: 'pol_gas',
    orgId: 'org_1',
    kind: 'GAS_SPONSORSHIP',
    status: 'PUBLISHED',
    name: 'Gas',
    rules: { kind: 'evm_call', allowedCalls: [], spendCap: cap },
  });

  let restore = answerConsoleRequests({ ok: true, policies: [policyWith(spendCap)] });
  try {
    const [policy] = await api.listDashboardGasSponsorshipPolicies();
    expect(policy?.spendCap).toEqual(spendCap);
  } finally {
    restore();
  }

  const refused: Array<[unknown, string]> = [
    [{ ...spendCap, mode: 'PER_WALLET' }, 'unknown gas sponsorship spendCap mode'],
    [{ ...spendCap, mode: undefined }, 'has no gas sponsorship spendCap mode'],
    [{ ...spendCap, period: 'DAILY' }, 'unknown gas sponsorship spendCap period'],
    [{ ...spendCap, period: undefined }, 'has no gas sponsorship spendCap period'],
    [undefined, 'has no gas sponsorship spendCap'],
    [{ ...spendCap, capsByChain: [{ chainId: 42_431 }] }, 'spend cap capMinor'],
  ];
  for (const [cap, message] of refused) {
    restore = answerConsoleRequests({ ok: true, policies: [policyWith(cap)] });
    try {
      await expect(api.listDashboardGasSponsorshipPolicies()).rejects.toThrow(message);
    } finally {
      restore();
    }
  }
});
