-- pgTAP tests for public.citizen_visible_to_current_user(uuid).
-- Run with: npx supabase test db
--
-- The function is SECURITY DEFINER and encapsulates the citizens visibility
-- predicate. An error in its logic bypasses citizens RLS entirely and would
-- not be caught by the existing citizens or partnerships RLS tests.
--
-- The Nation Manager and Settlement Manager player_characters in these
-- fixtures live in a separate world (World B) from the citizen under test
-- (World A). This isolates the manager visibility paths from the broader
-- PC-holder visibility rule so the "manager can see" assertions exercise
-- manager scoping rather than being shadowed by user_has_player_character_in_world.
--
-- World A is public so the settlements subquery inside the helper (which uses
-- has_world_access) can succeed for manager users whose PCs live in World B.
begin;

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
    'f1000000-0000-0000-0000-000000000001',
    'cvtcu-owner@example.com',
    'x',
    now(),
    '{"username":"cvtcu_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'cvtcu-world-admin@example.com',
    'x',
    now(),
    '{"username":"cvtcu_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'cvtcu-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"cvtcu_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'cvtcu-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"cvtcu_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000005',
    'cvtcu-pc-holder@example.com',
    'x',
    now(),
    '{"username":"cvtcu_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000006',
    'cvtcu-unrelated@example.com',
    'x',
    now(),
    '{"username":"cvtcu_unrelated"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000007',
    'cvtcu-superadmin@example.com',
    'x',
    now(),
    '{"username":"cvtcu_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1000000-0000-0000-0000-000000000007';

-- World A: subject world; target citizen lives here. Set to public so the
-- settlements subquery in the helper (which uses has_world_access) can
-- succeed for manager users whose PCs live in World B.
-- World B: holds manager users' player characters so manager visibility
--          paths can be tested without triggering user_has_player_character_in_world
--          for World A.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'CVTCU World A',
    'public',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'CVTCU World B (manager PCs)',
    'public',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CVTCU Nation A'
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'CVTCU Nation B (host of manager PCs)'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'CVTCU Settlement A1'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000002',
    'CVTCU Settlement B1 (manager PCs)'
  );

-- Target NPC in World A, Settlement A1: used to verify NPC is invisible to
-- non-admin callers.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'f5000000-0000-0000-0000-000000000010',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'CVTCU Target NPC',
    'alive'
  );

-- Target PC in World A, Settlement A1: used to verify player_character rows
-- remain visible to non-admin callers under the manager and PC-holder paths.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000011',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'player_character',
    'CVTCU Target PC',
    'alive',
    'f1000000-0000-0000-0000-000000000006'
  );

-- Nation Manager's PC lives in World B but governs Nation A in World A.
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
    role_nation_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000002',
    'f4000000-0000-0000-0000-000000000002',
    'player_character',
    'CVTCU Nation Manager (lives in World B)',
    'alive',
    'f1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'f3000000-0000-0000-0000-000000000001'
  );

-- Settlement Manager's PC lives in World B but governs Settlement A1 in World A.
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
    role_settlement_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'f4000000-0000-0000-0000-000000000002',
    'player_character',
    'CVTCU Settlement Manager (lives in World B)',
    'alive',
    'f1000000-0000-0000-0000-000000000004',
    'settlement_manager',
    'f4000000-0000-0000-0000-000000000001'
  );

-- PC holder's citizen in World A: grants the user broad visibility via
-- user_has_player_character_in_world.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'player_character',
    'CVTCU PC Holder (in World A)',
    'alive',
    'f1000000-0000-0000-0000-000000000005'
  );

-- ===========================================================================
-- SUPER ADMIN: sees any citizen regardless of world membership.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000010'::uuid),
    true,
    'super admin can see the citizen'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: sees citizens in the administered world.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000010'::uuid),
    true,
    'world admin can see a citizen in the administered world'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: NPC is not visible; PC in their settlement is visible.
-- Manager's PC is in World B; visibility into World A comes solely from the
-- nation manager path.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000010'::uuid),
    false,
    'nation manager cannot see NPC in a settlement within their nation'
  );

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000011'::uuid),
    true,
    'nation manager can see PC in a settlement within their nation'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: NPC is not visible; PC in their settlement is visible.
-- Manager's PC is in World B, so the PC-holder rule does not broaden
-- visibility into World A.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000010'::uuid),
    false,
    'settlement manager cannot see NPC in their settlement'
  );

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000011'::uuid),
    true,
    'settlement manager can see PC in their settlement'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: NPC is not visible; PC in same world is visible.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000010'::uuid),
    false,
    'pc holder in the same world cannot see NPC'
  );

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000011'::uuid),
    true,
    'pc holder in the same world can see PC'
  );

reset role;

-- ===========================================================================
-- UNRELATED USER: no relationship to the world — must not see the citizen.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    public.citizen_visible_to_current_user ('f5000000-0000-0000-0000-000000000010'::uuid),
    false,
    'unrelated user cannot see the citizen'
  );

reset role;

select
  *
from
  finish ();

rollback;
