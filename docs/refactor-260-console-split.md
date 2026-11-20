# Refactor 260 — Split the Seams Console into its own repository

Status: plan, written on 2026-11-20. No path has been cut. `seams-tech/seams-console`
(private) holds an unchanged copy of this repository: `dev` at `83023b1e` and `main` at
`079aebc1`, pushed on 2026-11-20 with the same commit IDs.

## Decision

The owner decided on 2026-11-20:

- The Seams Wallet and its Console are one separate product. The Console lives on
  `console.seams.sh`.
- The Console code moves out of `purin-labs/monorepo` into the `seams-tech` GitHub
  organisation.
- Pantry and the Seams Wallet stop sharing organisation accounts. Before, one "shared
  account platform" in the Console held the organisations, teams and billing of both
  products (`docs/shared-account-platform/`).
- Two repositories (owner, 2026-11-20, in the separation session):
  `seams-tech/seams-console` holds the Wallet Console and the Wallet site.
  `purin-labs/purin-monorepo` holds the company site and, later, other Purin consoles and
  deployments. It is this repository after a rename.
- The split copies the whole repository into `seams-tech/seams-console`. It does not start
  from an empty repository.

Each fact below was read from the code on `dev` at `66e51b4c`, and from Pantry `main`.

## What blocks a clean split

1. **The company site imports Wallet app source.**
   `apps/seams-site/src/components/h2/WalletFigure.tsx` (lines 5 to 11) imports seven files
   from `apps/wallet-console` by relative path: the figure catalog, five showcase pages and
   `hairline/embed.js`. `sections.tsx` uses the figure, and the home, ecommerce, company
   and not-found pages import `sections.tsx`.
2. **The company site deploys through Wallet files.** Its target (`origin`,
   `pagesProjectEnv`) is in `deployment/wallet-system/targets.json`, and its deploy code is
   the `company` branch of `scripts/deploy-surface.mjs`. The `company` build path also
   requires Wallet lane values (`buildFrontendEnvironment`).
3. **Pantry cannot run without the Console today.** Pantry's Worker `satyr-edge` has a
   Cloudflare service binding `ACCOUNT_PLATFORM` to the Console Worker, entrypoint
   `SatyrAccountPlatform` (`pantry/services/platform/wrangler.jsonc`). About 60 Pantry
   files check eligibility through it. Without the binding, Pantry access fails closed.
4. **A service binding cannot cross Cloudflare accounts.** Refactor 200 moves the Console
   to the `seamsadmin` account. Pantry's binding then still names the Console Worker in the
   old account. The public Console `fetch` returns 404 for `/account-platform/*`
   (`d1ConsoleStagingWorker.ts`, line 928), so no HTTPS path exists. Refactor 200 said that
   Pantry "calls the Seams account authority over HTTPS"; that statement is wrong.

## Inventory

### Moves to `seams-tech/seams-console`

