-- pgTAP tests for current_user_player_character_world_ids().
-- Run with: npx supabase test db
begin;

select
  plan (4);

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
    'dd000000-0000-0000-0000-000000000001',
    'pcwids-user@example.com',
    'x',
    now(),
    '{"username":"pcwids_user"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd000000-0000-0000-0000-000000000002',
    'pcwids-nopc@example.com',
    'x',
    now(),
    '{"username":"pcwids_nopc"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'dd100000-0000-0000-0000-000000000001',
    'PC World Ids World A',
    'private',
    'active'
  ),
  (
    'dd100000-0000-0000-0000-000000000002',
    'PC World Ids World B',
    'private',
    'active'
  );

-- Two living PCs in world A (same world — should deduplicate to one row).
-- One living PC in world B.
-- One dead PC in world A (must be excluded).
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
    'dd500000-0000-0000-0000-000000000001',
    'dd100000-0000-0000-0000-000000000001',
    'player_character',
    'PC Alpha',
    'alive',
    'dd000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'dd500000-0000-0000-0000-000000000002',
    'dd100000-0000-0000-0000-000000000001',
    'player_character',
    'PC Beta',
    'alive',
    'dd000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'dd500000-0000-0000-0000-000000000003',
    'dd100000-0000-0000-0000-000000000002',
    'player_character',
    'PC Gamma',
    'alive',
    'dd000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'dd500000-0000-0000-0000-000000000004',
    'dd100000-0000-0000-0000-000000000001',
    'player_character',
    'PC Dead',
    'dead',
    'dd000000-0000-0000-0000-000000000001',
    'unknown'
  );

-- ===========================================================================
-- Happy path: user with 2 living PCs in world A and 1 in world B → 2 rows
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_world_ids ()
    ),
    2,
    'returns exactly 2 distinct world ids for a user with PCs in 2 worlds'
  );

select
  ok (
    exists (
      select
        1
      from
        public.current_user_player_character_world_ids () as w (world_id)
      where
        w.world_id = 'dd100000-0000-0000-0000-000000000001'
    ),
    'world A is included in the result set'
  );

select
  ok (
    exists (
      select
        1
      from
        public.current_user_player_character_world_ids () as w (world_id)
      where
        w.world_id = 'dd100000-0000-0000-0000-000000000002'
    ),
    'world B is included in the result set'
  );

reset role;

-- ===========================================================================
-- Empty-set path: user with no living PCs returns 0 rows
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.current_user_player_character_world_ids ()
    ),
    0,
    'returns 0 rows for a user with no living player characters'
  );

reset role;

select
  *
from
  finish ();

rollback;
