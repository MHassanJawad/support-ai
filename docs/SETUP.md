# Local Setup

Install Node 22.12+ and enable Corepack. From the repository root:

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Do not overwrite an existing configured .env. Fill credentials locally, then follow
the Supabase migration, bucket and redirect steps in [DEMO_READINESS.md](DEMO_READINESS.md).

```powershell
corepack pnpm verify:services
corepack pnpm dev
```

Web: http://localhost:3000. API: http://localhost:4000.
If a port is already occupied, stop your previous dev terminal with Ctrl+C.
Changing the API port also requires updating NEXT_PUBLIC_API_URL. Changing the
frontend port requires updating API_ALLOWED_ORIGINS and auth redirect URLs.

Run the verification commands in [TESTING.md](TESTING.md) before presenting.