| Path                                                                                              | Content                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/wallet-console`                                                                             | Wallet site, Wallet Console and Platform Console builds (368 files)                                                                                                                                                                 |
| `packages/console-server-ts`                                                                      | Console services (181 files)                                                                                                                                                                                                        |
| `packages/wallet-console-server-ts`                                                               | Console and Wallet runtime Workers, D1 migrations, scripts (398)                                                                                                                                                                    |
| `packages/console-shared-ts`, `packages/wallet-console-shared-ts`                                 | Shared types                                                                                                                                                                                                                        |
| `deployment/console`, `deployment/wallet-system`, `deployment/celld`, `deployment/host-redirects` | Targets, key scripts, runtime evidence                                                                                                                                                                                              |
| `scripts/` Wallet and Console files                                                               | `deploy-backend`, `deploy-surface`, `deployment-targets`, `deployment-smoke`, `console-deployment-environment`, `dispatch-deployment-workflow`, `tenant-*`, `migration-fingerprint`, `prepare-wallet-docs-source`, `local-wallet/*` |
| `.github/workflows/`                                                                              | All `deploy-*`, `release-seams-cli`, `sign-recovery-trust`, and the Wallet part of `validate-repository`                                                                                                                            |
| `tests/`                                                                                          | All suites except the few that read only the company site                                                                                                                                                                           |
| `voiceId/`, most of `docs/` (about 150 of 164 files)                                              | Wallet research, plans and evidence                                                                                                                                                                                                 |
| `AGENTS.md`                                                                                       | Custody vocabulary, testing policy, commands                                                                                                                                                                                        |

### Stays in `purin-labs/monorepo`

- `apps/seams-site`, the company site (357 files).
- `packages/site-navbar-ts` and `packages/grain-field-ts`. Both apps use them, so each
  repository gets a copy. Pantry already copied the grain field
  (`pantry/apps/portal/src/ui/README.md`).
- `docs/drawing-style.md`, `docs/styles/`, and a short `AGENTS.md` for the site.
- A small deploy script and one workflow for the company site only.

### Deleted, not moved

- The Wallet demo in the company site: `apps/seams-site/src/flows/demo/*` (26 files),
  `DemoPasskeyColumn` and `context/frontendRuntime.tsx`. Only `H2DemoHero` loads them, and
  nothing references `H2DemoHero`. Confirm at run time, then delete. `src/config.ts` and
  the `@seams/voiceid` import go with them.
- `packages/wasm` (a symlink to a path that does not exist), the empty `packages/wallet/`
  and the stale `packages/README.md`.
- The Platform Console build, after the account split (see "End state").

## End state

### Hosts

| Surface                  | Now, after Refactor 200          | End state                               |
| ------------------------ | -------------------------------- | --------------------------------------- |
| Wallet site              | `seams.sh`                       | `seams.sh`                              |
| Console frontend         | `console.seams.sh`               | `console.seams.sh`                      |
| Console API              | `seams.sh/console/*`             | `console.seams.sh/console/*` (proposal) |
| Platform Console         | `account.seams.sh` (temporary)   | none                                    |
| `/account-platform/v1/*` | route on `seams.sh`, answers 404 | none                                    |
| Testnet Console backend  | `test.console.seams.sh`          | open question 4                         |

Moving the Console API to `console.seams.sh` changes these values, all rendered in
`packages/wallet-console-server-ts/scripts/render-d1-gateway-config.mjs`:

- `CONSOLE_SESSION_ISSUER` (`${consoleOrigin}/console`). Each Console user signs in again.
- `CONSOLE_STEP_UP_RP_ID`. Today it is the Wallet site host, `seams.sh`, and it works from
  `console.seams.sh` because that is a subdomain. Keep `seams.sh` as the RP ID, so the
  step-up passkeys stay valid.
- `CONSOLE_CORS_ORIGINS`, and the OAuth callback of Google, GitHub and Apple
  (`https://console.seams.sh/dashboard/login`; `assertGithubCallback` in
  `scripts/console-deployment-environment.mjs` checks it against `siteOrigin`).
- The Wallet site calls the Console for the pricing sign-in dialog
  (`embeddedSignIn.ts`), so it becomes a cross-origin caller.
- Old paths redirect through the former-host mechanism of Refactor 200
  (`formerWalletSiteOrigins`, `readHostRedirects`, `deployment/host-redirects/worker.mjs`).
  A path on the same host, `seams.sh/console/*`, needs a plain route to the Console Worker
  for a transition time, because the Wallet CLI names the Console URL.

### Accounts and billing

The Console keeps its own organisations, members, invitations and billing for the Wallet.
It drops the Pantry service:

- The `'satyr'` service in the catalog, `satyr_service_bindings`, the Satyr meters
  (`satyr.completed_turn.test`, `satyr.jev_input_tokens`), the route
  `POST /console/billing/satyr-paid-use/postpaid`, `satyrProvisioning*`, `satyrRelease`,
  the `SatyrAccountPlatform` entrypoint, and the `PANTRY_*`, `SATYR_*` and
  `ACCOUNT_PROVISION_*` values.
- The Pantry labels in the dashboard (`serviceProjects.ts`, `ServiceProjectsSection.tsx`,
  `consoleBillingApi.ts`).
- The shared-account tests that test Pantry (`satyr-*.e2e.test.ts`, the published
  `.artifacts/shared-account-platform` Worker in `validate-repository.yml`).

The Console side is easy to cut: `readConsoleServiceEnvironment` already treats the Pantry
connection as optional, and the ingress answers 503 without it.

Pantry must own what the Console gave it:

- Organisation creation and onboarding, memberships and invitations (Pantry has
  `organisation`, `person`, `service_role_grant` and `project_member`, but no invitation
  table).
- Eligibility for each protected request.
- Plans, the Stripe customer, credit, reservations and usage (Pantry has no plan or
  subscription tables).

Pantry signs users in itself already (Google OIDC in `control/oidc.ts`). That work is a
Pantry plan in the Pantry repository. Existing records are test data (Refactor 200), so no
account data moves.

## Order

1. **Refactor 200 first.** Finish the move to the `seamsadmin` Cloudflare account. Do not
   split the repository during the cutover: the deploy workflows and the GitHub
   environments must stay in one place until every lane runs in `seamsadmin`.
2. **Keep Pantry's authority alive in the old account.** After the cutover, Pantry's
   binding still reaches the old Console Worker (`seams-sdk-d1-console`,
   `seams-sdk-d1-console-staging`) and its old D1 database. Do not retire those two Workers
   and their databases in Refactor 200, Phase 7, until Pantry has its own accounts. The two
   products then already have separate account data.
3. **Pantry builds its own accounts** (Pantry plan). Then it removes the `ACCOUNT_PLATFORM`
   binding, and the old Console Workers and databases retire.
4. **Cut the couplings in this repository** (small changes on `dev`):
   - Copy the seven files that `WalletFigure.tsx` imports into `apps/seams-site`.
   - Delete the dead Wallet demo from the company site.
   - Give the company site its own target file and deploy script.
5. **Remove the Pantry service from the Console** (the list in "Accounts and billing").
   Remove the Platform Console build and the `account.*` hosts. Move the Console API to
   `console.seams.sh`.
6. **Move the deploys.** `seams-tech/seams-console` already mirrors this repository;
   until this step, a fast-forward push keeps it equal. Set up its GitHub environments, and
   deploy staging from it. Then stop the mirror: each repository deletes the paths that
   belong to the other one, in an ordinary commit.
7. **Change the GitHub OIDC identity.** `automationRoute.ts` accepts tokens only from
   `purin-labs/monorepo` (`DEPLOYMENT_REPOSITORY`, `DEPLOYMENT_SUBJECT_PREFIX`, and three
   workflow file names). The first deploy from the new repository must carry the new
   values, and it deploys the Console before it activates, as today.
8. **Delete the moved paths from `purin-labs/monorepo`** after production runs from the new
   repository.
9. **Rename `purin-labs/monorepo` to `purin-labs/purin-monorepo`** last. A rename changes
   the OIDC `repository` claim and subject that `automationRoute.ts` pins, so it must come
   after the Seams deploys run from `seams-tech/seams-console`.

## Repository mechanics

- **History.** The mirror keeps every commit ID that the docs, the evidence files and the
  agent memory cite. `git filter-repo` would rewrite all of them. So each side cuts by
  deleting paths in a commit, not by rewriting history.
- **OIDC identity of the new repository.** Owner `seams-tech` has ID 282445520, and
  `seams-console` has ID 1465065004. With immutable subjects on, the prefix is
  `repo:seams-tech@282445520/seams-console@1465065004`; read it from the GitHub API before
  you write it into `automationRoute.ts`.
- **Package names.** Keep the `@seams-internal/*` scope (six names, about 740 uses).
- **Dependencies.** The Console consumes `@seams/wallet-server`, `@seams/wallet` and
  `@seams/voiceid` from npm by exact version, as today. Three relayer tests read
  `../seams-wallet`; the new checkout sits beside `seams-wallet` so the path still works.
- **GitHub environments.** Secrets cannot be copied between repositories. Create the 26
  environments again in `seams-tech/seams-console` with the existing commands
  (`wallet-system:deploy:env-apply`, `console:deploy:env-apply`, the `env-update` commands)
  from the manifests and values files in `~/.seams`. Six secrets have no local copy
  (three production `ROUTER_AB_*_AUTH_SECRET` values, `SEAMS_GITHUB_OAUTH_CLIENT_SECRET`,
  two `SPEAK_TO_SIGN_*` keys): recover or reissue them first.
- **Workflows.** `release-seams-cli.yml` and `sign-recovery-trust.yml` use the protected
  `release-signing` and `recovery-signing` environments. `seams-wallet` names the
  repository that holds them (`crates/seams-cli/trust/README.md`).
- **Other repositories.** Pantry CI checks out this repository to build the account
  Worker (`pantry/.github/workflows/pantry.yml`, lines 61 to 75). That step goes away with
  step 3.

## What Refactor 200 should not build

- No HTTPS account API for Pantry.
- No more work on the Platform Console or the `account.*` hosts than the migration needs.
- No rename of the `PANTRY_*` values, and no new Pantry meters.

## Open questions

1. **Visibility of `seams-console`.** Both organisations are on GitHub Free (`plan.name`
   from `gh api orgs/<org>`, read on 2026-11-20). The
   [environments page](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
   says: "Users with GitHub Free plans can only configure environments for public
   repositories." GitHub Team gives them to private repositories. Private Actions on Free
   has a $12 monthly allowance (about 2,000 Linux minutes); public repositories run free.
   The deploys need 26 environments, so the owner must choose: make `seams-console` public,
   like this repository, or move `seams-tech` to GitHub Team.
2. Decided: the Wallet site moves with the Console (`apps/wallet-console` builds both).
3. **Console API host.** Recommendation: `console.seams.sh/console/*`, with the RP ID kept
   at `seams.sh`.
4. **Testnet Console.** `test.console.seams.sh` is a separate Console Worker and database
   for the production testnet lane. Recommendation: keep it until the split is done, then
   decide whether one Console serves both networks.
5. **Pantry's interim authority.** Recommendation: Pantry keeps the old Console Workers in
   the old Cloudflare account until its own accounts exist (order step 2). The alternative
   is to build Pantry's accounts before the Refactor 200 cutover, which delays the cutover.
