---
name: project-structure-placement
description: "Use for Gubernator placement: src/routes, src/features, src/components, src/lib, src/shared, route thinness, imports, naming, query/schema/type modules, public entrypoints, and deciding where code belongs."
---

# Project Structure Placement

## Map

- `src/routes`: TanStack Router route shell only.
- `src/features/<feature>`: product domain UI, queries, mutations, schemas, types, utils.
- `src/components/ui`: shadcn/Radix-like primitives only.
- `src/components/app`: app chrome/context display.
- `src/components/shared`: reusable non-domain components.
- `src/lib`: browser infra/helpers. Supabase client lives here.
- `src/shared`: browser + Supabase Edge shared pure TS.
- `src/types`: shared app types, generated `database.ts`.
- `supabase/functions`: Edge Functions. No `@/` alias.

## Routes

- Route file = params/search parse + guard + page component.
- Big JSX/form/table/dialog moves to feature component.
- Auth guard near route boundary: `requireAuthenticatedRoute`.
- Parent route with children = layout route + `<Outlet />`.
- Parent page = sibling `*.index.tsx`.
- Pending route uses shared `LoadingState`.
- Do not edit `src/routeTree.gen.ts`.

## Feature Shape

- Public surface: `src/features/<feature>/index.ts`.
- Other features import public surface only: `@/features/<feature>`.
- Same feature may use local relative imports.
- Query keys in `queries/*QueryKeys.ts`.
- Query option builders in `queries/*Queries.ts`.
- Mutations in `mutations/*Mutations.ts`.
- Zod schemas in `schemas/*Schemas.ts`.
- Feature-only types in `types/*Types.ts`.
- Pure domain helpers in `utils`.
- Keep query keys stable, serializable, scoped by world/user when needed.

## Data

- Routes/components do not import `@/lib/supabase`.
- Routes/components do not call `fetch`.
- Raw Supabase calls stay in feature query/mutation modules or Edge Functions.
- Query/mutation factories accept injected client/queryClient for tests when useful.
- Use `queryOptions`/`mutationOptions`; invalidate exact affected keys.
- Normalize Supabase errors at module boundary.
- Use RPCs for privileged writes and multi-row invariants.

## Naming

- Routes: kebab-case, except `index.tsx`, `__root.tsx`.
- UI primitive files: kebab-case.
- App/shared/feature component files: PascalCase.
- Components: PascalCase function declarations.
- Hooks/functions/query helpers: camelCase.
- Types: PascalCase `type`, not `interface` unless augmentation needs it.
- Feature folders: product terms, e.g. `managed-populations`, `turns`.

## Guardrails

- `@/` for cross-layer imports inside `src`.
- Parent relative imports inside `src/shared` OK; Deno needs explicit `.ts`.
- Edge Functions use relative imports + explicit `.ts`.
- Keep imports ordered/deduped/acyclic.
- `QueryClient` only in `src/lib/queryClient.ts`.
- `QueryClientProvider` only in root route.
- `createRouter`/`RouterProvider` only in `src/main.tsx`.
- `createClient` only in `src/lib/supabase.ts`.
- Avoid `any`, non-null assertions, `console.log`, `enum`, `for...in`, `with`.
- Avoid raw `Date.now`, `new Date`, `Math.random`, `crypto.randomUUID`.
- Use `generateLocalId()` from `@/lib/uid`.
- Avoid raw `JSON.parse/stringify`, `setTimeout`, `setInterval` in routes/components.
