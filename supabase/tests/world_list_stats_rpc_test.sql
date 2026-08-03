-- pgTAP tests for the get_world_list_stats RPC.
-- Run with: npx supabase test db
begin;

select
  plan (7);

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
    'd0000000-0000-0000-0000-000000000001',
    'wls-superadmin@example.com',
    'x',
    now(),
    '{"username":"wls_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'wls-member@example.com',
    'x',
    now(),
    '{"username":"wls_member"}'::jsonb,
    now(),
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'wls-outsider@example.com',
    'x',
    now(),
    '{"username":"wls_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd0000000-0000-0000-0000-000000000001';

-- World A: has PCs and transitions; the member has a PC here (world access).
-- World B: no PCs and no transitions (empty-state coverage).
insert into
  public.worlds (id, name, status)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'WLS World A',
    'active'
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'WLS World B',
    'active'
  );

-- World A citizens: 2 alive PCs (counted), 1 dead PC (excluded), 1 alive NPC
-- (excluded). The member's PC grants them world access to World A.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    death_cause_category
  )
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'player_character',
    'WLS PC Alive One',
    'alive',
    'd0000000-0000-0000-0000-000000000002',
    null
  ),
  (
    'd5000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001',
    'player_character',
    'WLS PC Alive Two',
    'alive',
    'd0000000-0000-0000-0000-000000000002',
    null
  ),
  (
    'd5000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000001',
    'player_character',
    'WLS PC Dead',
    'dead',
    'd0000000-0000-0000-0000-000000000002',
    'unknown'
  );

insert into
  public.citizens (id, world_id, citizen_type, given_name, status)
values
  (
    'd5000000-0000-0000-0000-000000000004',
    'd1000000-0000-0000-0000-000000000001',
    'npc',
    'WLS NPC',
    'alive'
  );

-- World A transitions: latest started_at is the second row.
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    started_at
  )
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    1,
    2,
    'd0000000-0000-0000-0000-000000000001',
    'completed',
    '2026-01-01T00:00:00Z'
  ),
  (
    'd6000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001',
    2,
    3,
    'd0000000-0000-0000-0000-000000000001',
    'completed',
    '2026-02-01T00:00:00Z'
  );

-- ===========================================================================
-- Super admin sees both worlds with correct aggregates.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        player_character_count
      from
        public.get_world_list_stats ()
      where
        world_id = 'd1000000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'super admin: counts only alive player characters in World A'
  );

select
  is (
    (
      select
        last_transition_at
      from
        public.get_world_list_stats ()
      where
        world_id = 'd1000000-0000-0000-0000-000000000001'
    ),
    '2026-02-01T00:00:00Z'::timestamptz,
    'super admin: last_transition_at is the most recent started_at for World A'
  );

select
  is (
    (
      select
        player_character_count
      from
        public.get_world_list_stats ()
      where
        world_id = 'd1000000-0000-0000-0000-000000000002'
    ),
    0::bigint,
    'super admin: World B with no citizens reports a zero player-character count'
  );

select
  is (
    (
      select
        last_transition_at
      from
        public.get_world_list_stats ()
      where
        world_id = 'd1000000-0000-0000-0000-000000000002'
    ),
    null,
    'super admin: World B with no transitions reports a null last_transition_at'
  );

reset role;

-- ===========================================================================
-- Member (player character in World A) sees World A with complete counts and
-- does not see World B.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        player_character_count
      from
        public.get_world_list_stats ()
      where
        world_id = 'd1000000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'member: sees the complete player-character count for their accessible world'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.get_world_list_stats ()
      where
        world_id = 'd1000000-0000-0000-0000-000000000002'
    ),
    0,
    'member: does not receive stats for a world they cannot access'
  );

reset role;

-- ===========================================================================
-- Outsider (no world access) receives no rows.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.get_world_list_stats ()
    ),
    0,
    'outsider: receives no world stats'
  );

reset role;

select
  *
from
  finish ();

rollback;
