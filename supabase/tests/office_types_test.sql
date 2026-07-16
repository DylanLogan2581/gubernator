-- pgTAP tests for public.office_types (#1114): world-default seeding on
-- world creation, RLS authority (world/super admin for nation_id-null rows,
-- nation manager for nation-owned custom rows), delete-blocked-while-holders,
-- and max_holders enforcement in appoint_nation_office.
-- Run with: npx supabase test db
begin;

select
  plan (13);

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
    'ab000000-0000-0000-0000-000000000001',
    'ot-admin@example.com',
    'x',
    now(),
    '{"username":"ot_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ab000000-0000-0000-0000-000000000002',
    'ot-manager@example.com',
    'x',
    now(),
    '{"username":"ot_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'ab000000-0000-0000-0000-000000000003',
    'ot-outsider@example.com',
    'x',
    now(),
    '{"username":"ot_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'ab000000-0000-0000-0000-000000000004',
    'ot-other-manager@example.com',
    'x',
    now(),
    '{"username":"ot_other_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'ac000000-0000-0000-0000-000000000001',
    'Office Types World',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ac000000-0000-0000-0000-000000000001',
    'ab000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'ad000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000001',
    'Custom Office Nation',
    'republic'
  ),
  (
    'ad000000-0000-0000-0000-000000000002',
    'ac000000-0000-0000-0000-000000000001',
    'Other Nation',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ae000000-0000-0000-0000-000000000001',
    'ad000000-0000-0000-0000-000000000001',
    'Custom Office Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id,
    death_cause_category
  )
values
  (
    'af000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'Manager',
    'alive',
    'ab000000-0000-0000-0000-000000000002',
    'nation_manager',
    'ad000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'af000000-0000-0000-0000-000000000002',
    'ac000000-0000-0000-0000-000000000001',
    'ae000000-0000-0000-0000-000000000001',
    'npc',
    'Holder One',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'af000000-0000-0000-0000-000000000003',
    'ac000000-0000-0000-0000-000000000001',
    'ae000000-0000-0000-0000-000000000001',
    'npc',
    'Holder Two',
    'alive',
    null,
    'none',
    null,
    null
  );

-- ===========================================================================
-- World-default seeding: creating the world above auto-seeded the seven
-- Epic 11 default office types via the worlds_seed_default_office_types
-- trigger.
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.office_types
      where
        world_id = 'ac000000-0000-0000-0000-000000000001'
        and nation_id is null
    ),
    7,
    'creating a world auto-seeds the seven default office types'
  );

-- ===========================================================================
-- SELECT: world members can read; outsiders with no world access cannot.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.office_types
      where
        world_id = 'ac000000-0000-0000-0000-000000000001'
    ),
    7,
    'a world member can select office_types rows'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.office_types
      where
        world_id = 'ac000000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no world access cannot select office_types rows'
  );

reset role;

-- ===========================================================================
-- INSERT: world admin can create a world-default type; a plain world member
-- cannot; a nation manager can create a custom type for their own nation but
-- not for another nation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.office_types (world_id, nation_id, name, scope)
    values ('ac000000-0000-0000-0000-000000000001', null, 'archon', 'nation')
  $test$,
    '42501',
    null,
    'a non-admin world member cannot create a world-default office type'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  public.office_types (id, world_id, nation_id, name, scope)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000001',
    null,
    'archon',
    'nation'
  );

reset role;

select
  is (
    (
      select
        name
      from
        public.office_types
      where
        id = 'b0000000-0000-0000-0000-000000000001'
    ),
    'archon',
    'a world admin can create a world-default office type'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.office_types (world_id, nation_id, name, scope, max_holders)
    values (
      'ac000000-0000-0000-0000-000000000001',
      'ad000000-0000-0000-0000-000000000002',
      'Night Watch Commander',
      'nation',
      1
    )
  $test$,
    '42501',
    null,
    'a nation manager cannot create a custom office type for another nation'
  );

insert into
  public.office_types (
    id,
    world_id,
    nation_id,
    name,
    description,
    scope,
    max_holders,
    excludes_from_labor
  )
