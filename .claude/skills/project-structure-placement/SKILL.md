---
name: project-structure-placement
description: >-
  Where files go and how they import in this repo: route/layout rules, feature
  module anatomy, naming, query/schema/type organization, eslint boundaries.
  Trigger when creating files, adding routes/features, or hitting
  eslint-plugin-boundaries or no-unknown-files errors.
---

# Project Structure & Placement

Layered layout enforced by `eslint-plugin-boundaries` (`eslint.config.ts`). Every file under `src/` must map to a known element (`boundaries/no-unknown-files`) — a file in the wrong place is a lint error, not a style nit.

## Placement Map

| Location                | What                                                                                                         | May import                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `src/routes`            | Thin TanStack route files                                                                                    | features (barrels), components, hooks, lib         |
| `src/features/<f>`      | Domain logic: `components/ queries/ mutations/ schemas/ types/ utils/ hooks/` + `index.ts` barrel            | other feature BARRELS only, components, hooks, lib |
| `src/components/ui`     | shadcn primitives only (via `components.json`)                                                               | ui, lib, shared, types                             |
| `src/components/app`    | App chrome (AppLayout, sidebar, breadcrumbs, command palette)                                                | shared/ui components, hooks, lib                   |
| `src/components/shared` | Domain-agnostic widgets (DataTable, PageHeader, ConfirmDialog, LoadingState/ErrorState/EmptyState, StatTile) | ui, hooks, lib                                     |
| `src/hooks`             | Global reusable hooks                                                                                        | lib                                                |
| `src/lib`               | Framework utils + singletons (supabase.ts, queryClient.ts, authStateQueryCache.ts). No React components      | shared, types                                      |
| `src/shared`            | Isomorphic browser+Deno domain logic (simulation, economy…). Explicit `.ts` import extensions                | types                                              |
| `src/types`             | Generated `database.ts` ONLY. Domain types go in `features/<f>/types/`                                       | —                                                  |

Do NOT confuse `src/shared` (Deno-safe domain code) with `src/components/shared` (React UI).

## Routes

- Flat dot-notation files: `worlds.$worldId.nations.$nationId.settlements.tsx`. Params camelCase with `$`. Pathless layout = leading `_` segment (`._nation.tsx`).
- Route file contains: `createFileRoute` config (`beforeLoad` guard from `@/features/auth`, `component`, `validateSearch` zod schema, `pendingComponent`/`notFoundComponent`) + a tiny local component that wires `Route.useParams()` into a feature Page component. Nothing else — pages live in features.
- No Supabase calls, no business logic in routes; import query/mutation options from feature barrels.
- `src/routeTree.gen.ts` is generated — never edit. Route tests co-located as `*.test.tsx` (ignored by route generation).
- The `_nation` pathless layout deliberately does NOT wrap the settlement subtree — see its warning comment before restructuring nation routes.

## Features

- Every feature exposes its public API through `index.ts`; consumers import `@/features/<feature>`, never deep paths — boundaries treats the whole feature dir as one element, so cross-feature internal imports are lint errors.
- Naming: components PascalCase `.tsx` (`Page`/`Panel`/`Layout` suffixes), modules camelCase `.ts`, hooks `useXxx`.
- Query keys: `<feature>QueryKeys` object `as const`; the `.all` root comes from the CENTRAL registry `@/lib/authStateQueryCache` — a new feature must add its `<feature>All` key there first.
- Factories named `xxxQueryOptions` / `xxxMutationOptions`. Mutation errors: `XxxMutationError` class + `isXxxMutationError` guard, exported from the barrel.
- Zod schemas in `schemas/`, named `xxxSchema`, types via `z.infer` exported alongside. Route search-param schemas may live inline in the route file.

## Imports

- `@/` = `./src`. Cross-layer imports use `@/`; within a feature, relative imports are fine. Prefer named exports; `import type` last.
- The alias is duplicated in `tsconfig.json`, `tsconfig.app.json`, `tsconfig.edge-functions.json`, and `vite.config.ts` — change all four together.

## Traps

- Feature folder naming is historically mixed (`government-bodies` vs `resourceCategories`); prefer kebab-case for new features.
- Forgetting the `authStateQueryCache` `.all` registration gives silently wrong cache invalidation, not an error.
- `no-restricted-syntax` bans direct Supabase client construction outside `src/lib` — use the singleton.
