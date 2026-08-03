-- pgTAP tests for the enforce_one_settlement_manager migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • assign_citizen_role demotes the settlement's existing settlement_manager
--     to 'none' when a different citizen is assigned the role.
--   • The newly assigned citizen holds settlement_manager for the settlement.
--   • The partial unique index rejects a direct table write that would leave
--     two citizens holding settlement_manager for the same settlement.
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
    'd0000000-0000-0000-0000-000000000001',
    'one-mgr-admin@example.com',
    'x',
    now(),
    '{"username":"one_mgr_admin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'One Manager World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'One Manager Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'One Manager Settlement'
  );

-- Two alive NPCs living in the same settlement.
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
    'd4000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'npc',
    'First Manager',
    'alive'
  ),
  (
    'd4000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'npc',
    'Second Manager',
    'alive'
  );

-- ===========================================================================
-- World admin: assign settlement_manager to citizen A.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = 'd3000000-0000-0000-0000-000000000001'
      from
        public.assign_citizen_role (
          'd4000000-0000-0000-0000-000000000001',
          'settlement_manager',
          null,
          'd3000000-0000-0000-0000-000000000001'
        )
    ),
    'world admin can assign settlement_manager to citizen A'
  );

-- Assigning settlement_manager to citizen B demotes citizen A.
select
  ok (
    (
      select
        role_type = 'settlement_manager'
        and role_settlement_id = 'd3000000-0000-0000-0000-000000000001'
      from
        public.assign_citizen_role (
          'd4000000-0000-0000-0000-000000000002',
          'settlement_manager',
          null,
          'd3000000-0000-0000-0000-000000000001'
        )
    ),
    'world admin can assign settlement_manager to citizen B'
  );

select
  ok (
    (
      select
        role_type = 'none'
        and role_settlement_id is null
      from
        public.citizens
      where
        id = 'd4000000-0000-0000-0000-000000000001'
    ),
    'citizen A is demoted to none after citizen B is assigned the role'
  );

reset role;

-- ===========================================================================
-- Partial unique index rejects a direct write that duplicates the manager.
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.citizens
    set role_type = 'settlement_manager',
      role_settlement_id = 'd3000000-0000-0000-0000-000000000001'
    where id = 'd4000000-0000-0000-0000-000000000001'
    $test$,
    '23505',
    null,
    'partial unique index rejects a second settlement_manager for the same settlement'
  );

select
  *
from
  finish ();

rollback;
