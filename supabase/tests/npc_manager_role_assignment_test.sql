-- pgTAP tests for the allow_npc_manager_role_assignment migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • World admin can assign nation_manager / settlement_manager to an alive NPC.
--   • assign_citizen_role rejects a dead NPC (P0001).
--   • World admin can revoke an NPC-held role.
--   • With an NPC-held nation_manager role, a non-admin nation member gets no
--     manage authority via current_user_manages_nation, while the world admin
--     retains full authority -- is_nation_manager_of / current_user_manages_nation
--     key off user_id = auth.uid(), so they are unaffected by the citizen being
--     an NPC (unchanged for player characters, covered separately in
--     player_character_role_mutations_test.sql).
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
    'b0000000-0000-0000-0000-000000000001',
    'npc-role-admin@example.com',
    'x',
    now(),
    '{"username":"npc_role_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'npc-role-outsider@example.com',
    'x',
    now(),
    '{"username":"npc_role_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'NPC Role World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'NPC Role Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'NPC Role Settlement'
  );

-- Alive NPC, no role, to be assigned nation_manager / settlement_manager.
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
    'b4000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b3000000-0000-0000-0000-000000000001',
    'npc',
    'Alive Role NPC',
    'alive'
  );

-- Dead NPC, used to verify assign_citizen_role rejects it.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause_category
  )
values
  (
    'b4000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'b3000000-0000-0000-0000-000000000001',
    'npc',
    'Dead Role NPC',
    'dead',
    'unknown'
  );

-- ===========================================================================
-- World admin: assign nation_manager to the alive NPC.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        citizen_type = 'npc'
        and role_type = 'nation_manager'
        and role_nation_id = 'b2000000-0000-0000-0000-000000000001'
      from
        public.assign_citizen_role (
          'b4000000-0000-0000-0000-000000000001',
          'nation_manager',
          'b2000000-0000-0000-0000-000000000001',
          null
        )
    ),
    'world admin can assign nation_manager to an alive NPC'
  );

-- Non-admin, non-manager member gets no manage authority over the nation
-- while it is NPC-managed.
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not (
      select
        public.current_user_manages_nation ('b2000000-0000-0000-0000-000000000001')
    ),
    'non-admin outsider has no manage authority over an NPC-managed nation'
  );

-- World admin retains full authority regardless of the NPC-held role.
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        public.current_user_manages_nation ('b2000000-0000-0000-0000-000000000001')
    ),
    'world admin retains manage authority over an NPC-managed nation'
  );

-- World admin can revoke the NPC's role.
select
  ok (
    (
      select
        role_type = 'none'
        and role_nation_id is null
        and role_settlement_id is null
      from
        public.revoke_citizen_role ('b4000000-0000-0000-0000-000000000001')
    ),
    'world admin can revoke a role held by an NPC'
  );

-- World admin can assign settlement_manager to the same alive NPC.
select
  ok (
    (
      select
        citizen_type = 'npc'
        and role_type = 'settlement_manager'
        and role_settlement_id = 'b3000000-0000-0000-0000-000000000001'
      from
        public.assign_citizen_role (
          'b4000000-0000-0000-0000-000000000001',
          'settlement_manager',
          null,
          'b3000000-0000-0000-0000-000000000001'
        )
    ),
    'world admin can assign settlement_manager to an alive NPC'
  );

select
  ok (
    (
      select
        public.current_user_manages_settlement ('b3000000-0000-0000-0000-000000000001')
    ),
    'world admin retains manage authority over an NPC-managed settlement'
  );

-- assign_citizen_role rejects a dead NPC.
select
  throws_ok (
    $test$
    select public.assign_citizen_role (
      'b4000000-0000-0000-0000-000000000002',
      'settlement_manager',
      null,
      'b3000000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'assign_citizen_role raises P0001 for a dead NPC'
  );

-- Even a super admin cannot resurrect authority for a dead NPC's role scope --
-- assign to the dead NPC's settlement stays rejected regardless of caller.
select
  throws_ok (
    $test$
    select public.assign_citizen_role (
      'b4000000-0000-0000-0000-000000000002',
      'nation_manager',
      'b2000000-0000-0000-0000-000000000001',
      null
    )
    $test$,
    'P0001',
    null,
    'assign_citizen_role raises P0001 for a dead NPC regardless of role type'
  );

reset role;

select
  *
from
  finish ();

rollback;
