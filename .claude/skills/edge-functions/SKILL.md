---
name: edge-functions
description: >-
  Write and modify Supabase Edge Functions and cross-runtime shared code
  without tripping the Deno CI check or breaking browser/Deno boundaries.
  Trigger when touching supabase/functions/ or src/shared/.
---

# Edge Functions & Cross-Runtime Code

## Boundaries (violate = broken build or CI fail)

- `supabase/functions/**` = Deno runtime. Deno APIs OK. NO `@/` alias imports. Explicit `.ts` extensions on ALL imports.
- `src/shared/**` = cross-runtime (browser AND Deno consume). No browser APIs, no Deno APIs, no `@/` alias, explicit `.ts` extensions.
- Browser code never imports from `supabase/functions/`. If both sides need logic, it lives in `src/shared/` or is duplicated deliberately (payload parsers exist in both trees — keep in sync when changing).
- Never expose service-role keys to browser code.

## Deno CI Check — Two Layers, Sequential

CI runs `deno lint` THEN `deno fmt --check` on `supabase/functions/`. Lint failure hides fmt failure — fixing lint alone can still fail next run on fmt. Run BOTH locally before push:

```bash
npx -y deno@latest lint supabase/functions/
npx -y deno@latest fmt supabase/functions/    # rewrites in place; re-stage
```

Deno formats these files, NOT prettier. Prettier-formatted edge file fails fmt check.

## Lint Rules That Bite

- `require-await`: async function with no await → error. Fix: drop `async` (keep `Promise<T>` return type, return promise directly), or `return await` if early returns are plain objects and dropping async breaks the type.

## Function Shape

New function = directory under `supabase/functions/<name>/` with `index.ts` entry. Split by responsibility (see `send-email/`: index, session, recipients, template, validate, types). Shared helpers in `supabase/functions/_shared/`.

## Auth Gotcha

Service-role client bypasses RLS but carries no `auth.uid()`. RPCs that authorize via `is_super_admin()`/`is_world_admin()` → `42501` on service-role. Resolve the caller's session and use authenticated client for those RPCs.
