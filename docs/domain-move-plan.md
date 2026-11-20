# Domain move plan

Status: proposed on 2026-11-20. Nothing in this plan is done yet.

The owner moved the private repository to `purin-labs/monorepo` on 2026-11-20 (done). The
same change set moves the public hosts:

- The company site (`apps/seams-site`) moves from `seams.sh` to `purin.io`.
- The Wallet site and the Console (`apps/wallet-console`) move from `wallet.seams.sh` to
  `seams.sh`. `wallet.seams.sh` redirects to `seams.sh`.
- The Wallet staging site moves from `staging.wallet.seams.sh` to `staging.seams.sh`.
- The Wallet docs move from `docs.wallet.seams.sh` to `docs.seams.sh`.
  `docs.wallet.seams.sh` redirects to `docs.seams.sh`. This reverses the decision of
  2026-11-04 that kept `docs.seams.sh` empty.
- `sign.seams.sh` does not move.

## Target state

| Surface                          | Pages project               | Now                       | After                                      |
| -------------------------------- | --------------------------- | ------------------------- | ------------------------------------------ |
| Company site                     | `seams-site`                | `seams.sh`                | `purin.io`                                 |
| Company site, staging            | `seams-site-staging`        | `staging.seams.sh`        | `staging.purin.io` (open question 1)       |
| Wallet site and Console pages    | `seams-wallet-site`         | `wallet.seams.sh`         | `seams.sh`; the old host redirects         |
| Wallet site and Console, staging | `seams-wallet-site-staging` | `staging.wallet.seams.sh` | `staging.seams.sh`; the old host redirects |
| Wallet docs                      | `seams-wallet-docs`         | `docs.wallet.seams.sh`    | `docs.seams.sh`; the old host redirects    |
| Empty docs host                  | `seams-docs`                | `docs.seams.sh` (404)     | releases `docs.seams.sh`                   |
| Wallet hosts                     | `seams-wallet*`             | `*sign.seams.sh`          | no change                                  |

These hosts are not in the request, so they do not move: `api.wallet.seams.sh`,
`test.api.wallet.seams.sh`, `staging.api.wallet.seams.sh`, `console.wallet.seams.sh`,
`console.staging.wallet.seams.sh`, `console.seams.sh`, `staging.console.seams.sh`,
`test.console.seams.sh` and `staging.docs.seams.sh`.

## What does not break

- Passkeys. The RP IDs are `sign.seams.sh` and `staging.sign.seams.sh`
  (`VITE_RP_ID_BASE`), and those hosts stay.
- Wallet signing and the Gateways. Their hosts stay.

## What the move touches

1. **Cloudflare Pages domains and DNS.** `purin.io` is a Cloudflare zone with no records yet.
   `seams.sh` and `staging.seams.sh` must leave one project before another project can take
   them. Each change waits for a certificate, so plan a short gap per host.
2. **Console routes.** The Console Worker serves `/console/*`, `/account-platform/v1/*` and
   `/internal/tenant-deployment/v1/*` on its lane origin (`buildConsoleRoutes` in
   `packages/wallet-console-server-ts/scripts/render-d1-gateway-config.mjs`). The origin of
   `production-mainnet` changes to `https://seams.sh` and that of `staging-testnet` to
   `https://staging.seams.sh` (`deployment/console/targets.json`).
   Keep the same API routes on the old hosts. These callers use them:
   - the Wallet CLI (`--console-url https://wallet.seams.sh` in the public recovery guide),
   - the Pantry account authority (`docs/shared-account-platform/phase-5.md`),
   - SDK releases that are already published.
3. **Redirects.** Add one small Worker with routes `wallet.seams.sh/*`,
   `staging.wallet.seams.sh/*` and `docs.wallet.seams.sh/*`. It sends a 301 to the same path
   and query on the new host. The more specific Console API routes win over `/*`, so the
   Worker does not redirect API calls. A Pages `_redirects` file cannot do this, because it
   cannot match on the host.
4. **Company pages on `seams.sh`.** After the switch, `seams.sh` serves the Wallet site. A
   path that only the company site has (for example `/company/`) gets a 301 to the same path
   on `purin.io` in `apps/wallet-console/public/_redirects`. Make the path list from the two
   sitemaps before the switch.
