# Testing

Install dependencies and run all suites:

```bash
pnpm install
pnpm test
```

Recommended checks before handoff:

```bash
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm audit
```

The HTTP/service regression tests mock Supabase and Gemini; they never mutate a live project.
They cover authentication, member permissions, upload lifecycle, malformed requests,
retrieval context, FAQ grounding, provider failure and paired message persistence.

Run `pnpm build`, then `pnpm exec playwright install chromium` and `pnpm test:e2e`.
Browser tests start the built production frontend on port 3000. On Windows, an
installed Edge can be used with `$env:PLAYWRIGHT_CHANNEL = 'msedge'` in PowerShell.
These use mocked remote responses and run desktop/mobile workflows with axe accessibility
and horizontal overflow checks. Screenshots and failure traces go into test-results.

Live integration acceptance requires a dedicated staging Supabase project and the
walkthrough in [DEMO_READINESS.md](DEMO_READINESS.md). Do not run destructive
integration fixtures against production data. Coverage is measured, not yet an 80%
repository-wide release guarantee.
