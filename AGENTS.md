# AGENTS.md

This is the only repository instruction file agents need to read.

Do not spend tokens re-reading `README.md` or `CONTRIBUTING.md` unless the task explicitly asks for them. Those files are written for humans. This file is the agent source of truth.

## Purpose

This repository is a web app template. Optimize for:

- predictable structure
- strong boundaries
- low-friction handoff between people and agents
- secure Supabase usage
- boring, explicit organization over cleverness

## Stack

- Vite
- React 19
- TypeScript
- TanStack Router with file-based routes
- TanStack Query
- Tailwind CSS v4
- shadcn/ui
- Vitest
- Supabase

## Core Rules

- Keep route files thin. Routes should define the route and compose page-level modules.
- Prefer small modules over mixed-responsibility files.
- Use TypeScript in app code.
- Use the `@/` alias for cross-layer imports from `src`. Within a feature, local relative imports are fine.
- Prefer named exports.
- Reuse existing UI primitives and helpers before adding abstractions.
- Do not manually edit generated files such as `src/routeTree.gen.ts`.
- Review all changes for security implications before finishing.

## Source Of Truth

- `src/routes`: pages and route structure
- `supabase/migrations`: database schema history
- `supabase/functions`: Edge Functions

Application tables must use Row Level Security.

## Directory Guide

```text
src/
  components/
    ui/                  # low-level reusable primitives
    app/                 # shared app-specific components
    shared/              # small reusable cross-feature components
  features/
    <feature-name>/
      components/
      hooks/
      queries/
      schemas/
      types/
      utils/
  hooks/
  lib/
  routes/
  test/
  types/

supabase/
  functions/
  migrations/
```

## Placement Rules

### Routes

- Put route files in `src/routes`.
- Keep business logic, large forms, and reusable UI out of routes once they start growing.
- Move feature-owned logic into `src/features/<feature-name>`.
- Keep auth checks, redirects, and route guards close to the route boundary.

### Components

- `src/components/ui`: low-level primitives only
- `src/components/app`: shared app-specific components
- `src/components/shared`: lightweight reusable components across features
- `src/features/<feature-name>/components`: feature-owned UI

### Data And Queries

- Put shared infrastructure in `src/lib`.
- Keep Supabase client setup in shared infrastructure such as `src/lib/supabase.ts`.
- Put feature-specific async state and query options in `src/features/<feature-name>/queries`.
- Do not call `fetch` directly in routes or components.
- Do not import `@/lib/supabase` directly into routes or components.
- Keep raw database access close to query modules.
- Centralize query keys and query option builders.
- If a route needs immediate data, prefer route-level preload or prefetch patterns instead of duplicating fetch logic inside child components.

### Validation And Types

- Put zod schemas in `src/features/<feature-name>/schemas`.
- Put shared domain types in `src/types`.
- Put feature-only types in `src/features/<feature-name>/types`.

### Edge Functions

- One function per `supabase/functions/<function-name>/index.ts`
- Keep service-role or secret-bearing logic out of the browser app.
- Validate Edge Function input before privileged work.

## Naming

- Route files: kebab-case, except `index.tsx` and `__root.tsx`
- React components: PascalCase
- Functions, variables, hooks, query helpers: camelCase
- Feature folders: product concepts such as `auth`, `projects`, `tasks`, `billing`
- `src/components/ui` filenames: kebab-case
- app/shared/feature component filenames: PascalCase

## Lint-Enforced Expectations

- Use `@/` for cross-layer imports inside `src`. Within a feature, local relative imports are allowed.
- Keep imports ordered, deduplicated, and acyclic.
- Import features only through public entrypoints such as `@/features/<feature-name>`.
- Keep `src/components/ui` independent of routes, features, app/shared components, and the Supabase client.
- Create `QueryClient` and render `QueryClientProvider` only in the approved shared root/provider setup.
- Create the router and render `RouterProvider` only in `src/main.tsx`.
- Use function declarations for named React components.
- Prefer `type`, `import type`, explicit return types, and exhaustive `switch` handling.
- Avoid `any`, non-null assertions, `console.log`, `enum`, `for...in`, and `with`.
- Avoid direct `window.location` writes, `localStorage`, `Date.now`, `new Date`, and `Math.random` in app code.
- Avoid `JSON.parse`, `JSON.stringify`, `setTimeout`, and `setInterval` in routes and components unless hidden behind helpers or hooks.

## Styling And UI

- Use Tailwind utilities for most styling.
- Prefer existing shadcn/ui primitives before adding new base patterns.
- If markup repeats, extract a component.
- Preserve accessibility: semantic HTML, labels, keyboard support, and visible focus states.
- Prefer design tokens from `src/index.css` over one-off values.

## Supabase Rules

- Browser-safe values only may use the `VITE_` prefix.
- Never expose service-role keys or third-party secrets in frontend code.
- Use migrations for schema changes, not dashboard-only changes.
- Include tables, constraints, indexes, RLS, and policies together when relevant.
- Keep migrations forward-only.
- If generated database types are used, update them after schema changes.
- Use Edge Functions for privileged workflows.

## Testing

- Use Vitest for unit and integration tests.
- This template intentionally keeps `npm run test` green when no tests exist yet. Do not add placeholder tests only to satisfy the starter.
- Add tests for new behavior, bug fixes, and non-trivial refactors when practical.
- Shared test helpers belong in `src/test`.
- Prefer fast unit tests for schemas, query helpers, and pure transformations.
- If a change is hard to test automatically, note that clearly in the handoff.

## Downstream Workflow Defaults

This template ships GitHub and commit conventions meant for downstream app repos:

- short descriptive branches
- pull requests instead of direct pushes to `main`
- conventional commits and PR titles
- required `Lint` and `Build` checks
- CODEOWNERS review

Release behavior in this template is on-demand:

- `npm run release:dry`: preview release output
- `npm run release`: update version/changelog, create release commit + tag, and push
- pushed `v*` tags trigger `.github/workflows/tag-release.yml` to publish a GitHub Release

Do not implement per-commit version bumps or per-commit tagging automation unless explicitly requested.

When editing the template itself, follow the active user instruction if it differs.

## Before Finishing

- Run `npm run lint` when practical.
- Run `npm run build` when changes affect routing, typing, or bundling.
- Run Vitest for the affected area when tests exist.
- If routes changed, make sure generated routing output is current.
- If schema changed, confirm a migration exists and was updated appropriately.
- If schema changed, confirm RLS and policies were added or updated.
- Confirm the change was reviewed for security implications.

## Quick Placement Reminder

- pages: `src/routes`
- reusable UI: `src/components`
- feature logic: `src/features`
- shared infrastructure: `src/lib`
- Edge Functions: `supabase/functions`
- schema changes: `supabase/migrations`
