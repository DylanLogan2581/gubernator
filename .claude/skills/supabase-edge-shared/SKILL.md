---
name: supabase-edge-shared
description: >-
  Runtime Supabase usage in this repo: clients, auth model and roles, RLS
  helpers, feature query/mutation modules, src/shared cross-runtime code, Edge
  Function anatomy and invocation, seeded local accounts. Trigger for auth,
  RLS, Supabase queries, src/shared, or Edge Function work. (Schema changes →
  schema-change; Deno lint/CI → edge-functions.)
---

# Supabase, Edge & Shared

## Clients

- Browser: singleton `supabase` in `src/lib/supabase.ts` (anon key, typed `SupabaseClient<Database>`). Feature modules take `client: GubernatorSupabaseClient = requireSupabaseClient()` so tests inject fakes. Never construct clients elsewhere (lint-banned).
- Env contract: `src/shared/envContract.ts`. Browser vars `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `SUPABASE_SERVICE_ROLE_KEY` is server-only — CI fails the build if it reaches the bundle. **No service-role client exists in `src/`; service-role lives only inside Edge Functions.**
- Edge Functions use no supabase-js at all — raw REST/GoTrue via `_shared/supabaseFetch.ts` (30s timeout, `classifyHttpError`: 4xx = safe deny, 5xx = retryable).

## Auth & Roles

- 5 roles (`e2e/roles.ts`): superadmin, world-admin, nation-manager, settlement-manager, player. Manager roles derive from a `player_character` citizen's `role_type` + `status='alive'` — dead citizens lose rights.
- Authorization is SQL SECURITY DEFINER helpers (all `set search_path=''`): `is_super_admin()`, `is_world_admin(p_world_id)`, `has_world_access()`, `is_nation_manager_of()`, `is_settlement_manager_of()`, `current_app_user_id()` (wraps `auth.uid()`). RLS policies call these to avoid recursion — follow that pattern, not direct subqueries.
- `users.is_super_admin` is trigger-protected against self-elevation; grantable only via service-role/direct DB.
- Route guards: `requireAuthenticatedRoute` / `redirectAuthenticatedRoute` from `@/features/auth` in route `beforeLoad`. Client-side gating uses `currentAppUserQueryOptions`; real enforcement is RLS.
- Worlds have NO `owner_id` (removed 2026-06) — authority is `world_admins` rows; creators get one via trigger.

## Feature Data Access

- Never call Supabase from routes/components — only `features/<f>/queries|mutations` modules. Plain CRUD → `client.from(...)`; guarded/transactional ops → `client.rpc("issue_decree", {p_...})`. Uniform `if (error !== null) throw normalizeSupabaseError(error)`.
- Parse inputs with zod before RPC. Known wart: generated types miss nullable RPC params → `p_x: value as string` casts with a comment.
- Edge Functions invoked via `client.functions.invoke("<name>", {body})` (attaches user JWT); validate response with zod `safeParse`.

## src/shared (cross-runtime)

- Pure logic for browser AND Deno: no browser APIs, no `@/` alias, relative imports WITH explicit `.ts` extensions.
- Edge Functions consume a MIRROR under `supabase/functions/_shared/` (economy, simulation, envContract, turnCalendarPrimitives…). Changing `src/shared` usually means updating the `_shared` copy too — keeping them in sync is manual discipline.

## Edge Functions (`supabase/functions/`)

- Inventory: `admin-create-user` (service-role user creation, idempotency keys, rate limit), `end-turn-simulation` (turn engine; `preview:true` = dry-run forecast), `export-world-template`, `send-email` (SMTP).
- Per-function anatomy: `index.ts` (handler + serve), `session.ts` (JWT → `resolveAuthContext` via GoTrue), `validate.ts`, `types.ts`, tests. Shared HTTP helpers in `_shared/http/`.
- Authorization pattern: check permissions with the CALLER's JWT + anon key (RPC `is_super_admin` etc.), THEN escalate to service-role only for the privileged write. Never authorize via service-role — it bypasses RLS and has no `auth.uid()` (fails `42501`).
- Responses: `{ok:true, data}` / `{ok:false, error:{code,message}}`. CORS: per-function `*_ALLOWED_ORIGINS` secret, enforced only when an `Origin` header is present — JWT checks are the real boundary.

## Local Dev & Seed

- `supabase start`, `supabase db reset` (migrations + seed). Seed: 5 accounts (password `password123`, `*@gubernator.local`), world "Aldermoor" at turn 32; `test@` = settlement manager, `other@` = nation manager. Missing accounts → `db reset`.
- Local quirk: ES256 JWT verification can fail in local Docker; `end-turn-simulation` has an `IS_LOCAL_DEV=true` dev-only path — never replicate that outside local guards.
- Edge functions (incl. `send-email` for `/superadmin/email` and `end-turn-simulation` for turn advancement) only respond once the edge-runtime container from `supabase start` is up — if it's stopped, crashed, or never started, calls fail as a Kong 503 (`FunctionsHttpError`/unreachable), not a normal function error. `supabase status` shows whether it's healthy; `supabase stop && supabase start` restarts it.
