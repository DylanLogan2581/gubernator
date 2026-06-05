-- pgTAP tests for rename_world and set_world_current_turn_number RPCs.
-- Both RPCs require is_super_admin(); non-super-admin callers receive 42501.
-- set_world_current_turn_number must not insert into turn_log_entries or notifications.
-- Run with: npx supabase test db
--
-- UUID prefix map (de-prefixed ranges, unique to this file):
--   de100000 = users   de200000 = worlds   de300000 = nations   de400000 = settlements
begin;

select
  plan (19);

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
    'de100000-0000-0000-0000-000000000001',
    'de-superadmin@example.com',
    'x',
    now(),
    '{"username":"de_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'de100000-0000-0000-0000-000000000002',
    'de-user@example.com',
    'x',
    now(),
    '{"username":"de_user"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'de100000-0000-0000-0000-000000000001';

insert into
  public.worlds (
    id,
    name,
    owner_id,
    visibility,
    status,
    current_turn_number
  )
values
  (
    'de200000-0000-0000-0000-000000000001',
    'DE Rename World',
    'de100000-0000-0000-0000-000000000001',
    'private',
    'active',
    5
  ),
  (
    'de200000-0000-0000-0000-000000000002',
    'DE Turn World',
    'de100000-0000-0000-0000-000000000001',
    'private',
    'active',
    10
  ),
  (
    'de200000-0000-0000-0000-000000000003',
    'DE Snapshot World',
    'de100000-0000-0000-0000-000000000001',
    'private',
    'active',
    8
  );

-- Nation and settlement for snapshot conflict tests.
insert into
  public.nations (id, world_id, name)
values
  (
    'de300000-0000-0000-0000-000000000001',
    'de200000-0000-0000-0000-000000000003',
    'DE Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'de400000-0000-0000-0000-000000000001',
    'de300000-0000-0000-0000-000000000001',
    'DE Settlement'
  );

-- Snapshot at turn 7 to test conflict rejection when trying to set turn < 7.
insert into
  public.settlement_turn_snapshots (
    world_id,
    settlement_id,
    turn_number,
    population_total,
    population_npc,
    population_player_character,
    population_cap,
    turn_transition_id
  )
values
  (
    'de200000-0000-0000-0000-000000000003',
    'de400000-0000-0000-0000-000000000001',
    7,
    0,
    0,
    0,
    0,
    null
  );

-- ===========================================================================
-- Super-admin caller — rename_world happy paths
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- rename_world returns updated name
select
  is (
    (
      select
        w.name
      from
        public.rename_world (
          'de200000-0000-0000-0000-000000000001',
          'DE Renamed World'
        ) as w
    ),
    'DE Renamed World',
    'rename_world returns the new name'
  );

-- rename_world trims surrounding whitespace
select
  is (
    (
      select
        w.name
      from
        public.rename_world (
          'de200000-0000-0000-0000-000000000001',
          '  Trimmed Name  '
        ) as w
    ),
    'Trimmed Name',
    'rename_world trims surrounding whitespace from name'
  );

-- rename_world bumps updated_at
select
  ok (
    (
      select
        w.updated_at >= now() - interval '5 seconds'
      from
        public.rename_world (
          'de200000-0000-0000-0000-000000000001',
          'DE Updated At Check'
        ) as w
    ),
    'rename_world updates updated_at'
  );

-- ===========================================================================
-- Super-admin caller — set_world_current_turn_number happy paths
-- ===========================================================================
-- set_world_current_turn_number returns updated turn number
select
  is (
    (
      select
        w.current_turn_number
      from
        public.set_world_current_turn_number ('de200000-0000-0000-0000-000000000002', 3) as w
    ),
    3,
    'set_world_current_turn_number returns the new turn number'
  );

-- set_world_current_turn_number allows 0
select
  is (
    (
      select
        w.current_turn_number
      from
        public.set_world_current_turn_number ('de200000-0000-0000-0000-000000000002', 0) as w
    ),
    0,
    'set_world_current_turn_number accepts 0 as a valid turn number'
  );

-- set_world_current_turn_number accepts a value equal to the snapshot turn (no conflict)
select
  is (
    (
      select
        w.current_turn_number
      from
        public.set_world_current_turn_number ('de200000-0000-0000-0000-000000000003', 7) as w
    ),
    7,
    'set_world_current_turn_number accepts turn equal to max snapshot turn'
  );

