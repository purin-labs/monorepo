import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { readCompanySite } from '../../scripts/deploy-company-site.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const companyScript = path.join(repoRoot, 'scripts/deploy-company-site.mjs');

function runCompanyScript(args: readonly string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(process.execPath, [companyScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
  });
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function siteDocument(site: Record<string, unknown>) {
  return { schemaVersion: 1, sites: { staging: site } };
}

const validSite = {
  branch: 'dev',
  origin: 'https://staging.purin.io',
  walletSiteOrigin: 'https://staging.seams.sh',
  docsOrigin: 'https://docs.seams.sh',
  pagesProjectEnv: 'CF_PAGES_PROJECT_VITE',
};

test('company site targets name each site with its branch, hosts and Pages project variable', () => {
  expect(readCompanySite('staging')).toEqual({ id: 'staging', ...validSite });
  expect(readCompanySite('production')).toMatchObject({
    branch: 'main',
    origin: 'https://purin.io',
    walletSiteOrigin: 'https://seams.sh',
  });
});

test('company site targets reject an unknown site, an unknown key and a non-https host', () => {
  expect(() => readCompanySite('development', siteDocument(validSite))).toThrow(
    /unknown company site development/u,
  );
  expect(() =>
    readCompanySite('staging', siteDocument({ ...validSite, accountId: 'abc' })),
  ).toThrow(/unknown keys: accountId/u);
  expect(() =>
    readCompanySite('staging', siteDocument({ ...validSite, origin: 'http://staging.purin.io' })),
  ).toThrow(/staging.origin must be an https origin/u);
});

test('the company site command plans without secrets and rejects a branch mismatch', () => {
  const plan = runCompanyScript(['plan', '--site', 'production']);
  expect(plan.status).toBe(0);
  expect(plan.output).toContain('Origin: https://purin.io');
  expect(plan.output).toContain('Pages project environment: CF_PAGES_PROJECT_VITE');

  const mismatch = runCompanyScript(['smoke', '--site', 'staging'], {
    ...process.env,
    GITHUB_REF: 'refs/heads/main',
  });
  expect(mismatch.status).not.toBe(0);
  expect(mismatch.output).toMatch(/site staging requires branch dev/u);

  const usage = runCompanyScript(['deploy', '--component', 'company']);
  expect(usage.status).not.toBe(0);
  expect(usage.output).toMatch(/usage: deploy-company-site\.mjs/u);
});

test('the company site workflow takes its Cloudflare account from the company secrets', () => {
  const workflow = parseYaml(
    readFileSync(path.join(repoRoot, '.github/workflows/deploy-company-site.yml'), 'utf8'),
  );
  expect(workflow.jobs.deploy.env).toMatchObject({
    CLOUDFLARE_API_TOKEN: '${{ secrets.COMPANY_CLOUDFLARE_API_TOKEN }}',
    CLOUDFLARE_ACCOUNT_ID: '${{ secrets.COMPANY_CLOUDFLARE_ACCOUNT_ID }}',
    CF_PAGES_PROJECT_VITE: '${{ secrets.CF_PAGES_PROJECT_VITE }}',
  });
  for (const file of ['deploy-staging-frontend.yml', 'deploy-production-frontend.yml']) {
    const text = readFileSync(path.join(repoRoot, '.github/workflows', file), 'utf8');
    expect(text, `${file} must not deploy the company site`).not.toMatch(/COMPANY_CLOUDFLARE_/u);
  }
});
