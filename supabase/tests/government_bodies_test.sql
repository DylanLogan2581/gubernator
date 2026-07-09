-- pgTAP tests for public.government_bodies (#1116): composition_json
-- validation and RLS authority (world members read, nation/settlement
-- manager and world/super admin write, outsider blocked).
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
    'fa000000-0000-0000-0000-000000000001',
    'gb-admin@example.com',
    'x',
    now(),
    '{"username":"gb_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'fa000000-0000-0000-0000-000000000002',
    'gb-nation-manager@example.com',
    'x',
    now(),
    '{"username":"gb_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'fa000000-0000-0000-0000-000000000003',
    'gb-outsider@example.com',
    'x',
    now(),
    '{"username":"gb_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'fa000000-0000-0000-0000-000000000004',
    'gb-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"gb_settlement_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'fb000000-0000-0000-0000-000000000001',
    'Government Bodies World',
    'private',
    'active',
    5
  ),
  (
    'fb000000-0000-0000-0000-000000000002',
    'Other Government Bodies World',
    'private',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'fb000000-0000-0000-0000-000000000001',
    'fa000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'fc000000-0000-0000-0000-000000000001',
    'fb000000-0000-0000-0000-000000000001',
    'Body Nation',
    'republic'
  ),
  (
    'fc000000-0000-0000-0000-000000000002',
    'fb000000-0000-0000-0000-000000000001',
    'Other Nation',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fd000000-0000-0000-0000-000000000001',
    'fc000000-0000-0000-0000-000000000001',
    'Body Settlement'
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
    role_settlement_id
  )
values
  (
    'fe000000-0000-0000-0000-000000000001',
    'fb000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'NationManager',
    'alive',
    'fa000000-0000-0000-0000-000000000002',
    'nation_manager',
    'fc000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'fe000000-0000-0000-0000-000000000002',
    'fb000000-0000-0000-0000-000000000001',
    'fd000000-0000-0000-0000-000000000001',
    'player_character',
    'SettlementManager',
    'alive',
    'fa000000-0000-0000-0000-000000000004',
    'settlement_manager',
    null,
    'fd000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- composition_json validation: empty array and unknown kind are rejected at
-- table-insert time regardless of role.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.government_bodies (world_id, nation_id, name, composition_json)
    values (
      'fb000000-0000-0000-0000-000000000001',
      'fc000000-0000-0000-0000-000000000001',
      'Empty Body',
      '[]'::jsonb
    )
  $test$,
    '23514',
    null,
    'an empty composition array is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.government_bodies (world_id, nation_id, name, composition_json)
    values (
      'fb000000-0000-0000-0000-000000000001',
      'fc000000-0000-0000-0000-000000000001',
      'Unknown Kind Body',
      '[{"kind":"emperor_decree"}]'::jsonb
    )
  $test$,
    '23514',
    null,
    'an unknown composition kind is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.government_bodies (world_id, nation_id, settlement_id, name, composition_json)
    values (
      'fb000000-0000-0000-0000-000000000001',
      'fc000000-0000-0000-0000-000000000001',
      'fd000000-0000-0000-0000-000000000001',
      'Both Scopes Body',
      '[{"kind":"ruler"}]'::jsonb
    )
  $test$,
    '23514',
    null,
    'setting both nation_id and settlement_id is rejected'
  );

-- ===========================================================================
-- SELECT: world members can read; outsiders with no world access cannot.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  public.government_bodies (
    id,
    world_id,
    nation_id,
    name,
    description,
    composition_json
  )
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'fb000000-0000-0000-0000-000000000001',
    'fc000000-0000-0000-0000-000000000001',
    'The Senate',
    'Upper chamber.',
    '[{"kind":"ruler"},{"kind":"settlement_managers"}]'::jsonb
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.government_bodies
      where
        world_id = 'fb000000-0000-0000-0000-000000000001'
    ),
    1,
    'a world member can select government_bodies rows'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.government_bodies
      where
        world_id = 'fb000000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no world access cannot select government_bodies rows'
  );

reset role;

