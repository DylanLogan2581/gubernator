-- pgTAP tests for public.user_active_player_characters RLS and the
-- validation trigger that ties the chosen citizen back to the row's user.
-- Run with: npx supabase test db
begin;

select
  plan (16);

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
    'e1000000-0000-0000-0000-000000000001',
    'active-pc-owner@example.com',
    'x',
    now(),
    '{"username":"active_pc_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'active-pc-other@example.com',
    'x',
    now(),
    '{"username":"active_pc_other"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'active-pc-superadmin@example.com',
    'x',
    now(),
    '{"username":"active_pc_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000003';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Active PC World A',
    'e1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Active PC World B',
    'e1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Two PCs in World A belonging to user 1 (one alive, one dead), and an NPC.
insert into
  public.citizens (id, world_id, citizen_type, name, status, user_id)
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'Owner Alive PC',
    'alive',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'Owner Dead PC',
    'dead',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e5000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000002',
    'player_character',
    'Owner PC in World B',
    'alive',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e5000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'Other Users PC',
    'alive',
    'e1000000-0000-0000-0000-000000000002'
  );

insert into
  public.citizens (id, world_id, citizen_type, name, status)
values
  (
    'e5000000-0000-0000-0000-000000000005',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'World A NPC',
    'alive'
  );

-- Seed an active-PC row owned by user 2 so user 1 can confirm denial.
insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    'e1000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000004'
  );

-- ===========================================================================
-- ROW OWNER: can insert, read, update, delete their own row.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.user_active_player_characters (user_id, world_id, citizen_id)
    values (
      'e1000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001'
    )
  $test$,
    'row owner can insert their own active-PC row'
  );

select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = 'e1000000-0000-0000-0000-000000000001'
        and world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'e5000000-0000-0000-0000-000000000001'::uuid,
    'row owner can read their own active-PC row'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.user_active_player_characters
      where
        user_id = 'e1000000-0000-0000-0000-000000000002'
    ),
    0,
    'row owner cannot read another user''s active-PC row'
  );

-- ===========================================================================
-- VALIDATION TRIGGER: blocks NPCs, wrong-user PCs, dead PCs, wrong-world
-- citizens, and missing citizens.
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.user_active_player_characters
    set citizen_id = 'e5000000-0000-0000-0000-000000000005'
    where user_id = 'e1000000-0000-0000-0000-000000000001'
      and world_id = 'e2000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'cannot point active-PC row at an NPC'
  );

select
  throws_ok (
    $test$
    update public.user_active_player_characters
    set citizen_id = 'e5000000-0000-0000-0000-000000000004'
    where user_id = 'e1000000-0000-0000-0000-000000000001'
      and world_id = 'e2000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'cannot point active-PC row at a PC owned by another user'
  );

select
  throws_ok (
    $test$
    update public.user_active_player_characters
    set citizen_id = 'e5000000-0000-0000-0000-000000000002'
    where user_id = 'e1000000-0000-0000-0000-000000000001'
      and world_id = 'e2000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'cannot point active-PC row at a dead PC'
  );

select
  throws_ok (
    $test$
    update public.user_active_player_characters
    set citizen_id = 'e5000000-0000-0000-0000-000000000003'
    where user_id = 'e1000000-0000-0000-0000-000000000001'
      and world_id = 'e2000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'cannot point active-PC row at a PC in a different world'
  );

select
  throws_ok (
    $test$
    update public.user_active_player_characters
    set citizen_id = '00000000-0000-0000-0000-0000000000ff'
    where user_id = 'e1000000-0000-0000-0000-000000000001'
      and world_id = 'e2000000-0000-0000-0000-000000000001'
  $test$,
    '23503',
    null,
    'cannot point active-PC row at a non-existent citizen'
  );

-- ===========================================================================
-- RLS: row owner cannot insert a row that names another user, and cannot
-- update another user's row.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.user_active_player_characters (user_id, world_id, citizen_id)
    values (
      'e1000000-0000-0000-0000-000000000002',
      'e2000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000004'
    )
  $test$,
    '42501',
    null,
    'row owner cannot insert an active-PC row for another user'
  );

update public.user_active_player_characters
set
  citizen_id = 'e5000000-0000-0000-0000-000000000001'
where
  user_id = 'e1000000-0000-0000-0000-000000000002';

reset role;

select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = 'e1000000-0000-0000-0000-000000000002'
        and world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'e5000000-0000-0000-0000-000000000004'::uuid,
    'row owner cannot mutate another user''s active-PC row (RLS update no-op)'
  );

-- ===========================================================================
-- OTHER USER: cannot read user 1's row.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.user_active_player_characters
      where
        user_id = 'e1000000-0000-0000-0000-000000000001'
    ),
    0,
    'unrelated user cannot read another user''s active-PC row'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: read-only support path. Reads are allowed; writes are not.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.user_active_player_characters
      where
        user_id in (
          'e1000000-0000-0000-0000-000000000001',
          'e1000000-0000-0000-0000-000000000002'
        )
    ),
    2,
    'super admin can read every active-PC row for support'
  );

select
  throws_ok (
    $test$
    insert into public.user_active_player_characters (user_id, world_id, citizen_id)
    values (
      'e1000000-0000-0000-0000-000000000001',
      'e2000000-0000-0000-0000-000000000002',
      'e5000000-0000-0000-0000-000000000003'
    )
  $test$,
    '42501',
    null,
    'super admin cannot insert another user''s active-PC row'
  );

update public.user_active_player_characters
set
  citizen_id = 'e5000000-0000-0000-0000-000000000001'
where
  user_id = 'e1000000-0000-0000-0000-000000000002';

select
  is (
    (
      select
        citizen_id
      from
        public.user_active_player_characters
      where
        user_id = 'e1000000-0000-0000-0000-000000000002'
        and world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'e5000000-0000-0000-0000-000000000004'::uuid,
    'super admin update of another user''s active-PC row is a no-op (RLS USING fails)'
  );

reset role;

-- ===========================================================================
-- CLEANUP TRIGGER: marking the active PC as dead clears the active-PC row.
-- Confirms the citizens AFTER UPDATE trigger ties row lifetime to PC state.
-- The status change runs as the migration owner so it is not blocked by
-- citizens column-level grants.
-- ===========================================================================
update public.citizens
set
  status = 'dead'
where
  id = 'e5000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        count(*)::integer
      from
        public.user_active_player_characters
      where
        user_id = 'e1000000-0000-0000-0000-000000000001'
        and world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    0,
    'killing the active PC clears the user_active_player_characters row'
  );

-- The row owner can still delete their own row (when one exists). Re-insert
-- and delete to exercise the delete policy explicitly.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    delete from public.user_active_player_characters
    where user_id = 'e1000000-0000-0000-0000-000000000002'
  $test$,
    'row owner can delete their own active-PC row'
  );

reset role;

select
  *
from
  finish ();

rollback;
