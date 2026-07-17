# RLS Performance Lint Fixes

**Date:** 2026-07-17
**Status:** Approved design

## Problem

The Supabase database linter reports 10 `WARN`-level performance findings, all on
Row Level Security policies. They fall into two categories:

1. **`auth_rls_initplan` (4 findings)** — policies call `auth.uid()` (or
   `current_setting()`) directly in the policy expression, so Postgres re-evaluates
   the call for every row instead of once per query.
2. **`multiple_permissive_policies` (6 table+action findings)** — a table has two or
   three permissive policies for the same role and action, so Postgres executes every
   one of them on every relevant query.

Both are performance-only and bite at scale. The fix must not change access semantics.

## Approach

A **single new migration** (`supabase/migrations/<ts>_rls_perf_lint_fixes.sql`) that
`drop`s and re-`create`s the affected policies, following the repo's append-only
migration convention. Categories A and B overlap on the `users` and `worlds` tables,
so one migration is cleaner than splitting.

Two mechanical transformation rules:

- **Rule A (initplan):** replace bare `auth.uid()` with `(select auth.uid())` so the
  planner evaluates it once (an InitPlan) rather than per row.
- **Rule B (merge):** replace N permissive policies for the same action with **one**
  policy whose predicate is the logical OR of the originals. For `UPDATE` policies, OR
  both the `using` and the `with check` clauses.

Every rewrite preserves the exact access predicate. Only the evaluation shape changes.

## The rewrites

Source of current definitions (latest CREATE per policy):

- `20260426000003_rls_policy_overhaul.sql` — `users_select_self`, `users_select_super_admin`, `worlds_select_admin`, `worlds_select_super_admin`, `worlds_update_super_admin`
- `20260427000000_restrict_user_self_updates.sql` — `users_update_own`
- `20260427000001_require_active_world_access.sql` — `world_admins_select`
- `20260502000005_add_notifications.sql` — `notifications_select_recipient`
- `20260525000000_restrict_citizen_self_update.sql` — `citizens_update_admin`, `citizens_update_self`
- `20260525000003_extend_worlds_settlements_rls_pc_path.sql` — `worlds_select_player_character`
- `20260530000014_add_worlds_update_world_admin.sql` — `worlds_update_world_admin`
- `20260630000001_add_citizen_memories.sql` — `citizen_memories_select_super_admin`, `citizen_memories_select_world_admin`
- `20260910000000_add_nation_discoveries.sql` — `nation_discoveries_select_admin`, `nation_discoveries_select_member`

### Category B — merges (drop N → create 1)

| Table / action              | Drops                                                                                | New single-policy predicate                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `citizen_memories` SELECT   | `citizen_memories_select_super_admin`, `citizen_memories_select_world_admin`         | `public.is_super_admin() or public.is_world_admin(world_id)`                                                                                                                                       |
| `citizens` UPDATE           | `citizens_update_admin`, `citizens_update_self`                                      | `public.is_super_admin() or public.is_world_admin(world_id) or (citizen_type = 'player_character' and user_id = public.current_app_user_id())` — identical `using` and `with check`                |
| `nation_discoveries` SELECT | `nation_discoveries_select_admin`, `nation_discoveries_select_member`                | `public.is_world_admin(world_id) or public.is_super_admin() or public.current_user_has_player_character_in_nation(nation_a_id) or public.current_user_has_player_character_in_nation(nation_b_id)` |
| `users` SELECT              | `users_select_self`, `users_select_super_admin`                                      | `id = (select auth.uid()) or public.is_super_admin()` — also clears an `auth_rls_initplan` warning                                                                                                 |
| `worlds` SELECT             | `worlds_select_admin`, `worlds_select_player_character`, `worlds_select_super_admin` | `public.is_world_admin(id) or public.current_user_has_world_access(id) or public.is_super_admin()`                                                                                                 |
| `worlds` UPDATE             | `worlds_update_super_admin`, `worlds_update_world_admin`                             | `public.is_super_admin() or (public.is_active_app_user() and public.is_world_admin(id) and archived_at is null)` — identical `using` and `with check`                                              |

### Category A — wrap only (drop 1 → create 1, no merge)

| Policy                           | Change                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world_admins_select`            | `user_id = auth.uid()` → `user_id = (select auth.uid())`; rest of predicate (`public.is_active_app_user() and ( ... or public.is_world_admin(world_id) or public.is_super_admin())`) unchanged |
| `users_update_own`               | `id = auth.uid()` → `id = (select auth.uid())`; `status = 'active'` and `with check` unchanged                                                                                                 |
| `notifications_select_recipient` | `recipient_user_id = auth.uid()` → `recipient_user_id = (select auth.uid())`; `public.is_active_app_user() and ...` unchanged                                                                  |

9 policy sites clear all 10 warnings: the `users` SELECT merge closes both an initplan
and a multiple-permissive finding at once.

### Predicate preservation

OR'd predicates are kept verbatim even where a branch looks redundant (e.g.
`current_user_has_world_access(id)` may already subsume the admin checks in `worlds`
SELECT). Merging is not the place to prune predicates — that would change behavior and
risk locking a role out. Only the two transformation rules above are applied.

## Verification

Schema-change checklist decisions:

- **Migration:** yes — one new file, drop + recreate.
- **RLS decision:** these _are_ the RLS policies; access semantics are unchanged by
  construction (Rule A is evaluation-only; Rule B is an exact OR of existing predicates).
- **DB test decision:** the merges are the real risk — a dropped OR-branch silently
  narrows or widens access. Plan:
  1. `supabase db reset` then `supabase test db` to run the existing pgTAP suite
     (includes `worlds_update_world_admin_test`, `citizen_visible_to_current_user_test`,
     and other RLS tests).
  2. For each of the 6 merged policies, audit whether an existing test exercises **each
     role path** with a positive (allowed) and negative (denied) assertion.
  3. Add targeted pgTAP assertions only where a merged policy's role path lacks coverage.
- **Typegen decision:** none — no schema/column/type shape change.
- **Seed regeneration:** not needed.

## Out of scope

- Pruning redundant predicate branches.
- Any RLS policy not named in the linter findings.
- The linter's other categories (none reported beyond these two).

## Risks

- **Dropped OR-branch during a merge** — mitigated by the per-role-path test audit above.
- **`(select auth.uid())` subquery in `with check`** — Rule A is only applied to
  `using`/`with check` sites that currently use bare `auth.uid()`; behavior is identical.
