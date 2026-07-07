-- pgTAP tests for public.nation_resource_stockpiles RLS and seed triggers.
-- Run with: npx supabase test db
begin;

select
  plan (8);

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
    'd1000000-0000-0000-0000-000000000001',
    'nstock-admin@example.com',
    'x',
    now(),
    '{"username":"nstock_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'nstock-member@example.com',
    'x',
    now(),
    '{"username":"nstock_member"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'nstock-outsider@example.com',
    'x',
    now(),
    '{"username":"nstock_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Nation Stockpile World',
    'private',
    'active',
    null
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Stockpile Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Stockpile Nation Settlement'
  );

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
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'player_character',
    'Stockpile Member',
    'alive',
    'd1000000-0000-0000-0000-000000000002'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Grain',
    'grain'
  );

-- ===========================================================================
-- SEED TRIGGER: nations_seed_stockpiles seeded one zero-quantity row for the
-- pre-existing resource when the nation was inserted (resource existed
-- before nation? No — resource inserted after; verify via resources trigger
-- instead once the resource insert above ran resources_seed_nation_stockpiles).
-- ===========================================================================
select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'resources_seed_nation_stockpiles seeds a zero-quantity row for the existing nation'
  );

-- New nation inserted after the resource exists: nations_seed_stockpiles
-- should seed a row for it too.
insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'Second Stockpile Nation'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000002'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'nations_seed_stockpiles seeds a zero-quantity row for a newly created nation'
  );

-- ===========================================================================
-- CONSTRAINT: quantity < 0 is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.nation_resource_stockpiles (nation_id, resource_id, quantity)
    values (
      'd3000000-0000-0000-0000-000000000001',
      'd6000000-0000-0000-0000-000000000001',
      -1
    )
  $test$,
    '23514',
    null,
    'quantity = -1 is rejected by the non-negative check constraint'
  );

-- ===========================================================================
-- CONSTRAINT: duplicate (nation_id, resource_id) is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.nation_resource_stockpiles (nation_id, resource_id, quantity)
    values (
      'd3000000-0000-0000-0000-000000000001',
      'd6000000-0000-0000-0000-000000000001',
      5
    )
  $test$,
    '23505',
    null,
    'duplicate (nation_id, resource_id) is rejected by the unique constraint'
  );

-- ===========================================================================
-- RLS SELECT: world member can read nation stockpiles.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    1,
    'world member can select nation stockpile rows'
  );

reset role;

-- ===========================================================================
-- RLS SELECT: outsider with no world access sees zero rows.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider with no world access sees zero nation stockpile rows'
  );

reset role;

-- ===========================================================================
-- WRITE DENIED: world admin cannot directly insert (writes are RPC/service
-- role only for this table).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.nation_resource_stockpiles (nation_id, resource_id, quantity)
    values (
      'd3000000-0000-0000-0000-000000000002',
      'd6000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    '42501',
    null,
    'world admin cannot directly insert nation stockpile rows (no grant)'
  );

reset role;

-- ===========================================================================
-- WRITE DENIED: world admin cannot directly update either. No UPDATE RLS
-- policy exists, so the USING clause silently filters out every row instead
-- of raising — assert zero rows are affected rather than an exception.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

update public.nation_resource_stockpiles
set
  quantity = 5
where
  nation_id = 'd3000000-0000-0000-0000-000000000001'
  and resource_id = 'd6000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'world admin cannot directly update nation stockpile rows (RLS filters the row, update affects zero rows)'
  );

select
  *
from
  finish ();

rollback;
