# M365 Tenant Reporter

Open-source Microsoft 365 tenant reporting for GitHub Pages with a zero-storage browser model.

Production site:

- `https://m365report.cengizyilmaz.net`
- `https://m365report.cengizyilmaz.net/login`

## What it does

- Signs in with Microsoft Entra using authorization code flow with PKCE
- Collects Microsoft Graph data directly in the browser
- Builds overview, users, licenses, groups, mailbox purpose, SharePoint inventory, and security reports
- Exports `XLSX`, `CSV`, `JSON`, and `HTML` files locally
- Keeps tenant report data in memory only for the active browser session

## Privacy model

- Microsoft Graph data is fetched from the browser after delegated sign-in
- Tenant report rows are not stored on a server, in GitHub Pages artifacts, or in repository history
- Only MSAL session state is kept in `sessionStorage`
- Refresh, logout, tab close, or the `Clear session data` action removes the in-memory snapshot

## Architecture

- `src/site`: main product-site content, partials, and landing-page composition
- `src/login`: dedicated login-section page composition
- `src/legal`: dedicated legal and information pages such as About and Privacy
- `src/pages`: thin Astro route wrappers and authenticated app routes
- `src/features/auth`: runtime config bootstrap, MSAL wiring, sign-in flow
- `src/features/reporting`: Graph collection and normalization
- `src/features/exports`: browser-only file generation
- `src/components`: shared UI primitives for the public site and the app
- `src/lib`: typed config, Graph helpers, shared models, and utilities
- `src/content/blog`: Astro content collection for the `/blog` section
- `shared`: shared site config and brand styling used by the Astro application

## Centralized navigation and external network links

The primary site configuration is managed from:

- `shared/site.config.json`

Astro consumes that shared config through `src/lib/site.ts`.

The shared config drives:

- internal product navigation
- cross-site buttons for `cengizyilmaz.net`, `message.cengizyilmaz.net`, `permissions.cengizyilmaz.net`, and `tenant-find.cengizyilmaz.net`
- social links for X, Facebook, Reddit, GitHub, YouTube, and LinkedIn

## Blog

The product now includes an SEO-focused blog at:

- `https://m365report.cengizyilmaz.net/blog`

The blog is implemented directly in Astro with:

- content collections under `src/content/blog`
- route files under `src/pages/blog`
- shared site chrome through the main Astro layout
- the same sitemap generation as the rest of the site

Initial blog coverage includes:

- tenant connection and consent
- total users
- licensed users
- unlicensed users
- shared mailboxes
- group member counts
- license availability
- export options
- privacy and permission guidance

## Stack

- Astro
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- TanStack Table
- MSAL Browser
- Recharts
- SheetJS
- Vitest
- Playwright

## Microsoft Graph coverage

- `/users`
- `/subscribedSkus`
- `/groups`
- `/groups/{id}/members/$count`
- `/groups/{id}/owners`
- `/groups/{id}/drive`
- `/users/{id}/mailboxSettings?$select=userPurpose`
- `/users/{id}/manager`
- `/reports/getOffice365ActiveUserDetail`
- `/reports/getTeamsUserActivityUserDetail`
- `/reports/getMailboxUsageDetail`
- `/reports/getOneDriveUsageAccountDetail`

## Delegated permissions

Core:

- `openid`
- `profile`
- `email`
- `User.Read`
- `User.Read.All`
- `GroupMember.Read.All`
- `LicenseAssignment.Read.All`
- `MailboxSettings.Read`
- `RoleManagement.Read.All`

Optional SharePoint inventory:

- `Sites.Read.All`

Reports:

- `Reports.Read.All`

Optional advanced audit:

- `AuditLog.Read.All`

`RoleManagement.Read.All` enables admin role inventory for the security section. `Sites.Read.All` enables the browser-safe SharePoint library inventory. `Reports.Read.All` still requires a supported Microsoft Entra role such as Reports Reader or a broader admin role. `AuditLog.Read.All` is used for last sign-in summaries and MFA registration reporting.

