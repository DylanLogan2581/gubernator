-- pgTAP tests for the composite FK same-world invariants added in migration
-- 20260528000010. Run with: npx supabase test db
--
-- Covers:
--   nation_relationships composite FKs (migration 20260528000010):
--     • inserting a relationship between nations in the same world succeeds
--     • inserting a relationship between nations in different worlds raises 23503
--
--   citizens composite FKs (migration 20260528000010):
--     • inserting a citizen with parent_a in the same world succeeds
--     • inserting a citizen with parent_a in a different world raises 23503
--     • inserting a citizen with parent_b in the same world succeeds
--     • inserting a citizen with parent_b in a different world raises 23503
begin;

select
  plan (6);

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
    'd6000000-0000-0000-0000-000000000001',
    'cross-world-owner@example.com',
    'x',
    now(),
    '{"username":"cross_world_owner"}'::jsonb,
    now(),
    now()
  );

-- World 1: home world for same-world assertions.
-- World 2: foreign world used as the cross-world source.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'd7000000-0000-0000-0000-000000000001',
    'Cross-World World 1',
    'd6000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'd7000000-0000-0000-0000-000000000002',
    'Cross-World World 2',
    'd6000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd8000000-0000-0000-0000-00000000000a',
    'd7000000-0000-0000-0000-000000000001',
    'Nation A (World 1)'
  ),
  (
    'd8000000-0000-0000-0000-00000000000b',
    'd7000000-0000-0000-0000-000000000001',
    'Nation B (World 1)'
  ),
  (
    'd8000000-0000-0000-0000-00000000000c',
    'd7000000-0000-0000-0000-000000000002',
    'Nation C (World 2)'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd9000000-0000-0000-0000-0000000000a1',
    'd8000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  );

-- Two parents in World 1, one parent in World 2 (for cross-world rejection).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status
  )
values
  (
    'da000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000001',
    'd9000000-0000-0000-0000-0000000000a1',
    'npc',
    'Parent A (World 1)',
    'alive'
  ),
  (
    'da000000-0000-0000-0000-000000000002',
    'd7000000-0000-0000-0000-000000000001',
    'd9000000-0000-0000-0000-0000000000a1',
    'npc',
    'Parent B (World 1)',
    'alive'
  ),
  (
    'da000000-0000-0000-0000-000000000003',
    'd7000000-0000-0000-0000-000000000002',
    null,
    'npc',
    'Foreign Parent (World 2)',
    'alive'
  );

-- ===========================================================================
-- nation_relationships composite FK same-world invariant
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.nation_relationships (from_nation_id, to_nation_id)
    values (
      'd8000000-0000-0000-0000-00000000000a',
      'd8000000-0000-0000-0000-00000000000b'
    )
  $test$,
    'same-world nation relationship insert succeeds'
  );

select
  throws_ok (
    $test$
    insert into public.nation_relationships (from_nation_id, to_nation_id)
    values (
      'd8000000-0000-0000-0000-00000000000a',
      'd8000000-0000-0000-0000-00000000000c'
    )
  $test$,
    '23503',
    null,
    'cross-world nation relationship insert raises 23503'
  );

-- ===========================================================================
-- citizens composite FK same-world parent invariant
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.citizens (
      world_id, settlement_id, citizen_type, name, status, parent_a_citizen_id
    ) values (
      'd7000000-0000-0000-0000-000000000001',
      'd9000000-0000-0000-0000-0000000000a1',
      'npc',
      'Child With Same-World Parent A',
      'alive',
      'da000000-0000-0000-0000-000000000001'
    )
  $test$,
    'citizen insert with same-world parent_a succeeds'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, settlement_id, citizen_type, name, status, parent_a_citizen_id
    ) values (
      'd7000000-0000-0000-0000-000000000001',
      'd9000000-0000-0000-0000-0000000000a1',
      'npc',
      'Child With Cross-World Parent A',
      'alive',
      'da000000-0000-0000-0000-000000000003'
    )
  $test$,
    '23503',
    null,
    'citizen insert with cross-world parent_a raises 23503'
  );

select
  lives_ok (
    $test$
    insert into public.citizens (
      world_id, settlement_id, citizen_type, name, status, parent_b_citizen_id
    ) values (
      'd7000000-0000-0000-0000-000000000001',
      'd9000000-0000-0000-0000-0000000000a1',
      'npc',
      'Child With Same-World Parent B',
      'alive',
      'da000000-0000-0000-0000-000000000002'
    )
  $test$,
    'citizen insert with same-world parent_b succeeds'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (
      world_id, settlement_id, citizen_type, name, status, parent_b_citizen_id
    ) values (
      'd7000000-0000-0000-0000-000000000001',
      'd9000000-0000-0000-0000-0000000000a1',
      'npc',
      'Child With Cross-World Parent B',
      'alive',
      'da000000-0000-0000-0000-000000000003'
    )
  $test$,
    '23503',
    null,
    'citizen insert with cross-world parent_b raises 23503'
  );

select
  *
from
  finish ();

rollback;
