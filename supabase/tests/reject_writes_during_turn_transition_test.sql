-- pgTAP: gameplay writes are rejected while a world has a running turn
-- transition, and permitted when it is idle, in another world, or inside the
-- turn's own escape hatch.
--
-- UUID prefix map (d1-prefixed range, unique to this file):
--   d1100000 = worlds   d1200000 = nations   d1300000 = settlements
--   d1400000 = turn_transitions   d1500000 = auth.users
begin;

select
  plan (7);

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
    'd1500000-0000-0000-0000-000000000001',
    'turn-guard@example.com',
    'x',
    now(),
    '{"username":"turn_guard"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number)
values
  (
    'd1100000-0000-0000-0000-000000000001',
    'Guarded World',
    5
  ),
  (
    'd1100000-0000-0000-0000-000000000002',
    'Other World',
    5
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd1200000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    'Guarded Nation'
  ),
  (
    'd1200000-0000-0000-0000-000000000002',
    'd1100000-0000-0000-0000-000000000002',
    'Other Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd1300000-0000-0000-0000-000000000001',
    'd1200000-0000-0000-0000-000000000001',
    'Guarded Town'
  ),
  (
    'd1300000-0000-0000-0000-000000000002',
    'd1200000-0000-0000-0000-000000000002',
    'Other Town'
  );

-- Idle world: the write succeeds.
select
  lives_ok (
    $$ update public.settlements set name = 'Renamed Idle'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'write succeeds while no transition is running'
  );

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
    'd1400000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    5,
    6,
    'd1500000-0000-0000-0000-000000000001',
    'running',
    now()
  );

-- Running: direct world_id resolution (settlements -> nations).
select
  throws_ok (
    $$ update public.settlements set name = 'Renamed Running'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'P0001',
    'world turn in progress',
    'write rejected while the world transition is running'
  );

-- Running: an insert is rejected too.
select
  throws_ok (
    $$ insert into public.settlements (id, nation_id, name)
       values ('d1300000-0000-0000-0000-000000000003',
               'd1200000-0000-0000-0000-000000000001', 'New Town') $$,
    'P0001',
    'world turn in progress',
    'insert rejected while the world transition is running'
  );

-- Running: a delete is rejected too, not just update/insert.
select
  throws_ok (
    $$ delete from public.settlements
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'P0001',
    'world turn in progress',
    'delete rejected while the world transition is running'
  );

-- Another world is unaffected.
select
  lives_ok (
    $$ update public.settlements set name = 'Renamed Other'
       where id = 'd1300000-0000-0000-0000-000000000002' $$,
    'a transition in one world does not block another world'
  );

-- The escape hatch lets the turn write.
select
  lives_ok (
    $$ select set_config('app.applying_turn', 'on', true);
       update public.settlements set name = 'Renamed By Turn'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'the applying_turn escape hatch permits the write'
  );

-- A completed transition stops blocking.
update public.turn_transitions
set
  status = 'completed',
  finished_at = now()
where
  id = 'd1400000-0000-0000-0000-000000000001';

select
  lives_ok (
    $$ select set_config('app.applying_turn', '', true);
       update public.settlements set name = 'Renamed After'
       where id = 'd1300000-0000-0000-0000-000000000001' $$,
    'write succeeds once the transition is no longer running'
  );

select
  *
from
  finish ();

rollback;
