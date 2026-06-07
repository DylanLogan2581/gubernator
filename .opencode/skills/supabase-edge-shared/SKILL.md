---
name: supabase-edge-shared
description: Use for Supabase, migrations, RLS, policies, auth, seeded access, Edge Functions, src/shared, explicit .ts imports, or browser-vs-Deno boundary decisions.
---

# Supabase Edge Shared Rules

## Shared

- Put code in `src/shared` only when it must run in both browser app and Supabase Edge Functions.
- Browser-only infra such as Supabase client or query helpers goes in `src/lib`.
- `src/lib` is browser-only. Do not import it from `src/shared` or Edge Functions.
- Every file in `src/shared` must use explicit `.ts` extensions in imports.
- Do not use browser-only APIs, Vite-specific code, or `@/` alias inside `src/shared`.

## Edge Functions

- One function per `supabase/functions/<function-name>/index.ts`.
- Keep service-role or secret-bearing logic out of browser app.
- Validate Edge Function input before privileged work.
- Always use explicit `.ts` extensions in imports inside Edge Functions and any `src/shared` modules they import.
- After changing shared module used by Edge Function, run `npm run functions:cache-clear`.
- `supabase/functions/_shared/` mirrors part of `src/shared/`. Keep both trees in sync.

## Supabase Rules

- Browser-safe values only may use `VITE_` prefix.
- Never expose service-role keys or third-party secrets in frontend code.
- Use migrations for schema changes, not dashboard-only changes.
- Include tables, constraints, indexes, RLS, and policies together when relevant.
- Keep migrations forward-only.
- If generated database types are used, update them after schema changes.
- Use Edge Functions for privileged workflows.

## Local Auth Access

- Local auth uses API URL and anon key from `supabase status`. Never document or commit service-role keys, third-party secrets, or production credentials.
- Run `npx supabase db reset` to apply `supabase/migrations` and reload `supabase/seed.sql`.
- Seeded users:
  - `superadmin@gubernator.local` / `password123`
  - `test@gubernator.local` / `password123`
  - `other@gubernator.local` / `password123`
- Seeded worlds are private. Super admin sees all. Normal users see own unless explicit access grants more. Anonymous sees none through RLS.
- Protected routes such as `/worlds` and `/worlds/$worldId` require authenticated session and redirect unauthenticated users to `/sign-in` with normalized return path.
- World access is layered: route guards, RLS, app access context.