-- set_world_current_turn_number accepts a value above the snapshot turn
select
  is (
    (
      select
        w.current_turn_number
      from
        public.set_world_current_turn_number ('de200000-0000-0000-0000-000000000003', 9) as w
    ),
    9,
    'set_world_current_turn_number accepts turn above max snapshot turn'
  );

-- ===========================================================================
-- set_world_current_turn_number — snapshot conflict rejection
-- ===========================================================================
-- Snapshot exists at turn 7; trying to set to 6 should raise 23514.
select
  throws_ok (
    $$
      select public.set_world_current_turn_number (
        'de200000-0000-0000-0000-000000000003',
        6
      )
    $$,
    '23514',
    null,
    'set_world_current_turn_number raises 23514 when snapshots exist at higher turns'
  );

-- ===========================================================================
-- set_world_current_turn_number — no log or notification side-effects
-- ===========================================================================
do $$
declare
  v_log_before   bigint;
  v_notif_before bigint;
  v_log_after    bigint;
  v_notif_after  bigint;
begin
  select count (*) into v_log_before from public.turn_log_entries;
  select count (*) into v_notif_before from public.notifications;

  perform public.set_world_current_turn_number (
    'de200000-0000-0000-0000-000000000002',
    4
  );

  select count (*) into v_log_after from public.turn_log_entries;
  select count (*) into v_notif_after from public.notifications;

  if v_log_after <> v_log_before then
    raise exception 'set_world_current_turn_number inserted % turn_log_entries row(s)', v_log_after - v_log_before;
  end if;

  if v_notif_after <> v_notif_before then
    raise exception 'set_world_current_turn_number inserted % notifications row(s)', v_notif_after - v_notif_before;
  end if;
end;
$$;

select
  ok (
    true,
    'set_world_current_turn_number wrote no turn_log_entries or notifications'
  );

-- ===========================================================================
-- Non-super-admin caller — 42501 for both RPCs
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $$
      select public.rename_world (
        'de200000-0000-0000-0000-000000000001',
        'Unauthorized Rename'
      )
    $$,
    '42501',
    null,
    'rename_world raises 42501 for non-super-admin caller'
  );

select
  throws_ok (
    $$
      select public.set_world_current_turn_number (
        'de200000-0000-0000-0000-000000000002',
        99
      )
    $$,
    '42501',
    null,
    'set_world_current_turn_number raises 42501 for non-super-admin caller'
  );

-- ===========================================================================
-- Null world id — P0002 (authorization not reached)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"de100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $$
      select public.rename_world (null::uuid, 'Some Name')
    $$,
    'P0002',
    null,
    'rename_world raises P0002 for null p_world_id'
  );

select
  throws_ok (
    $$
      select public.set_world_current_turn_number (null::uuid, 1)
    $$,
    'P0002',
    null,
    'set_world_current_turn_number raises P0002 for null p_world_id'
  );

-- ===========================================================================
-- Non-existent world id — P0002
-- ===========================================================================
select
  throws_ok (
    $$
      select public.rename_world (
        '00000000-0000-0000-0000-000000000000',
        'Ghost World'
      )
    $$,
    'P0002',
    null,
    'rename_world raises P0002 for non-existent world id'
  );

select
  throws_ok (
    $$
      select public.set_world_current_turn_number (
        '00000000-0000-0000-0000-000000000000',
        1
      )
    $$,
    'P0002',
    null,
    'set_world_current_turn_number raises P0002 for non-existent world id'
  );

-- ===========================================================================
-- Invalid inputs — 22000
-- ===========================================================================
select
  throws_ok (
    $$
      select public.rename_world (
        'de200000-0000-0000-0000-000000000001',
        ''
      )
    $$,
    '22000',
    null,
    'rename_world raises 22000 for empty name'
  );

select
  throws_ok (
    $$
      select public.rename_world (
        'de200000-0000-0000-0000-000000000001',
        '   '
      )
    $$,
    '22000',
    null,
    'rename_world raises 22000 for whitespace-only name'
  );

select
  throws_ok (
    $$
      select public.rename_world (
        'de200000-0000-0000-0000-000000000001',
        repeat('x', 65)
      )
    $$,
    '22000',
    null,
    'rename_world raises 22000 for name exceeding 64 characters'
  );

select
  throws_ok (
    $$
      select public.set_world_current_turn_number (
        'de200000-0000-0000-0000-000000000002',
        -1
      )
    $$,
    '22000',
    null,
    'set_world_current_turn_number raises 22000 for negative turn number'
  );

reset role;

select
  *
from
  finish ();

rollback;
