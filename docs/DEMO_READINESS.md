# Live Demo Readiness

## Demo scope

Business registration/login/recovery, automatic workspace onboarding, profile editing,
PDF/TXT ingestion, FAQ CRUD, customer business discovery, account-owned chat history,
grounded answers with sources, conversation review, and usage analytics.
Billing, human handoff, messaging integrations and OCR are outside this demo.
Scanned PDFs need OCR before upload.

## Setup gate

1. Use Node 22.12+ and the pinned pnpm version.
2. Confirm that the Supabase project is active and its Project URL resolves.
3. Configure the root .env using .env.example. Never commit credentials.
4. Apply migrations 001, 002, then 003 in Supabase SQL Editor. Existing projects
   that already have 001/002 must apply only the outstanding migration.
5. Keep the knowledge-base bucket private; its name must exactly match
   SUPABASE_STORAGE_BUCKET. The API uses its server-only service role key.
6. Keep embedding dimensions at 768. If switching embedding models, delete and
   re-upload existing demo documents so query and document vectors use the same model.
7. Configure Supabase auth redirect URLs for the frontend, including both reset-password routes.
   Email confirmation may remain disabled for a controlled test. Password recovery still needs email delivery.
8. Run pnpm verify:services. This reads configuration, table availability, bucket privacy,
   database API schema and Gemini model availability. It does not write customer data
   or prove that Gemini generation quota is available.

## Repeatable checks

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm audit
- pnpm exec playwright install chromium
- pnpm test:e2e

Browser tests use explicit mocked Supabase sessions and API responses. They exercise
real UI interactions on desktop/mobile, including upload, editing, delete confirmation,
chat failure/retry, history reload, overflow and axe accessibility checks.
They do not substitute for the live service walkthrough below.

## Live walkthrough in a dedicated staging project

1. Register a new business and confirm its name/address appear without entering them twice.
2. Reload the dashboard and confirm there is exactly one owner membership/workspace.
3. Upload docs/demo/harbor-books.txt and wait for ready.
4. Add FAQ: "Do you offer gift wrapping?" / "Gift wrapping costs PKR 150 per order."
5. Open a separate customer browser session and register/login.
6. Find the business, inspect its address and FAQs, then open support.
7. Ask "What is the return window?" Expected: 14 days, with a document source.
8. Ask "And what receipt do I need?" Expected: original receipt, using prior context.
9. Ask "How much is gift wrapping?" Expected: PKR 150, with an FAQ source.
10. Ask an unsupported question. Expect an honest insufficient-information response.
11. Refresh the portal; the saved conversation should reload.
12. Sign in as another customer and confirm the first customer's history is absent.
13. Return to the owner dashboard, refresh analytics and review the conversation.
14. Edit the FAQ and confirm new answers use the updated information.
15. Delete the document and confirm it is absent from storage and retrieval.

## Known boundaries

Verification on 2026-09-17: 33 backend/shared tests passed; six browser scenarios
passed across desktop and mobile, including light/dark axe checks and overflow checks.
The production build passed and pnpm audit reported no known vulnerabilities.
The configured Supabase hostname failed DNS lookup (ENOTFOUND); live database,
storage, migration and end-to-end Gemini answers could not be verified.
Configured Gemini models were accessible through the model-list API.

- Ingestion is synchronous, with per-provider-call timeouts. A durable job queue is
  still needed for large-scale production ingestion and crash recovery.
- API rate limits are per process. Multi-instance hosting needs a shared limiter.
- The current UI uses the first workspace. Setup is serialized/idempotent per account.
- FAQs use bounded lexical selection in addition to semantic document retrieval.
- Existing anonymous conversations are visible to owners but are not reassigned to customer accounts.
- Uptime, concurrent load, email deliverability and external quotas require staging verification.
- Legal templates need review before public launch.
- Never claim a live demo is fully verified until the staging walkthrough passes.