5. **Sign-in providers.** The Console signs in with Google, GitHub and Apple. Each provider
   must accept the new origin and callback (`https://seams.sh/dashboard/login`, and the
   staging host) before the switch. A GitHub OAuth App has one callback URL, so change it
   in the same window as `SEAMS_GITHUB_OAUTH_CALLBACK_URL`. Console sessions are host
   cookies, so each Console user signs in again once.
6. **Pantry.** Its account authority uses `https://wallet.seams.sh`. Check the
   `PANTRY_ACCOUNT_ASSERTION_ISSUER` and `PANTRY_ACCOUNT_ASSERTION_AUDIENCE` values and the
   Pantry configuration before the Console origin changes.
7. **Allowed origins.** Tenants that list `https://wallet.seams.sh` as an allowed origin
   need `https://seams.sh` too. The Gateway CORS lists in
   `deployment/wallet-system/targets.json` already have `https://seams.sh`; add `purin.io`
   hosts only if the company site keeps a Wallet demo.
8. **This repository.** Origins in `deployment/*/targets.json`; the environment variables
   `VITE_CONSOLE_BASE_URL`, `VITE_MAINNET_CONSOLE_BASE_URL` and `VITE_DOCS_ORIGIN`;
   `PUBLIC_WALLET_DOCS_ORIGIN` (two copies in `scripts/`, merge them); `VITE_DOCS_ORIGIN` in
   the two frontend workflows; the site origin code that `apps/seams-site/src/config.ts` and
   `apps/wallet-console/src/frontendConfig.ts` repeat; canonical origins in both
   `vite.config.ts` files; the About menu and the home and footer links; `SITE_ORIGIN` in
   `packages/console-server-ts/src/email/layout.ts`; the `/docs` redirect; the tests that
   name the hosts.
9. **seams-wallet.** The docs origin and Wallet site defaults in `apps/docs`, the package
   READMEs, the recovery CLI guide, `SEAMS_WALLET_SITE_URL` in the SDK, and the examples.
   npm shows a README only from a release, so this needs a release. The production docs
   build uses the pinned seams-wallet commit.
10. **Search.** Add a `purin.io` property in Search Console. Do not use "Change of
    Address", because `seams.sh` keeps a site.

## Order

Do staging first, check it, then do production in a release from `main`.

1. Attach `purin.io` (and the staging host) to the company site projects. Deploy the company
   site with its new origin. `seams.sh` still serves it during this step.
2. Add the new origins and callbacks at Google, GitHub and Apple.
3. Deploy the Console with the new origin and with the API routes on both hosts.
4. Move `seams.sh` from `seams-site` to `seams-wallet-site`. Deploy the Wallet site with its
   new origin. Turn on the redirect Worker for `wallet.seams.sh`.
5. Move `docs.seams.sh` from `seams-docs` to `seams-wallet-docs`. Build the docs with
   `VITE_DOCS_ORIGIN=https://docs.seams.sh`. Turn on the redirect for `docs.wallet.seams.sh`.
6. Check: Console sign-in with each provider, tenant activation, the Wallet CLI against
   `wallet.seams.sh`, Pantry, `wallet-marketing-seo.e2e.mjs`, and a sample of old links.
7. Release seams-wallet with the new links.

## Repository move: what remains

- Production deploys from `main`. Before the next production deploy, `main` needs commit
  `e9c57a2a`. Without it, tenant activation rejects the OIDC token of `purin-labs/monorepo`.
- Pantry CI checks out `seams-tech/seams-monorepo` (`.github/workflows/pantry.yml`). The
  GitHub redirect keeps it working. Change the name there in a Pantry change.
- Update any cloud agent environment that names the old repository.

## Open questions

1. The staging host of the company site: `staging.purin.io`?
2. The company email addresses: keep `sales@seams.sh` and `confirm@seams.sh`, or use
   `purin.io` addresses on the company site?
3. Must any host that this plan keeps (the API, Console and `test.*` hosts) also move?
