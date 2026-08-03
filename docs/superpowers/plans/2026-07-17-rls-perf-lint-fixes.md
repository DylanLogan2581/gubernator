# RLS Performance Lint Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear all 10 Supabase database-linter performance warnings on RLS policies without changing access semantics.

**Architecture:** A single append-only migration drops and re-creates 9 policy sites. Two mechanical rules: wrap bare `auth.uid()` in `(select auth.uid())` (initplan fix), and merge multiple permissive policies for the same action into one policy whose predicate is the exact logical OR of the originals (multiple-permissive fix). A deterministic pgTAP test asserts the structural outcome; the existing pgTAP suite guards behavior; a targeted audit fills any behavior-coverage gap.

**Tech Stack:** PostgreSQL RLS, Supabase CLI, pgTAP.

**Spec:** `docs/superpowers/specs/2026-07-17-rls-perf-lint-fixes-design.md`

## Global Constraints

- Migration filename: `supabase/migrations/20261121000000_rls_perf_lint_fixes.sql` (timestamp is after the latest existing migration `20261120000000`; if a newer migration exists at execution time, bump to the next free `YYYYMMDD000000`).
- Never edit an existing migration; this is a new file only.
- Every re-created predicate must be the **exact** OR-union (merges) or the **exact** wrapped form (initplan) of the current policy body. No predicate pruning, no added or removed branches. Copy predicates verbatim from the source migrations listed in the spec.
- Verification loop before any commit that stages schema/test files:
  ```bash
  npx supabase db reset      # applies all migrations + seed.sql onto a clean DB
  npx supabase test db       # runs the full pgTAP suite
  ```
  The pre-commit hook runs `supabase test db` but does NOT reset first — always reset yourself before committing.
- Commits take minutes (hook runs typecheck + tests). Run `git commit` in the foreground with a generous timeout; do not background/poll it.
- Commit scope for migrations/tests is `config`. Type and subject lower-case, header ≤ 72 chars, no `Co-Authored-By` trailer.

---

## Task 1: Structural lint-fix assertion test (TDD red)

A deterministic pgTAP test that proves the two structural outcomes directly, without the hosted advisor: (a) exactly one permissive `authenticated` policy per flagged table+action, and (b) the four initplan-fixed policies contain the wrapped `(select auth.uid())` form. Written first so it FAILS against current policies, then goes green once Task 2's migration lands.

**Files:**

- Create: `supabase/tests/rls_perf_lint_fixes_test.sql`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing (verification only). Depends on final policy names from Task 2: `citizen_memories_select_admin`, `citizens_update_admin_or_self`, `nation_discoveries_select_admin_or_member`, `users_select_self_or_super_admin`, `worlds_select_member_or_admin`, `worlds_update_admin`, `world_admins_select`, `users_update_own`, `notifications_select_recipient`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/rls_perf_lint_fixes_test.sql`:

```sql
-- pgTAP tests for 20261121000000_rls_perf_lint_fixes.
-- Run with: npx supabase test db
--
-- Asserts the structural outcome of the RLS performance lint fixes:
--   • multiple_permissive_policies: exactly one permissive `authenticated`
--     policy remains per flagged table + action.
--   • auth_rls_initplan: the four fixed policies evaluate auth.uid() once by
--     wrapping it in a scalar subquery, which pg_policies renders as
--     "( SELECT auth.uid() AS uid)".
begin;

select
  plan (10);

-- --- multiple_permissive_policies: one permissive authenticated policy each ---
create or replace function pg_temp.permissive_count (tbl text, action text) returns int language sql stable as $$
  select count(*)::int
  from pg_policies
  where schemaname = 'public'
    and tablename = tbl
    and cmd = action
    and permissive = 'PERMISSIVE'
    and 'authenticated' = any (roles);
$$;

select
  is (pg_temp.permissive_count ('citizen_memories', 'SELECT'), 1, 'citizen_memories: one permissive authenticated SELECT policy');

select
  is (pg_temp.permissive_count ('citizens', 'UPDATE'), 1, 'citizens: one permissive authenticated UPDATE policy');

select
  is (pg_temp.permissive_count ('nation_discoveries', 'SELECT'), 1, 'nation_discoveries: one permissive authenticated SELECT policy');

select
  is (pg_temp.permissive_count ('users', 'SELECT'), 1, 'users: one permissive authenticated SELECT policy');

select
  is (pg_temp.permissive_count ('worlds', 'SELECT'), 1, 'worlds: one permissive authenticated SELECT policy');

select
  is (pg_temp.permissive_count ('worlds', 'UPDATE'), 1, 'worlds: one permissive authenticated UPDATE policy');