values
  (
    'b0000000-0000-0000-0000-000000000002',
    'ac000000-0000-0000-0000-000000000001',
    'ad000000-0000-0000-0000-000000000001',
    'Lord Commander of the Night Watch',
    'Player-invented custom office.',
    'nation',
    1,
    false
  );

reset role;

select
  is (
    (
      select
        row (excludes_from_labor, max_holders)
      from
        public.office_types
      where
        id = 'b0000000-0000-0000-0000-000000000002'
    ),
    row (false, 1),
    'a nation manager can invent a custom office type for their own nation'
  );

-- ===========================================================================
-- #1147: a custom office type named after a world-default ("bank_governor")
-- is a distinct row (office_types_world_owner_name_idx allows the
-- collision); holding it must not grant the default's authority, because
-- current_user_holds_nation_office is always called with a hardcoded
-- default name literal (e.g. 'bank_governor') by callers that mean the
-- world-default office specifically.
-- ===========================================================================
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    death_cause_category
  )
values
  (
    'af000000-0000-0000-0000-000000000004',
    'ac000000-0000-0000-0000-000000000001',
    'ae000000-0000-0000-0000-000000000001',
    'player_character',
    'Shadow Holder',
    'alive',
    'ab000000-0000-0000-0000-000000000002',
    'none',
    null
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  public.office_types (id, world_id, nation_id, name, scope)
values
  (
    'b0000000-0000-0000-0000-000000000003',
    'ac000000-0000-0000-0000-000000000001',
    'ad000000-0000-0000-0000-000000000001',
    'bank_governor',
    'nation'
  );

select
  public.appoint_nation_office (
    'ad000000-0000-0000-0000-000000000001'::uuid,
    'bank_governor',
    'af000000-0000-0000-0000-000000000004'::uuid
  );

select
  is (
    public.current_user_holds_nation_office (
      'ad000000-0000-0000-0000-000000000001'::uuid,
      'bank_governor'
    ),
    false,
    'holding a custom office type shadowing the bank_governor default grants no default authority'
  );

reset role;

-- ===========================================================================
-- UPDATE: nation manager can edit their own custom type; cannot edit a
-- world-default type (silently ignored by RLS).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

update public.office_types
set
  description = 'Commands the Wall.'
where
  id = 'b0000000-0000-0000-0000-000000000002';

update public.office_types
set
  description = 'Hijacked by a nation manager.'
where
  id = 'b0000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        description
      from
        public.office_types
      where
        id = 'b0000000-0000-0000-0000-000000000002'
    ),
    'Commands the Wall.',
    'a nation manager can update their own custom office type'
  );

select
  is (
    (
      select
        description
      from
        public.office_types
      where
        id = 'b0000000-0000-0000-0000-000000000001'
    ),
    null,
    'a nation manager updating a world-default office type is silently ignored by RLS'
  );

-- ===========================================================================
-- max_holders: enforced by appoint_nation_office for the custom office type
-- created above (max_holders = 1).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.appoint_nation_office (
    'ad000000-0000-0000-0000-000000000001'::uuid,
    'Lord Commander of the Night Watch',
    'af000000-0000-0000-0000-000000000002'::uuid
  );

select
  throws_ok (
    $test$
    select public.appoint_nation_office(
      'ad000000-0000-0000-0000-000000000001'::uuid,
      'Lord Commander of the Night Watch',
      'af000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '22023',
    null,
    'max_holders is enforced: a second holder is rejected once the cap is reached'
  );

reset role;

-- ===========================================================================
-- DELETE: blocked while holders exist, allowed once the holder is dismissed.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

delete from public.office_types
where
  id = 'b0000000-0000-0000-0000-000000000002';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.office_types
      where
        id = 'b0000000-0000-0000-0000-000000000002'
    ),
    'deleting a custom office type with active holders is blocked'
  );

delete from public.nation_offices
where
  office_type_id = 'b0000000-0000-0000-0000-000000000002';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}';

delete from public.office_types
where
  id = 'b0000000-0000-0000-0000-000000000002';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.office_types
      where
        id = 'b0000000-0000-0000-0000-000000000002'
    ),
    0,
    'a custom office type with no holders can be deleted by the nation manager'
  );

select
  *
from
  finish ();

rollback;
