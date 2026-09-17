# Changelog

All notable changes to SupportAI will be documented here.

## [Unreleased]

### Added

- Atomic, idempotent business onboarding and profile editing.
- Customer-owned conversation history and mobile FAQ access.
- FAQ editing/deletion, document deletion, daily usage and owner conversation review.
- Desktop/mobile browser and accessibility tests, backend regression tests,
  read-only service preflight and a documented staging demo walkthrough.

### Fixed

- FAQ grounding, follow-up context, chunk overlap and embedding dimension validation.
- Ingestion status reporting, failed chunk cleanup and checked storage deletion.
- Dashboard navigation, drag-and-drop uploads, visible feedback and error recovery.
- Customer conversation authorization and owner/admin write permissions.
- Text contrast, responsive layouts, broken landing link and .env parsing.
- Vulnerable dependencies, including updating Next.js to 15.5.24.

### Migration

- Apply 003_demo_readiness.sql after existing migrations before testing live onboarding.

## [0.1.0] - 2026-05-29

### Added

- Initial production MVP monorepo scaffold.
- Express API with Supabase-authenticated tenant routes.
- Next.js dashboard and chat UI skeleton.
- Supabase pgvector migration and SDLC documentation.