-- ===========================================================================
-- INSERT: a nation manager can create a body for their own nation; not for
-- another nation; an outsider cannot either.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.government_bodies (world_id, nation_id, name, composition_json)
    values (
      'fb000000-0000-0000-0000-000000000001',
      'fc000000-0000-0000-0000-000000000002',
      'Hostile Takeover',
      '[{"kind":"ruler"}]'::jsonb
    )
  $test$,
    '42501',
    null,
    'a nation manager cannot create a body for another nation'
  );

select
  throws_ok (
    $test$
    insert into public.government_bodies (world_id, nation_id, name, composition_json)
    values (
      'fb000000-0000-0000-0000-000000000002',
      'fc000000-0000-0000-0000-000000000001',
      'Mismatched World Body',
      '[{"kind":"ruler"}]'::jsonb
    )
  $test$,
    '42501',
    null,
    'a nation manager cannot create a body with a world_id that does not match their nation''s world'
  );

insert into
  public.government_bodies (id, world_id, nation_id, name, composition_json)
values
  (
    'b1000000-0000-0000-0000-000000000002',
    'fb000000-0000-0000-0000-000000000001',
    'fc000000-0000-0000-0000-000000000001',
    'Moot of Elders',
    '[{"kind":"citizens","citizen_ids":["fe000000-0000-0000-0000-000000000001"]}]'::jsonb
  );

reset role;

select
  is (
    (
      select
        name
      from
        public.government_bodies
      where
        id = 'b1000000-0000-0000-0000-000000000002'
    ),
    'Moot of Elders',
    'a nation manager can create a body for their own nation'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into
  public.government_bodies (
    id,
    world_id,
    settlement_id,
    name,
    composition_json
  )
values
  (
    'b1000000-0000-0000-0000-000000000003',
    'fb000000-0000-0000-0000-000000000001',
    'fd000000-0000-0000-0000-000000000001',
    'Town Council',
    '[{"kind":"ruler"}]'::jsonb
  );

reset role;

select
  is (
    (
      select
        name
      from
        public.government_bodies
      where
        id = 'b1000000-0000-0000-0000-000000000003'
    ),
    'Town Council',
    'a settlement manager can create a body for their own settlement'
  );

-- ===========================================================================
-- UPDATE: nation manager can edit their own body; cannot edit another
-- nation's body (silently ignored by RLS).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  public.government_bodies (
    id,
    world_id,
    nation_id,
    name,
    description,
    composition_json
  )
values
  (
    'b1000000-0000-0000-0000-000000000004',
    'fb000000-0000-0000-0000-000000000001',
    'fc000000-0000-0000-0000-000000000002',
    'Other Nation Assembly',
    'Untouched.',
    '[{"kind":"ruler"}]'::jsonb
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000002","role":"authenticated"}';

update public.government_bodies
set
  description = 'Renamed.'
where
  id = 'b1000000-0000-0000-0000-000000000002';

update public.government_bodies
set
  description = 'Hijacked.'
where
  id = 'b1000000-0000-0000-0000-000000000004';

reset role;

select
  is (
    (
      select
        description
      from
        public.government_bodies
      where
        id = 'b1000000-0000-0000-0000-000000000002'
    ),
    'Renamed.',
    'a nation manager can update their own body'
  );

select
  is (
    (
      select
        description
      from
        public.government_bodies
      where
        id = 'b1000000-0000-0000-0000-000000000004'
    ),
    'Untouched.',
    'a nation manager cannot update another nation''s body (silently ignored by RLS)'
  );

-- ===========================================================================
-- DELETE: an outsider cannot delete; a nation manager can delete their own
-- nation's body.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.government_bodies
where
  id = 'b1000000-0000-0000-0000-000000000002';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.government_bodies
      where
        id = 'b1000000-0000-0000-0000-000000000002'
    ),
    'an outsider cannot delete a body'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa000000-0000-0000-0000-000000000002","role":"authenticated"}';

delete from public.government_bodies
where
  id = 'b1000000-0000-0000-0000-000000000002';

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.government_bodies
      where
        id = 'b1000000-0000-0000-0000-000000000002'
    ),
    0,
    'a nation manager can delete their own body'
  );

select
  *
from
  finish ();

rollback;
