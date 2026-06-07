---
name: verification-workflow
description: Use for tests, Vitest, coverage, lint, build, route generation, release workflow, PR workflow, or final verification decisions.
---

# Verification Workflow

## Setup

- Node 22 in `.nvmrc`
- `.env` comes from `.env.example`. Fill Supabase vars from `supabase status`.
- Dev server: `npm run dev`

## Testing

- Use Vitest for unit and integration tests.
- Add tests for new behavior, bug fixes, and non-trivial refactors when practical.
- Shared test helpers belong in `src/test`.
- Prefer fast unit tests for schemas, query helpers, and pure transformations.
- If change is hard to test automatically, say so in handoff.
- `npm run test:integration` requires local Supabase.
- `npm run test:db` requires `npx supabase start && npx supabase db reset` first.

## Coverage

`src/shared/simulation/**` thresholds in `vitest.config.ts`:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | >= 90%    |
| Branches   | >= 85%    |
| Functions  | >= 90%    |
| Lines      | >= 90%    |

Run `npm run test:coverage` to check thresholds locally.

## Workflow

- short descriptive branches
- PRs instead of direct pushes to `main`
- conventional commits and PR titles
- required `Lint` and `Build` checks
- CODEOWNERS review

## Release

- `npm run release:dry`: preview release output
- `npm run release`: update version and changelog, create release commit and tag, and push
- pushed `v*` tags trigger `.github/workflows/tag-release.yml` to publish GitHub Release

Do not implement per-commit version bumps or per-commit tagging automation unless explicitly requested.

## Finish

- Run `npm run lint` when practical.
- Run `npm run build` when changes affect routing, typing, or bundling.
- `npm run build` runs `tsc -b && tsc -p tsconfig.edge-functions.json && vite build`. Do not swap in `tsc --noEmit`; it misses cross-project type errors.
- Run Vitest for affected area when tests exist.
- If routes changed, make sure generated routing output is current.
- If schema changed, confirm migration exists and was updated appropriately.
- If schema changed, confirm RLS and policies were added or updated.
- If auth, permission helpers, RLS, seeded access, or schema changed, run `npm run test:db` when practical.
- CI database job runs `npm run test:db`; regressions in `apply_turn_transition` and related RPCs fail there.
- Confirm security review happened.
