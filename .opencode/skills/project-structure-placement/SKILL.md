---
name: project-structure-placement
description: Use for src/routes, src/features, src/components, src/lib, naming, imports, layouts, query placement, schema placement, type placement, or deciding where code belongs.
---

# Project Structure Placement

## Place

- Put route files in `src/routes`.
- Keep business logic, big forms, and reusable UI out of routes.
- Move feature-owned logic into `src/features/<feature-name>`.
- Keep auth checks, redirects, and guards near route boundary.
- Parent route with child routes is layout. Render `<Outlet />`. Put parent page in sibling `*.index.tsx`.

- `src/components/ui`: low-level primitives only
- `src/components/app`: shared app-specific components
- `src/components/shared`: lightweight reusable components across features
- `src/features/<feature-name>/components`: feature-owned UI

- Put shared infrastructure in `src/lib`.
- Keep Supabase client in shared infra such as `src/lib/supabase.ts`.
- Put feature-specific async state and query options in `src/features/<feature-name>/queries`.
- Do not call `fetch` directly in routes or components.
- Do not import `@/lib/supabase` directly into routes or components.
- Keep raw database access close to query modules.
- Centralize query keys and query option builders.
- If route needs immediate data, prefer route preload or prefetch.

- Put zod schemas in `src/features/<feature-name>/schemas`.
- Put shared domain types in `src/types`.
- Put feature-only types in `src/features/<feature-name>/types`.
- Feature `types/` re-export from `src/shared` is intentional. Keep stable `@/features/<feature>/types` entrypoint.

## Naming

- Route files: kebab-case, except `index.tsx` and `__root.tsx`
- React components: PascalCase
- Functions, variables, hooks, query helpers: camelCase
- Feature folders: product concepts
- `src/components/ui` filenames: kebab-case
- app/shared/feature component filenames: PascalCase

## Guardrails

- Use `@/` for cross-layer imports inside `src`. Within a feature, local relative imports are allowed.
- Keep imports ordered, deduplicated, and acyclic.
- Import features through public entrypoints such as `@/features/<feature-name>`.
- Keep `src/components/ui` independent of routes, features, app/shared components, and Supabase client.
- Create `QueryClient` and `QueryClientProvider` only in shared root/provider setup.
- Create router and render `RouterProvider` only in `src/main.tsx`.
- Use function declarations for named React components.
- Prefer `type`, `import type`, explicit return types, and exhaustive `switch` handling.
- Avoid `any`, non-null assertions, `console.log`, `enum`, `for...in`, and `with`.
- Avoid direct `window.location` writes, `localStorage`, `Date.now`, `new Date`, and `Math.random` in app code.
- Avoid `crypto.randomUUID()`; use `generateLocalId()` from `@/lib/uid` instead.
- Avoid `JSON.parse`, `JSON.stringify`, `setTimeout`, and `setInterval` in routes and components unless behind helpers or hooks.
