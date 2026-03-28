# Contributing

## Development expectations

- Keep code comments in English
- Prefer explicit types and clear naming over comment-heavy code
- Do not introduce persistent storage for tenant report data
- Keep public pages SEO-safe and authenticated pages `noindex`
- Preserve the runtime-config pattern instead of hardcoding tenant-specific values

## Local workflow

```bash
npm install
npm run validate:config
npm run lint
npm run typecheck
npm run test
npm run build
```

Install Playwright browsers before running end-to-end tests:

```bash
npx playwright install chromium
npm run test:e2e
```

## Pull requests

- Explain the user-facing change
- Mention any Microsoft Graph permission impact
- Mention zero-storage or privacy implications when relevant
- Include screenshots for UI changes when possible

## Scope guardrails

- Do not add static fake tenant datasets
- Do not add server-side storage for report exports
- Do not add remediation or write-back Microsoft 365 features to this project without a deliberate product decision
