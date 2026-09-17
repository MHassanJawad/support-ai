# Deployment

## Frontend

Deploy `apps/web` to Vercel. Configure:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## API

Deploy `apps/api` to Render as a Node service. Configure all API variables from `.env.example`.

## Supabase

1. Create a Supabase project.
2. Run all outstanding files in `db/migrations` in numeric order (001, 002, 003).
3. Create storage bucket `knowledge-base`.
4. Copy project URL, anon key, and service role key into deployment secrets.

## Smoke Test

Run `pnpm verify:services`, then the staging walkthrough in [DEMO_READINESS.md](DEMO_READINESS.md).
Use Node 22.12+ for both builds and the API runtime.
