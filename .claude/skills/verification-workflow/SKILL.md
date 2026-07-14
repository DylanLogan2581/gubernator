---
name: verification-workflow
description: >-
  Which checks to run locally before declaring work done: test, build, lint,
  coverage, deno, db tests, release. Trigger when finishing a change, deciding
  what to verify, or before commit/PR. (Red CI → ci-triage; writing tests →
  test-hygiene.)
---

# Verification Workflow

There is NO aggregate `verify` script. Mirror CI manually — required PR checks are Lint, Build, Test, Database, Validate PR Title.

## Check → Command

| Check                                       | Command                                                                                                                                             | Needs Supabase? |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Typecheck + bundle + secret scan            | `npm run build` (= `tsc -b` + `tsc -p tsconfig.edge-functions.json` + vite build)                                                                   | no              |
| Unit tests                                  | `npm run test`                                                                                                                                      | no              |
| Coverage thresholds                         | `npm run test:coverage`                                                                                                                             | no              |
| Lint (eslint + markdownlint + sql prettier) | `npm run lint`                                                                                                                                      | no              |
| Edge functions                              | `deno check $(find supabase/functions -name '*.ts' ! -name '*.test.ts')` + `deno lint supabase/functions/` + `deno fmt --check supabase/functions/` | no              |
| DB tests (pgTAP)                            | `npx supabase db reset && npm run test:db`                                                                                                          | yes             |
| Integration tests                           | `npm run test:integration`                                                                                                                          | yes             |
| E2E                                         | `npm run test:e2e`                                                                                                                                  | yes + seeded    |

## What to Run by Change Type

- **UI / components / routes**: build + affected tests + **browser verification with dev-browser (mandatory per CLAUDE.md — screenshot, interact, console, mobile width)**. Coverage before PR.
- **Feature logic**: build, `test:coverage`, lint.
- **`src/shared/**`**: same, plus deno check if edge functions import it. Coverage on `src/shared/simulation/\*\*` is 90/85/90/90 — trips easily.
- **Migration / schema**: full `supabase db reset` + `test:db` + `test:integration`; typegen (`npm run db:types`) decision. See schema-change skill.
- **Edge functions**: `tsc -p tsconfig.edge-functions.json` + Deno trio. Do NOT run prettier/eslint on `supabase/functions/` — deno fmt owns it (100-col; the dir is prettier- and eslint-ignored).
- **Docs only**: `npm run lint:md`.

## Traps (pass locally, fail CI)

- `npm run test` does NOT check coverage thresholds — only `test:coverage` does. Repo floor 60/53/58/60; `src/shared/simulation/**` 90s; `supabase/functions/_shared/simulation/**` 77/62/73/82.
- `**/integration.test.ts` is excluded from default vitest — broken integration tests only surface in CI Database (or with `VITEST_INTEGRATION=true`).
- Pre-commit is targeted (lint-staged, incremental `tsc -b`, `vitest --changed`, staged-only pgTAP). A migration can commit clean and fail CI — full pgTAP only runs on pre-push (when `supabase/(migrations|tests)` changed vs origin/main) and in CI.
- CI Database starts from a clean DB; a stale local DB hides failures. Always `db reset` before db/integration tests.
- CI Build greps `dist/assets/` for `SUPABASE_SERVICE_ROLE_KEY` — any server secret reaching the client bundle fails Build.
- `tsc -b` is incremental; stale `.tsbuildinfo` can mask errors CI's clean build catches.
- Hooks take minutes — background commits and poll `git log -1 --oneline`.

## Release

`npm run release` (semantic-release wrapper) asserts you are on `main` — throws elsewhere. `release:dry` for preview. Versioning driven by conventional commit history; PR titles validated separately (`type(scope): subject`, ≤72 chars, lowercase, scope allowlist — see open-pr skill).