-- --- auth_rls_initplan: wrapped (select auth.uid()) present in the qual ---
create or replace function pg_temp.qual_of (tbl text, pol text) returns text language sql stable as $$
  select coalesce(qual, '') || ' ' || coalesce(with_check, '')
  from pg_policies
  where schemaname = 'public' and tablename = tbl and policyname = pol;
$$;

select
  like (pg_temp.qual_of ('world_admins', 'world_admins_select'), '%SELECT auth.uid() AS uid%', 'world_admins_select wraps auth.uid()');

select
  like (pg_temp.qual_of ('users', 'users_update_own'), '%SELECT auth.uid() AS uid%', 'users_update_own wraps auth.uid()');

select
  like (pg_temp.qual_of ('notifications', 'notifications_select_recipient'), '%SELECT auth.uid() AS uid%', 'notifications_select_recipient wraps auth.uid()');

select
  like (pg_temp.qual_of ('users', 'users_select_self_or_super_admin'), '%SELECT auth.uid() AS uid%', 'users_select merged policy wraps auth.uid()');

select
  *
from
  finish ();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx supabase db reset
npx supabase test db 2>&1 | grep -A3 rls_perf_lint_fixes
```

Expected: FAIL. The `permissive_count` assertions return 2 or 3 (the current split policies), and the `qual_of` assertions on the not-yet-created merged/renamed policies return empty. Confirm you see failing assertions from this file (not an error loading it).

- [ ] **Step 3: Commit the red test**

```bash
git add supabase/tests/rls_perf_lint_fixes_test.sql
git commit -m "test(config): assert rls performance lint fix structure"
```

Note: the pre-commit hook runs `supabase test db`, which will report this file's failures. If the hook blocks the commit on the failing test, commit Task 1 and Task 2 together instead — proceed to Task 2, then run one commit staging both the test and the migration. (Do not use `--no-verify`.)

---

## Task 2: The migration — drop + recreate 9 policy sites (TDD green)

Writes the single migration implementing every rewrite. Makes Task 1's structural test pass and keeps the full existing pgTAP suite green (the behavior-regression net).

**Files:**

- Create: `supabase/migrations/20261121000000_rls_perf_lint_fixes.sql`

**Interfaces:**

- Consumes: current policy definitions (verbatim) from the source migrations named in the spec.
- Produces: the 9 final policy names listed in Task 1's Interfaces block.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261121000000_rls_perf_lint_fixes.sql`:

```sql
-- Clears Supabase performance-linter findings on RLS policies:
--   • auth_rls_initplan          -> wrap bare auth.uid() in (select auth.uid())
--   • multiple_permissive_policies -> merge per-action permissive policies into one
--
-- No access-semantics change: initplan wraps are evaluation-only, and each merge
-- is the exact logical OR of the dropped policies' predicates (copied verbatim
-- from their defining migrations).
-- ===========================================================================
-- Category B: merge multiple permissive policies (one policy per action)
-- ===========================================================================
-- citizen_memories SELECT: super_admin + world_admin -> one
drop policy "citizen_memories_select_super_admin" on public.citizen_memories;

drop policy "citizen_memories_select_world_admin" on public.citizen_memories;

create policy "citizen_memories_select_admin" on public.citizen_memories for
select
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
  );

-- citizens UPDATE: admin + self -> one (using and with check both OR'd)
drop policy "citizens_update_admin" on public.citizens;

drop policy "citizens_update_self" on public.citizens;

create policy "citizens_update_admin_or_self" on public.citizens for
update to authenticated using (
  public.is_super_admin ()
  or public.is_world_admin (world_id)
  or (
    citizen_type = 'player_character'
    and user_id = public.current_app_user_id ()
  )
)
with
  check (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
    or (
      citizen_type = 'player_character'
      and user_id = public.current_app_user_id ()
    )
  );

-- nation_discoveries SELECT: admin + member -> one
drop policy "nation_discoveries_select_admin" on public.nation_discoveries;

drop policy "nation_discoveries_select_member" on public.nation_discoveries;

create policy "nation_discoveries_select_admin_or_member" on public.nation_discoveries for
select
  to authenticated using (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
    or public.current_user_has_player_character_in_nation (nation_a_id)
    or public.current_user_has_player_character_in_nation (nation_b_id)
  );

-- users SELECT: self + super_admin -> one (also clears initplan on the self branch)
drop policy "users_select_self" on public.users;

drop policy "users_select_super_admin" on public.users;

create policy "users_select_self_or_super_admin" on public.users for
select
  to authenticated using (
    id = (
      select
        auth.uid ()
    )
    or public.is_super_admin ()
  );

-- worlds SELECT: admin + player_character + super_admin -> one
drop policy "worlds_select_admin" on public.worlds;

drop policy "worlds_select_player_character" on public.worlds;

drop policy "worlds_select_super_admin" on public.worlds;

create policy "worlds_select_member_or_admin" on public.worlds for
select
  to authenticated using (
    public.is_world_admin (id)
    or public.current_user_has_world_access (id)
    or public.is_super_admin ()
  );

-- worlds UPDATE: super_admin + world_admin -> one (using and with check both OR'd)
drop policy "worlds_update_super_admin" on public.worlds;

drop policy "worlds_update_world_admin" on public.worlds;

create policy "worlds_update_admin" on public.worlds for
update to authenticated using (
  public.is_super_admin ()
  or (
    public.is_active_app_user ()
    and public.is_world_admin (id)
    and archived_at is null
  )
)
with
  check (
    public.is_super_admin ()
    or (
      public.is_active_app_user ()
      and public.is_world_admin (id)
      and archived_at is null
    )
  );

-- ===========================================================================
-- Category A: wrap bare auth.uid() (initplan) — no merge
-- ===========================================================================
-- world_admins_select
drop policy "world_admins_select" on public.world_admins;

create policy "world_admins_select" on public.world_admins for
select
  to authenticated using (
    public.is_active_app_user ()
    and (
      user_id = (
        select
          auth.uid ()
      )
      or public.is_world_admin (world_id)
      or public.is_super_admin ()
    )
  );

-- users_update_own
drop policy "users_update_own" on public.users;

create policy "users_update_own" on public.users for
update to authenticated using (
  id = (
    select
      auth.uid ()
  )
  and status = 'active'
)
with
  check (
    id = (
      select
        auth.uid ()
    )
    and status = 'active'
  );

-- notifications_select_recipient
drop policy "notifications_select_recipient" on public.notifications;

create policy "notifications_select_recipient" on public.notifications for
select
  to authenticated using (
    public.is_active_app_user ()
    and recipient_user_id = (
      select
        auth.uid ()
    )
  );
```

