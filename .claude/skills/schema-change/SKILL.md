---
name: schema-change
description: >-
  Make a database schema change the way this repo demands: migration file,
  RLS decision, pgTAP test decision, typegen decision, seed regeneration.
  Trigger when adding/altering tables, columns, views, functions, triggers,
  policies, or anything under supabase/migrations/.
---

# Schema Change

Every schema change = four decisions. PR reviewer checks all four. Decide up front, note each in PR.

1. **Migration** — always. New file `supabase/migrations/YYYYMMDD000000_short_name.sql`. Timestamp after latest existing file. Never edit old migration.
2. **RLS** — new application table MUST have RLS enabled + policies. No exceptions. Decide who read, who write, per role.
3. **DB test** — new table/policy/function → pgTAP test in `supabase/tests/<thing>_test.sql`. RLS table gets `<table>_rls_test.sql` proving each role sees only what allowed.
4. **Typegen** — new/changed table, view, column, or function signature → regenerate `src/types/database.ts`. Function-body-only change with same signature: skip, file won't differ.

## Big Traps

- **Redefining existing SQL function**: copy body from LATEST migration that defined it, NOT the original. Columns get renamed over time (`is_deleted`/`is_active` → `is_trashed`). Old body references dead columns → runtime error only when called.
- **Stale local DB hides failures**. Always before commit:
  ```bash
  npx supabase db reset      # applies migrations + seed.sql
  npx supabase test db       # pgTAP
  ```
  CI starts clean every time. If test passes only on stale DB, CI catches you.
- **Seed**: `supabase/seed.sql` is generated. Never hand-edit. Change `supabase/seed_tools/`, then run `supabase/seed_tools/regenerate.sh`. Big seed.sql diff in PR is normal after regen.
- **Cascade deletes**: full-cascade RPCs (like `hard_delete_world`) trip BEFORE-DELETE integrity guards mid-cascade. Established fix: transaction-local `set_config('app.<flag>', 'true', true)`, guard trigger early-returns on flag.
- **Service-role clients bypass RLS but have no `auth.uid()`**. RPC authorizing via `is_super_admin()`/`is_world_admin()` fails `42501 insufficient privilege` on service-role. Use authenticated client for those.

## Pre-commit Hook

Staging schema/test files triggers `supabase test db` in pre-commit. Hook does NOT reset DB first — reset yourself before commit or hook fails on stale data. Commits take minutes; run in background, poll `git log -1`.
