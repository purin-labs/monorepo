# Domain move plan

Status: proposed on 2026-11-20. The repository move is done. No host has moved yet. The names
in "Other hosts" wait for the owner's approval.

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
| Company site, staging            | `seams-site-staging`        | `staging.seams.sh`        | `staging.purin.io`                         |
| Wallet site and Console pages    | `seams-wallet-site`         | `wallet.seams.sh`         | `seams.sh`; the old host redirects         |
| Wallet site and Console, staging | `seams-wallet-site-staging` | `staging.wallet.seams.sh` | `staging.seams.sh`; the old host redirects |
| Wallet docs                      | `seams-wallet-docs`         | `docs.wallet.seams.sh`    | `docs.seams.sh`; the old host redirects    |
| Empty docs host                  | `seams-docs`                | `docs.seams.sh` (404)     | releases `docs.seams.sh`                   |
| Wallet hosts                     | `seams-wallet*`             | `*sign.seams.sh`          | no change                                  |

## Other hosts (proposed names)

The owner decided that the other hosts move too. On 2026-11-20 the owner chose
`console.seams.sh` for the Wallet Console and `api.seams.sh` for the mainnet Gateway. The
other names are a proposal.

| Host now                          | Serves                                      | Proposed                    |
| --------------------------------- | ------------------------------------------- | --------------------------- |
| `console.seams.sh`                | Platform Console (`seams-platform-console`) | `console.purin.io`          |
| `staging.console.seams.sh`        | Platform Console, staging                   | `staging.console.purin.io`  |
| `console.wallet.seams.sh`         | Wallet Console (`seams-console-wallet`)     | `console.seams.sh` (chosen) |
| `console.staging.wallet.seams.sh` | Wallet Console, staging                     | `console.staging.seams.sh`  |
| `api.wallet.seams.sh`             | Gateway, production mainnet                 | `api.seams.sh` (chosen)     |
| `test.api.wallet.seams.sh`        | Gateway, production testnet                 | `test.api.seams.sh`         |
| `staging.api.wallet.seams.sh`     | Gateway, staging                            | `staging.api.seams.sh`      |
| `test.console.seams.sh`           | Console API, production testnet             | see below                   |
| `staging.docs.seams.sh`           | `seams-docs-staging`, last deploy 2026-09   | remove                      |

`test.console.seams.sh` is the Console API of the production testnet lane: the Worker
`seams-sdk-d1-console-testnet` with its own D1 database `seams-console-testnet-sin`
(`deployment/console/targets.json`). The testnet demo on the Wallet site calls it
(`VITE_TESTNET_CONSOLE_BASE_URL`), and `deploy-live-demo.yml` activates the testnet tenant
through it. The owner asked to remove it. Removal is safe only after the testnet lane uses
another Console, so it stays until the owner decides how.

The staging Wallet Console is `console.staging.seams.sh`, not `staging.console.seams.sh`.
Console step-up passkeys use the Wallet site host as the RP ID (`CONSOLE_STEP_UP_RP_ID`), and
the Wallet Console must be a subdomain of that host: `console.seams.sh` is under `seams.sh`,
and `console.staging.seams.sh` is under `staging.seams.sh`.

Rules for these hosts:

- `console.seams.sh` changes owner in production. The Platform Console must leave it before
  the Wallet Console takes it. On staging, `staging.console.seams.sh` redirects to
  `staging.console.purin.io`.
- In production the step-up RP ID changes from `wallet.seams.sh` to `seams.sh`. Console
  step-up passkeys made for `wallet.seams.sh` then stop working, unless `wallet.seams.sh`
  publishes `/.well-known/webauthn` for the new origins. Decide this before production.
- An API host never redirects. A browser does not follow a redirect for a CORS preflight.
  Each Gateway Worker gets the new host as a second custom domain, and the old host stays
  until the customers that call it move. Tenant records and published SDK configurations
  name the old Gateway hosts.

## How the code does it

- `formerWalletSiteOrigins` (Wallet targets), `formerPlatformOrigins` and
  `formerWalletConsoleOrigins` (Console targets) name the old hosts. `readHostRedirects`
  in `scripts/deployment-targets.mjs` maps each one to its successor.
- The Console Worker keeps its API routes on each old host (`buildConsoleRoutes`).
- `origins.formerGateways` keeps an old Gateway host as a second custom domain.
- The `wallet-site` deploy moves the host from the company project when needed, deploys
  the Worker `seams-host-redirects-<site>` (`deployment/host-redirects/worker.mjs`), and its
  smoke checks each redirect.
- A Pages host that a deploy binds for the first time also gets its DNS record, a proxied
  CNAME to the project.

## What does not break

- Passkeys. The RP IDs are `sign.seams.sh` and `staging.sign.seams.sh`
  (`VITE_RP_ID_BASE`), and those hosts stay.
- Wallet signing. Its hosts stay.

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

## Email

The owner decided on 2026-11-20: `info@purin.io` replaces both addresses.

- `sales@seams.sh` is the contact address of both sites and the recipient of the contact form
  (`docs/feat-5-contact-form-endpoint.md`).
- `confirm@seams.sh` is the From address of the Email OTP codes (both production Wallet lanes)
  and of the Console emails, such as invitations. Resend sends them.

Order:

1. Make `info@purin.io` receive mail, for example with Cloudflare Email Routing.
2. Verify `purin.io` in Resend (its SPF and DKIM DNS records). Check that `RESEND_API_KEY`
   can send from that domain.
3. Change the `fromAddress` values and the contact address. Then deploy.

If step 2 is not done, Email OTP codes and Console emails fail to send.

## Repository move: what remains

- Done: `main` has the repository move (`079aebc1`), so production tenant activation accepts
  the OIDC token of `purin-labs/monorepo`.
- Pantry CI checks out `seams-tech/seams-monorepo` (`.github/workflows/pantry.yml`). The
  GitHub redirect keeps it working. Change the name there in a Pantry change.
- Update any cloud agent environment that names the old repository.