- [ ] **Step 2: Apply the migration and run the structural test**

```bash
npx supabase db reset
npx supabase test db 2>&1 | grep -A3 rls_perf_lint_fixes
```

Expected: all 10 assertions in `rls_perf_lint_fixes_test.sql` PASS.

- [ ] **Step 3: Run the full suite to confirm no behavior regression**

```bash
npx supabase test db 2>&1 | tail -20
```

Expected: the whole pgTAP suite passes, including `worlds_update_world_admin_test`, `citizen_visible_to_current_user_test`, and any `*_rls_test` files. Any failure here means a merged predicate dropped or altered a branch — re-diff the failing policy's new body against its source migration and fix the migration before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261121000000_rls_perf_lint_fixes.sql
git commit -m "fix(config): merge and wrap rls policies for linter performance"
```

(If Task 1's test was held back per its Step 3 note, stage it here too and use this single commit.)

---

## Task 3: Behavior-coverage audit for the 6 merges

The structural test proves the warnings clear; the existing suite is the regression net. This task closes the spec's remaining requirement: confirm each merged policy's distinct role paths are actually exercised with a positive (allowed) and negative (denied) assertion, and add a targeted test only where coverage is genuinely missing. The highest-risk, least-likely-covered path is the `citizens` UPDATE **self** branch (compound `citizen_type = 'player_character' AND user_id = current_app_user_id()`, in both `using` and `with check`) — a worked test for it is provided as the pattern.

**Files:**

- Audit (read-only): `supabase/tests/*.sql`
- Create (only if the audit finds a gap): `supabase/tests/<policy>_rls_test.sql`

**Interfaces:**

- Consumes: final policies from Task 2.
- Produces: nothing (verification only).

- [ ] **Step 1: Audit existing coverage per merged policy**

For each merged policy, list which role paths a test already exercises. Run:

```bash
grep -rln "citizen_memories\|nation_discoveries\|citizens_update\|worlds_select\|worlds_update\|users_select" supabase/tests/
grep -rn "current_app_user_id\|player_character" supabase/tests/citizen_visible_to_current_user_test.sql
```

Decision rule for each of the 6 merged policies, per distinct OR-branch (role path):

- A branch is **covered** if some pgTAP test both (a) makes an allowed access under that branch's role succeed AND (b) makes the same access denied for a role outside every branch.
- If a branch is **not covered**, it needs a targeted test in Step 2.
- `worlds` UPDATE world-admin path is already covered by `worlds_update_world_admin_test.sql` (positive + stranger-denied) — mark covered, no new test.
- `citizens` SELECT visibility is covered by `citizen_visible_to_current_user_test.sql`; that file does NOT exercise the `citizens` **UPDATE** self path — the UPDATE self branch is the expected gap.

Write the audit result as a short checklist comment in the PR description (6 policies × their branches, each marked covered / gap-filled).

- [ ] **Step 2: For each confirmed gap, add a targeted RLS test**

Follow the fixture and impersonation pattern from `supabase/tests/worlds_update_world_admin_test.sql`: insert `auth.users`, set up the table row, then per assertion `set local role authenticated;` and `set local "request.jwt.claims" = '{"sub":"<uuid>","role":"authenticated"}';`, and assert with `lives_ok(...)` (allowed) or by attempting the write and checking the row is unchanged (denied).

Worked example for the expected gap — `supabase/tests/citizens_update_self_rls_test.sql`:

```sql
-- pgTAP tests for the citizens UPDATE self branch after the RLS lint merge
-- (citizens_update_admin_or_self). Confirms a player_character's owner may
-- update their own citizen row, and a different authenticated user may not.
-- Run with: npx supabase test db
begin;

select
  plan (2);

-- --- Fixtures: two users, one world, one player_character citizen owned by user A ---
insert into
  auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('c5000000-0000-0000-0000-000000000001', 'cusr-owner@example.com', 'x', now(), '{"username":"cusr_owner"}'::jsonb, now(), now()),
  ('c5000000-0000-0000-0000-000000000002', 'cusr-other@example.com', 'x', now(), '{"username":"cusr_other"}'::jsonb, now(), now());

insert into
  public.worlds (id, name, status)
values
  ('c5100000-0000-0000-0000-000000000001', 'citizens-update-self world', 'active');

-- Owner's player_character citizen. Column set mirrors other citizens fixtures;
-- if db reset reports a NOT NULL / FK violation, copy the exact required columns
-- from an existing citizens insert in citizen_visible_to_current_user_test.sql.
insert into
  public.citizens (id, world_id, citizen_type, user_id, name)
values
  (
    'c5200000-0000-0000-0000-000000000001',
    'c5100000-0000-0000-0000-000000000001',
    'player_character',
    'c5000000-0000-0000-0000-000000000001',
    'Self Edit Target'
  );

-- --- Positive: owner may update own player_character citizen ---
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.citizens
    set name = 'Self Edited'
    where id = 'c5200000-0000-0000-0000-000000000001'
  $test$,
    'player_character owner can update their own citizen row'
  );

reset role;

-- --- Negative: a different authenticated user may not update it ---
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c5000000-0000-0000-0000-000000000002","role":"authenticated"}';

update public.citizens
set
  name = 'Hijacked'
where
  id = 'c5200000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.citizens
      where
        id = 'c5200000-0000-0000-0000-000000000001'
    ),
    'Self Edited',
    'a different authenticated user cannot update someone else''s citizen'
  );

select
  *
from
  finish ();

rollback;
```

- [ ] **Step 3: Run the new/updated tests**

```bash
npx supabase db reset
npx supabase test db 2>&1 | tail -20
```

Expected: all tests pass, including any gap-fill file added. If the `citizens` insert errors on a missing required column, add the columns shown by the error (cross-check `citizen_visible_to_current_user_test.sql`'s citizens insert) — do not weaken the assertions.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/
git commit -m "test(config): cover merged rls policy role paths"
```

---

## Task 4: Final verification and PR notes

- [ ] **Step 1: Clean full verification**

```bash
npx supabase db reset
npx supabase test db 2>&1 | tail -25
```

Expected: entire pgTAP suite green on a freshly reset DB.

- [ ] **Step 2: Confirm no typegen needed**

No table, column, view, or function-signature changed — only policy bodies. `src/types/database.ts` does not change. Do not run typegen.

- [ ] **Step 3: Record the four schema-change decisions for the PR body**

Include in the PR description:

- **Migration:** `20261121000000_rls_perf_lint_fixes.sql` — drops + recreates 9 policy sites.
- **RLS:** policies rewritten; access semantics unchanged (initplan wraps are evaluation-only; merges are exact OR-unions). Clears 4 `auth_rls_initplan` + 6 `multiple_permissive_policies` warnings.
- **DB test:** `rls_perf_lint_fixes_test.sql` (structural) + existing suite regression + the Task 3 coverage audit (paste the 6-policy checklist).
- **Typegen:** none — no schema shape change.

---

## Self-Review notes

- **Spec coverage:** initplan wraps (4) → Task 2 + Task 1 structural assertions. Merges (6) → Task 2 + Task 1 count assertions. Behavior preservation → Task 2 Step 3 full-suite run + Task 3 audit. Verification checklist (migration/RLS/test/typegen) → Task 4. No spec section is unaddressed.
- **Policy name changes:** merged policies are renamed to reflect their combined scope (`citizen_memories_select_admin`, `citizens_update_admin_or_self`, `nation_discoveries_select_admin_or_member`, `users_select_self_or_super_admin`, `worlds_select_member_or_admin`, `worlds_update_admin`). Category-A policies keep their original names (`world_admins_select`, `users_update_own`, `notifications_select_recipient`). Task 1's structural test references these exact names — kept consistent across tasks.
- **No silent scope cap:** Task 3 explicitly documents which merged policies are already covered vs gap-filled rather than skipping the audit.
