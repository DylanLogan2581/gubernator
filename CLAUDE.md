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
