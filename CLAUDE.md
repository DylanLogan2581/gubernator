# AGENTS.md

Do not read `README.md` or `CONTRIBUTING.md` unless task asks.

## Voice

- Use `caveman` skill at `ultra` level for assistant replies in this repo.
- Keep code, command output, commits, PR text, destructive warnings, and security warnings normal.
- Disable caveman only when user says `normal mode` or `stop caveman`, or when clarity needs it.

## Golden Rules

1. Ask, don't assume. If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements. When running unattended, pick the most reasonable interpretation, proceed, and record the assumption rather than blocking.
2. Implement the simplest solution for simple problems, better solutions for harder problems. Do not over-engineer or add flexibility that isn't needed yet.
3. Don't touch unrelated code but do surface bad code or design smells you discover so they can be addressed as a separate issue.
4. Flag uncertainty explicitly. If unsure about something, see rule 1. If it makes sense, conduct a small, localised, low-risk experiment and bring the hypothesis and results to discuss. Confidence without certainty causes more damage than admitting a gap.
5. Suggestions for better ways of doing things are welcome, especially ones with long-lasting impact over a tactical change.

## Rules

- Keep route files thin. Compose page modules instead of growing route files.
- Prefer small focused modules over mixed-responsibility files.
- Use TypeScript in app code.
- Use `@/` for cross-layer imports from `src`. Within a feature, local relative imports are fine.
- Prefer named exports.
- Reuse existing UI primitives and helpers before adding abstractions.
- Do not manually edit generated files such as `src/routeTree.gen.ts`.
- Do not import feature internals across features. Use `@/features/<feature>` entrypoints.
- Do not call Supabase from routes or components. Use feature query/mutation modules.
- Do not expose service-role keys or third-party secrets to browser code.
- Review every change for security impact before finish.

## UI Verification (required)

Any change that affects UI (components, styles, layout, routing, data displayed) is not complete until verified in the browser with the `dev-browser` skill. Never report UI work as done based only on code compiling or type-checking.

After making UI changes:

1. Ensure the dev server is running: `npm run dev` (Vite, port 5173). Start it if needed.
2. Use `dev-browser` to open the affected page(s) at `http://localhost:5173`.
3. Take a screenshot and actually look at it. Check for: broken layout, overlapping/clipped elements, missing content, unstyled elements, placeholder text, obviously wrong spacing or alignment.
4. Interact with the new feature the way a user would — click buttons, fill forms, open modals, navigate flows. Verify each interaction produces the expected result.
5. Check the browser console for errors and warnings, and network requests for failures. Fix any that relate to the change.
6. Test at desktop and mobile viewport widths for layout changes.
7. Iterate: fix issues found, re-verify, repeat until a screenshot review passes. Only then report the work complete, and include a brief summary of what was verified.

Auth and styling notes:

- Local auth uses seeded test accounts (password `password123` for all; see `e2e/roles.ts`): `superadmin@gubernator.local`, `worldadmin@gubernator.local`, `other@gubernator.local` (nation manager), `test@gubernator.local` (settlement manager), `player@gubernator.local`. Sign in at `/sign-in`. Requires local Supabase running with seed data (`supabase db reset` if accounts are missing).
- Reuse existing components and design tokens from `src/components/ui` (shadcn/ui primitives), `src/components/app`, and `src/components/shared` instead of inventing new styles; match the visual patterns of existing pages.

## Truth

- `src/routes`
- `src/features`
- `src/components`
- `src/lib`
- `src/shared`
- `supabase/migrations`
- `supabase/functions`
- `supabase/tests`

Application tables must use Row Level Security.
Schema change must include migration, RLS/policy decision, DB test decision, and typegen decision.
Edge/shared changes must preserve explicit `.ts` imports and browser-vs-Deno boundaries.

## Skills

- `caveman`: use at `ultra` for repo replies. Repo skill lives at `.codex/skills/caveman/SKILL.md`.
- `project-structure-placement`: use for route/layout rules, placement, imports, naming, query/schema/type organization
- `frontend-ui-patterns`: use for React/Tailwind/shadcn/ui/Sonner/accessibility frontend work
- `supabase-edge-shared`: use for Supabase, RLS, auth, migrations, seeded access, `src/shared`, Edge Functions
- `simulation-turn-engine`: use for turn advancement, simulation phases, transition payloads, snapshots, logs, notifications, deterministic RNG, or end-turn Edge Function work
- `verification-workflow`: use for test/build/lint/release/finish-check decisions
- `epic-workflow`: use for epic/milestone status, epic branches, epic PR conventions
- `schema-change`: use when touching `supabase/migrations` — migration/RLS/test/typegen decisions, seed regen, db reset discipline
- `edge-functions`: use when touching `supabase/functions` or `src/shared` — Deno lint/fmt, runtime boundaries
- `test-hygiene`: use for writing tests, coverage thresholds, CI-only test flakes
- `ci-triage`: use when PR checks fail — reading states, check→fix map, masked-failure layers
