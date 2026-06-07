---
name: supabase-edge-shared
description: "Use for Gubernator Supabase work: migrations, RLS, policies, SECURITY DEFINER RPCs, auth, seeded access, service-role safety, Edge Functions, src/shared, explicit .ts imports, and browser-vs-Deno boundary decisions."
---

# Supabase Edge Shared Rules

## Boundaries

- `src/lib`: browser-only infra. Supabase browser client lives here.
- `src/shared`: pure TS used by browser + Edge. No browser APIs, no Vite APIs, no `@/`.
- `supabase/functions`: Deno Edge Functions. Relative imports, explicit `.ts`.
- `supabase/functions/_shared`: mirror of shared pure modules needed by Edge.
- After shared module used by Edge changes: sync mirror, then `npm run functions:cache-clear`.

## Edge Functions

- One function per `supabase/functions/<function-name>/index.ts`.
- Handler shape: method/CORS -> body parse -> auth context -> authorization -> state -> work -> response.
- Validate request body before auth-dependent work.
- Use anon key + caller JWT for authorization/RLS checks where possible.
- Use service-role key only for final privileged RPC/admin operation.
- Never return secrets or raw privileged error payloads.
- CORS origin allow-list from runtime env helpers.
- Explicit error contract: `{ ok: false, error: { code, message } }`.
- Tests beside function modules when logic branches.

## Migrations

- Use migrations for schema changes, not dashboard-only changes.
- Keep migrations forward-only.
- Include table, constraints, indexes, triggers, grants, RLS, policies together when practical.
- New application table: `alter table ... enable row level security`.
- RLS decision required for views/RPC-returned data too.
- SECURITY DEFINER functions: `set search_path = ''`, fully qualify `public.*`.
- Revoke broad execute first, then grant intended role.
- Use RPCs for privileged writes, multi-table invariants, soft/hard delete flows.
- Use SQLSTATE/hints intentionally; keep app mapping in sync.
- Add pgTAP test in `supabase/tests` for auth matrix + business invariant.
- Regenerate `src/types/database.ts` with `npm run db:types` when app types need it.

## Auth Model

- Browser sees only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Service-role key only in Edge Functions / local server context.
- Active app user gate matters: authenticated but inactive user has no app access.
- Super admin sees/manages all worlds.
- World admin manages assigned worlds.
- Player character world path grants world access where policies allow.
- Private worlds hidden unless super admin, world admin, or PC/access grant.
- Anonymous sees no protected app table rows through RLS.

## Local Access

- Local auth uses API URL and anon key from `supabase status`. Never document or commit service-role keys, third-party secrets, or production credentials.
- Run `npx supabase db reset` to apply `supabase/migrations` and reload `supabase/seed.sql`.
- Seeded users: `superadmin@gubernator.local`, `test@gubernator.local`, `other@gubernator.local`.
- Seeded password: `password123`.
- Seeded worlds are private. Super admin sees all. Normal users see own unless explicit access grants more. Anonymous sees none through RLS.
- Protected routes such as `/worlds` and `/worlds/$worldId` require authenticated session and redirect unauthenticated users to `/sign-in` with normalized return path.
- World access is layered: route guards, RLS, app access context.

## Security Checks

- Search for `SUPABASE_SERVICE_ROLE_KEY` before finish if browser/Edge boundary touched.
- Check RLS for select/insert/update/delete separately.
- Check archived/trashed read-only rules for mutation paths.
- Check cross-world writes: same-world FK/composite FK/trigger/RPC guard.
- Check concurrent turn/world mutations use row lock or unique running guard.
