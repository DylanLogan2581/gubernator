---
name: verification-workflow
description: "Use for Gubernator verification: Vitest, pgTAP DB tests, Supabase local reset, coverage, lint, build, route generation, Edge Function tests, release workflow, PR workflow, and final verification decisions."
---

# Verification Workflow

## Setup

- Node 22 from `.nvmrc`.
- `.env` comes from `.env.example`. Fill Supabase vars from `supabase status`.
- Dev server: `npm run dev`
- Local Supabase: `npx supabase start`, then `npx supabase db reset`.

## Commands

- `npm run test`: Vitest unit/integration in repo.
- `npm run test:coverage`: Vitest + sim coverage thresholds.
- `npm run test:integration`: end-turn Edge Function integration; needs local Supabase.
- `npm run test:db`: pgTAP SQL tests; needs local Supabase started/reset.
- `npm run lint`: ESLint + Markdown + SQL Prettier check.
- `npm run build`: `tsc -b && tsc -p tsconfig.edge-functions.json && vite build`.
- `npm run db:types`: regenerate `src/types/database.ts` after schema changes.
- `npm run functions:cache-clear`: clear Edge runtime cache after shared Edge code changes.

## Test Choice

- Schema/util/query helper change -> focused Vitest file.
- Component/form change -> RTL test if behavior changes.
- Route guard/search param change -> route test.
- Mutation error mapping -> mutation test with fake client.
- Public feature export change -> update `src/test/public-feature-entrypoints.test.ts`.
- Browser secret boundary change -> keep `src/test/no-service-role-in-browser.test.ts` passing.
- Migration/RLS/RPC change -> pgTAP test in `supabase/tests`.
- Edge Function branch -> function unit test; integration if Supabase contract changes.
- Simulation phase change -> phase test + cross-phase/determinism test when state flow changes.

## Coverage Gate

`src/shared/simulation/**` thresholds in `vitest.config.ts`:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | >= 90%    |
| Branches   | >= 85%    |
| Functions  | >= 90%    |
| Lines      | >= 90%    |

Run `npm run test:coverage` to check thresholds locally.

## Finish Matrix

- Docs/skill-only change: `npm run lint:md` enough, then security review.
- TS app change: focused tests + `npm run lint:eslint`; build if types/routes/bundle touched.
- Route change: run focused route test + `npm run build` to refresh/check route tree.
- Shared/Edge change: focused tests + `npm run build`; run `functions:cache-clear` when local runtime matters.
- Schema/RLS/RPC change: `npx supabase db reset` + `npm run test:db` when practical.
- Simulation change: focused sim tests + `npm run test:coverage`.
- Release/tooling change: dry run relevant script when practical.

## CI

- CI jobs: `Lint`, `Build`, `Test`, `Database`.
- Database job starts Supabase, resets DB, runs `npm run test:db`.
- Test job runs `npm run test` + `npm run test:coverage`.
- Build job runs `npm run build`.

## Workflow Rules

- short descriptive branches
- PRs instead of direct pushes to `main`
- conventional commits and PR titles
- required `Lint` and `Build` checks
- CODEOWNERS review
- commit scope must match `commitlint.config.ts`

## Release

- `npm run release:dry`: preview release output
- `npm run release`: update version and changelog, create release commit and tag, and push
- pushed `v*` tags trigger `.github/workflows/tag-release.yml` to publish GitHub Release

Do not implement per-commit version bumps or per-commit tagging automation unless explicitly requested.

## Handoff

- State commands run + pass/fail.
- If skipped, say why.
- Mention generated files touched, especially `src/routeTree.gen.ts` or `src/types/database.ts`.
- Mention security review result.
