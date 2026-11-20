import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const moduleAt = (relativePath: string) =>
  import(pathToFileURL(path.join(repoRoot, relativePath)).href);

test('each former staging host redirects to its successor', async () => {
  const targets = await moduleAt('scripts/deployment-targets.mjs');
  const redirects = targets.readHostRedirects('staging');
  const site = targets.readFrontendSite('staging');
  const consoles = targets.readConsoleFrontendSite('staging');
  const expected = [
    ...site.formerWalletSiteOrigins.map((from: string) => ({ from, to: site.walletSiteOrigin })),
    ...consoles.formerPlatformOrigins.map((from: string) => ({
      from,
      to: consoles.platformOrigin,
    })),
    ...consoles.formerWalletConsoleOrigins.map((from: string) => ({
      from,
      to: consoles.walletConsoleOrigin,
    })),
  ];
  expect(redirects).toEqual(expected);
  for (const { from, to } of redirects) expect(from).not.toBe(to);
});

test('the redirect Worker keeps the path and query and names no other host', async () => {
  const worker = await moduleAt('deployment/host-redirects/worker.mjs');
  const redirects = { 'old.example.test': 'https://new.example.test' };
  expect(worker.redirectLocation('https://old.example.test/ja/pricing/?a=1#x', redirects)).toBe(
    'https://new.example.test/ja/pricing/?a=1',
  );
  expect(worker.redirectLocation('https://other.example.test/', redirects)).toBeNull();
  const env = { HOST_REDIRECTS_JSON: JSON.stringify(redirects) };
  const page = await worker.default.fetch(new Request('https://old.example.test/a'), env);
  expect(page.status).toBe(301);
  const post = await worker.default.fetch(
    new Request('https://old.example.test/a', { method: 'POST' }),
    env,
  );
  expect(post.status).toBe(308);
});

test('a former Wallet site host keeps every Console API route', async () => {
  const renderer = await moduleAt(
    'packages/wallet-console-server-ts/scripts/render-d1-gateway-config.mjs',
  );
  const routes = renderer.buildConsoleRoutes(
    'https://new.example.test',
    'https://new.example.test',
    [],
    ['https://old.example.test'],
  );
  const patterns = (host: string) =>
    routes
      .map((route: { pattern: string }) => route.pattern)
      .filter((pattern: string) => pattern.startsWith(`${host}/`))
      .map((pattern: string) => pattern.slice(host.length));
  expect(patterns('old.example.test')).toEqual(patterns('new.example.test'));
  expect(patterns('old.example.test')).toContain('/console/*');
});
