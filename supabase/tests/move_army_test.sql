-- pgTAP tests for public.move_army (#1111): manage-nation authority,
-- target-settlement-belongs-to-nation guard, instant relocation, and
-- notifications to both the origin and destination settlements' managers.
-- Run with: npx supabase test db
--
-- UUID ranges (all numeric/hex, unique to this file):
--   21xxxxxx = users          22xxxxxx = worlds
--   23xxxxxx = nations        24xxxxxx = settlements
--   25xxxxxx = citizens       26xxxxxx = armies
begin;

select
  plan (12);

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
    '21000000-0000-0000-0000-000000000001',
    'move-army-admin@example.com',
    'x',
    now(),
    '{"username":"move_army_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'move-army-manager@example.com',
    'x',
    now(),
    '{"username":"move_army_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'move-army-outsider@example.com',
    'x',
    now(),
    '{"username":"move_army_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000004',
    'move-army-dest-manager@example.com',
    'x',
    now(),
    '{"username":"move_army_dest_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    '22000000-0000-0000-0000-000000000001',
    'Move Army World',
    'active',
    9
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '23000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    'Home Nation'
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000001',
    'Other Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '24000000-0000-0000-0000-000000000001',
    '23000000-0000-0000-0000-000000000001',
    'Home Settlement'
  ),
  (
    '24000000-0000-0000-0000-000000000002',
    '23000000-0000-0000-0000-000000000001',
    'Destination Settlement'
  ),
  (
    '24000000-0000-0000-0000-000000000003',
    '23000000-0000-0000-0000-000000000002',
    'Other Nation Settlement'
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
    role_nation_id
  )
values
  (
    '25000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-000000000001',
    'player_character',
    'Manager',
    'alive',
    '21000000-0000-0000-0000-000000000002',
    'nation_manager',
    '23000000-0000-0000-0000-000000000001'
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
    role_settlement_id
  )
values
  (
    '25000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-000000000002',
    'player_character',
    'DestManager',
    'alive',
    '21000000-0000-0000-0000-000000000004',
    'settlement_manager',
    '24000000-0000-0000-0000-000000000002'
  );

insert into
  public.armies (
    id,
    world_id,
    nation_id,
    name,
    funding_source,
    stationed_settlement_id,
    created_turn_number
  )
values
  (
    '26000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    '23000000-0000-0000-0000-000000000001',
    'Roaming Army',
    'nation',
    '24000000-0000-0000-0000-000000000001',
    9
  );

-- ===========================================================================
-- Authority: an outsider cannot move an army for a nation they don't manage.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.move_army(
      '26000000-0000-0000-0000-000000000001'::uuid,
      '24000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    '42501',
    null,
    'outsider cannot move an army'
  );

reset role;

-- ===========================================================================
-- Target settlement must belong to the army's nation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.move_army(
      '26000000-0000-0000-0000-000000000001'::uuid,
      '24000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '22023',
    'target settlement must belong to the nation',
    'target settlement outside the nation is rejected'
  );

-- ===========================================================================
-- Unknown army / settlement ids raise not-found.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.move_army(
      '26000000-0000-0000-0000-000000000099'::uuid,
      '24000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    'P0002',
    null,
    'unknown army raises not-found'
  );

select
  throws_ok (
    $test$
    select public.move_army(
      '26000000-0000-0000-0000-000000000001'::uuid,
      '24000000-0000-0000-0000-000000000099'::uuid
    )
  $test$,
    'P0002',
    null,
    'unknown settlement raises not-found'
  );

-- ===========================================================================
-- nation_manager can relocate the army within their own nation.
-- ===========================================================================
select
  results_eq (
    $test$
    select stationed_settlement_id
    from public.move_army(
      '26000000-0000-0000-0000-000000000001'::uuid,
      '24000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    $test$ values ('24000000-0000-0000-0000-000000000002'::uuid) $test$,
    'nation manager can relocate the army to a settlement in their own nation'
  );

reset role;

select
  is (
    (
      select
        stationed_settlement_id
      from
        public.armies
      where
        id = '26000000-0000-0000-0000-000000000001'
    ),
    '24000000-0000-0000-0000-000000000002'::uuid,
    'armies.stationed_settlement_id is updated'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        notification_type = 'army.relocated'
    ),
    4::bigint,
    'both settlements'' managers (nation manager + destination settlement manager) are notified once per settlement'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        notification_type = 'army.relocated'
        and settlement_id = '24000000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'origin settlement gets a "relocated away" notification per recipient'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        notification_type = 'army.relocated'
        and settlement_id = '24000000-0000-0000-0000-000000000002'
    ),
    2::bigint,
    'destination settlement gets a "relocated to" notification per recipient'
  );

-- ===========================================================================
-- Idempotent move (already stationed there) succeeds without notifying again.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  results_eq (
    $test$
    select stationed_settlement_id
    from public.move_army(
      '26000000-0000-0000-0000-000000000001'::uuid,
      '24000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    $test$ values ('24000000-0000-0000-0000-000000000002'::uuid) $test$,
    'moving an army to its current settlement is a no-op success'
  );

reset role;

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        notification_type = 'army.relocated'
    ),
    4::bigint,
    'no-op relocation does not emit additional notifications'
  );

-- ===========================================================================
-- Archived worlds are read-only.
-- ===========================================================================
update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = '22000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.move_army(
      '26000000-0000-0000-0000-000000000001'::uuid,
      '24000000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived world rejects move_army'
  );

reset role;

select
  *
from
  finish ();

rollback;
