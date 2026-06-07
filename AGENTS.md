# AGENTS.md

Do not read `README.md` or `CONTRIBUTING.md` unless task asks.

## Rules

- Keep route files thin. Compose page modules instead of growing route files.
- Prefer small focused modules over mixed-responsibility files.
- Use TypeScript in app code.
- Use `@/` for cross-layer imports from `src`. Within a feature, local relative imports are fine.
- Prefer named exports.
- Reuse existing UI primitives and helpers before adding abstractions.
- Do not manually edit generated files such as `src/routeTree.gen.ts`.
- Review every change for security impact before finish.

## Truth

- `src/routes`
- `supabase/migrations`
- `supabase/functions`

Application tables must use Row Level Security.

## Skills

- `project-structure-placement`: use for route/layout rules, placement, imports, naming, query/schema/type organization
- `frontend-ui-patterns`: use for React/Tailwind/shadcn/ui/Sonner/accessibility frontend work
- `supabase-edge-shared`: use for Supabase, RLS, auth, migrations, seeded access, `src/shared`, Edge Functions
- `verification-workflow`: use for test/build/lint/release/finish-check decisions

Schema or RLS review: use `.opencode/agents/schema-guardian.md`.
