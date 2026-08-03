-- pgTAP tests for align_fk_delete_semantics_and_audit_columns migration.
-- Run with: npx supabase test db
--
-- Covers:
--   1. Deleting a nation cascades through the composite (id, world_id) FK on
--      nation_relationships without error (previously relied on the
--      single-column CASCADE FK racing ahead of the composite NO ACTION FK).
--   2. Deleting a citizen referenced as a parent sets the composite
--      (parent_*_citizen_id, world_id) FK to null on the child, matching the
--      single-column ON DELETE SET NULL semantics, and does not cascade the
--      child row itself.
--   3. Deleting an auth user referenced by partnerships.changed_by_user_id
--      (nullable audit column) succeeds and clears the column to null.
--   4. Deleting an auth user referenced by turn_transitions.initiated_by_user_id
--      (NOT NULL audit column) is still rejected -- documents the decision
--      that this column stays ON DELETE RESTRICT by design.
begin;

-- This file's fixtures create a running turn transition and then write
-- world-scoped tables directly, which the turn-write guard added in
-- 20261223000000 rejects. Take the guard's escape hatch for the whole
-- transaction: the guard itself is covered by
-- reject_writes_during_turn_transition_test.sql.
set
  local "app.applying_turn" = 'on';

select
  plan (9);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'f0000000-0000-0000-0000-000000000001',
    'fk-semantics-set-null@example.com',
    'x',
    now(),
    '{"username":"fk_semantics_set_null"}'::jsonb,
    now(),
    now()
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'fk-semantics-restrict@example.com',
    'x',
    now(),
    '{"username":"fk_semantics_restrict"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'FK Semantics World',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f2000000-0000-0000-0000-00000000000a',
    'f1000000-0000-0000-0000-000000000001',
    'FK Semantics Nation A'
  ),
  (
    'f2000000-0000-0000-0000-00000000000b',
    'f1000000-0000-0000-0000-000000000001',
    'FK Semantics Nation B'
  );

insert into
  public.nation_relationships (
    id,
    from_nation_id,
    to_nation_id,
    world_id,
    current_stance
  )
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-00000000000a',
    'f2000000-0000-0000-0000-00000000000b',
    'f1000000-0000-0000-0000-000000000001',
    'neutral'
  );

insert into
  public.citizens (id, world_id, citizen_type, given_name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'npc',
    'FK Semantics Parent'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'npc',
    'FK Semantics Child'
  );

update public.citizens
set
  parent_a_citizen_id = 'f4000000-0000-0000-0000-000000000001'
where
  id = 'f4000000-0000-0000-0000-000000000002';

insert into
  public.citizens (id, world_id, citizen_type, given_name)
values
  (
    'f4000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000001',
    'npc',
    'FK Semantics Partner A'
  ),
  (
    'f4000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000001',
    'npc',
    'FK Semantics Partner B'
  );

insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    formed_on_turn_number,
    changed_by_user_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000003',
    'f4000000-0000-0000-0000-000000000004',
    1,
    'f0000000-0000-0000-0000-000000000001'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    0,
    1,
    'f0000000-0000-0000-0000-000000000002',
    'running'
  );

-- ---------------------------------------------------------------------------
-- 1. Deleting a nation cascades through the composite FK (nation/nation_relationships)
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    delete from public.nations where id = 'f2000000-0000-0000-0000-00000000000a'
    $test$,
    'deleting nation A does not error out on the composite nation_relationships FK'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.nation_relationships
      where
        id = 'f3000000-0000-0000-0000-000000000001'
    ),
    'nation_relationships row is cascaded when either participant nation is deleted'
  );

-- ---------------------------------------------------------------------------
-- 2. Deleting a citizen sets the composite parent FK to null (citizen/citizen parents)
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    delete from public.citizens where id = 'f4000000-0000-0000-0000-000000000001'
    $test$,
    'deleting a parent citizen does not error out on the composite parent FK'
  );

select
  ok (
    exists (
      select
        1
      from
        public.citizens
      where
        id = 'f4000000-0000-0000-0000-000000000002'
    ),
    'child citizen row is retained (not cascaded) after parent deletion'
  );

select
  is (
    (
      select
        parent_a_citizen_id
      from
        public.citizens
      where
        id = 'f4000000-0000-0000-0000-000000000002'
    ),
    null,
    'child citizen parent_a_citizen_id is set null after parent deletion'
  );

-- ---------------------------------------------------------------------------
-- 3. Deleting a user referenced only by partnerships.changed_by_user_id (nullable
--    audit column) succeeds and clears attribution.
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    delete from auth.users where id = 'f0000000-0000-0000-0000-000000000001'
    $test$,
    'deleting a user referenced by partnerships.changed_by_user_id succeeds'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.users
      where
        id = 'f0000000-0000-0000-0000-000000000001'
    ),
    'public.users row cascades from the auth.users delete'
  );

select
  is (
    (
      select
        changed_by_user_id
      from
        public.partnerships
      where
        id = 'f5000000-0000-0000-0000-000000000001'
    ),
    null,
    'partnerships.changed_by_user_id is set null after the referenced user is deleted'
  );

-- ---------------------------------------------------------------------------
-- 4. Deleting a user referenced by turn_transitions.initiated_by_user_id (NOT
--    NULL audit column) stays restricted by design.
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    delete from auth.users where id = 'f0000000-0000-0000-0000-000000000002'
    $test$,
    '23503',
    null,
    'deleting a user referenced by turn_transitions.initiated_by_user_id is restricted'
  );

select
  finish ();

rollback;