## Known Graph caveats

- Group member counts are direct-only by design
- Microsoft documents a v1.0 caveat for service principal members when listing group members
- `mailboxSettings.userPurpose` can be unavailable for accounts without Exchange-backed mailbox data
- Mailbox forwarding state is not exposed through `mailboxSettings`
- Browser-safe mailbox quota data is not available because Microsoft Graph returns mailbox usage detail through redirected CSV downloads
- Tenant-wide OneDrive drive enumeration is intentionally disabled in browser mode because delegated drive calls can auto-provision missing drives
- Last sign-in summaries depend on both `AuditLog.Read.All` and tenant licensing that exposes sign-in activity

## Local development

### Prerequisites

- Node.js `>= 22.13.0`
- npm `>= 10`
### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

`npm run dev` starts the full Astro site, including `/blog`.

### Quality checks

```bash
npm run validate:config
npm run lint
npm run typecheck
npm run test
npm run build
```

### Playwright smoke tests

`npm run test:e2e` builds the Astro site first, then serves the final `dist` folder for browser smoke tests.

## Runtime configuration

The app reads `public/runtime-config.json` at runtime. A placeholder file is committed for development and open-source distribution. Real deployments should replace it during CI.

Available public config values:

- `PUBLIC_APP_NAME`
- `PUBLIC_SITE_URL`
- `PUBLIC_BASE_PATH`
- `PUBLIC_AUTHORITY`
- `PUBLIC_CLIENT_ID`
- `PUBLIC_KNOWN_AUTHORITIES`
- `PUBLIC_LOGIN_REDIRECT_PATH`
- `PUBLIC_POST_LOGOUT_REDIRECT_PATH`
- `PUBLIC_CORE_SCOPES`
- `PUBLIC_REPORTS_SCOPES`
- `PUBLIC_ADVANCED_AUDIT_SCOPES`
- `PUBLIC_SITES_SCOPES`
- `PUBLIC_ALLOW_AUDIT_OPT_IN`

Example materialization:

```bash
PUBLIC_SITE_URL=https://m365report.cengizyilmaz.net \
PUBLIC_BASE_PATH=/ \
PUBLIC_CLIENT_ID=00000000-0000-0000-0000-000000000000 \
npm run config:materialize
```

## GitHub Pages deployment

The repository includes:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/codeql.yml`

`deploy-pages.yml` materializes `runtime-config.json` from GitHub repository variables, validates the resolved config, builds the Astro site into `dist`, and deploys the final artifact to GitHub Pages.

The workflow uses `actions/configure-pages@v5` with `enablement: true` so the first deployment can create the Pages site automatically when the repository has not been enabled yet.

For the custom domain, configure `m365report.cengizyilmaz.net` in the repository Pages settings. When Pages is deployed through GitHub Actions, relying on repository-side `CNAME` files is not the durable source of truth.

Recommended repository variables:

- `PUBLIC_CLIENT_ID`
- `PUBLIC_AUTHORITY`
- `PUBLIC_SITE_URL`
- `PUBLIC_BASE_PATH`
- `PUBLIC_APP_NAME`
- `PUBLIC_LOGIN_REDIRECT_PATH`
- `PUBLIC_POST_LOGOUT_REDIRECT_PATH`
- `PUBLIC_CORE_SCOPES`
- `PUBLIC_REPORTS_SCOPES`
- `PUBLIC_ADVANCED_AUDIT_SCOPES`
- `PUBLIC_SITES_SCOPES`
- `PUBLIC_ALLOW_AUDIT_OPT_IN`

## Security posture

- No fake tenant data is committed in the source tree
- No build-time tenant collection exists
- No server-side secret is required for runtime Graph access
- All client-side comments are written in English for broader maintainability

## License

MIT
