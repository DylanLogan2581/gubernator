-- pgTAP tests for citizen_memories table RLS and RPCs.
-- Run with: npx supabase test db
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all cd-prefixed, unique to this file):
--   cd1xxxxx = users            cd2xxxxx = worlds
--   cd3xxxxx = citizens         cd4xxxxx = events
--   cd5xxxxx = citizen_memories (direct-write-denial fixture row)
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
    'cd100000-0000-0000-0000-000000000001',
    'cm-super-admin@example.com',
    'x',
    now(),
    '{"username":"cm_super_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cd100000-0000-0000-0000-000000000002',
    'cm-world-admin@example.com',
    'x',
    now(),
    '{"username":"cm_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cd100000-0000-0000-0000-000000000003',
    'cm-non-admin@example.com',
    'x',
    now(),
    '{"username":"cm_non_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cd100000-0000-0000-0000-000000000004',
    'cm-other-world-admin@example.com',
    'x',
    now(),
    '{"username":"cm_other_world_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'cd100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, status)
values
  (
    'cd200000-0000-0000-0000-000000000001',
    'CM World 1',
    'active'
  ),
  (
    'cd200000-0000-0000-0000-000000000002',
    'CM World 2',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'cd200000-0000-0000-0000-000000000001',
    'cd100000-0000-0000-0000-000000000002'
  ),
  (
    'cd200000-0000-0000-0000-000000000002',
    'cd100000-0000-0000-0000-000000000004'
  );

insert into
  public.citizens (id, world_id, citizen_type, given_name, status)
values
  (
    'cd300000-0000-0000-0000-000000000001',
    'cd200000-0000-0000-0000-000000000001',
    'npc',
    'Noel',
    'alive'
  ),
  (
    'cd300000-0000-0000-0000-000000000002',
    'cd200000-0000-0000-0000-000000000002',
    'npc',
    'Odette',
    'alive'
  );

insert into
  public.events (
    id,
    world_id,
    name,
    effect_type,
    activate_on_transition_after_turn_number
  )
values
  (
    'cd400000-0000-0000-0000-000000000001',
    'cd200000-0000-0000-0000-000000000001',
    'Test Event',
    'resource_grant',
    0
  );

-- Seeded directly as table owner (bypasses grants/RLS) so a row exists for the
-- direct-write-denial tests below without depending on RPC ordering.
insert into
  public.citizen_memories (
    id,
    world_id,
    citizen_id,
    memory_text,
    occurred_on_turn_number,
    source
  )
values
  (
    'cd500000-0000-0000-0000-000000000001',
    'cd200000-0000-0000-0000-000000000001',
    'cd300000-0000-0000-0000-000000000001',
    'Fixture memory for direct-write denial tests',
    0,
    'manual'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_NULL_GUARD
-- RPC should reject null parameters with P0002
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000001"}';

select
  throws_ok (
    'select public.add_citizen_memory(null, ''text'', 0)',
    'P0002'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_EMPTY_TEXT
-- RPC should reject empty text with P0001
-- ---------------------------------------------------------------------------
select
  throws_ok (
    'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000001'', '''', 0)',
    'P0001'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_TEXT_TOO_LONG
-- RPC should reject text > 1000 chars with P0001
-- ---------------------------------------------------------------------------
select
  throws_ok (
    format(
      'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000001'', %L, 0)',
      repeat('x', 1001)
    ),
    'P0001'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_TURN_NEGATIVE
-- RPC should reject negative turn with P0001
-- ---------------------------------------------------------------------------
select
  throws_ok (
    'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000001'', ''text'', -1)',
    'P0001'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_NON_ADMIN
-- Non-admin should fail with 42501
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000003"}';

select
  throws_ok (
    'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000001'', ''text'', 0)',
    '42501'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_SUCCESS
-- Successful add from world admin
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000002"}';

select
  lives_ok (
    'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000001'', ''Successful memory'', 5)',
    'world admin adds memory'
  );

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        memory_text = 'Successful memory'
    ),
    1::bigint,
    'memory persists'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_UPDATE_CITIZEN_MEMORY_SUCCESS
-- World admin updates memory
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000002"}';

-- Capture memory id into a temp variable
do $$
declare
  v_mem_id uuid;
begin
  select id into v_mem_id
  from public.citizen_memories
  where memory_text = 'Successful memory';

  -- Update it
  perform public.update_citizen_memory(v_mem_id, 'Updated memory', 10);
end
$$;

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        memory_text = 'Updated memory'
    ),
    1::bigint,
    'world admin updates memory'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_DELETE_CITIZEN_MEMORY_SUCCESS
-- World admin deletes memory
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000002"}';

do $$
declare
  v_mem_id uuid;
begin
  select id into v_mem_id
  from public.citizen_memories
  where memory_text = 'Updated memory';

  -- Delete it
  perform public.delete_citizen_memory(v_mem_id);
end
$$;

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        memory_text = 'Updated memory'
    ),
    0::bigint,
    'world admin deletes memory'
  );

-- ---------------------------------------------------------------------------
-- Test: RLS_NON_ADMIN_SELECT_ZERO_ROWS
-- Non-admin user should not see any memories (RLS blocks all rows)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000003"}';

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
    ),
    0::bigint,
    'non-admin select returns zero rows'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_CROSS_WORLD_CITIZEN
-- RPC should reject when citizen belongs to a world caller is not admin of
-- (auth failure, not data integrity error)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000002"}';

select
  throws_ok (
    'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000002'', ''text'', 0)',
    '42501',
    null,
    'cross-world citizen access rejected (insufficient privilege)'
  );

-- ---------------------------------------------------------------------------
-- Test: RPC_ADD_CITIZEN_MEMORY_TURN_UPPER_BOUND
-- RPC should reject turn number > current_turn + 100
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000002"}';

select
  throws_ok (
    'select public.add_citizen_memory(''cd300000-0000-0000-0000-000000000001'', ''text'', 101)',
    'P0001',
    null,
    'turn exceeding current_turn + 100 rejected'
  );

-- ---------------------------------------------------------------------------
-- Test: DIRECT_WRITE_INSERT_DENIED
-- Direct INSERT via the table API is denied for authenticated (including
-- world admins): 20260810000000_revoke_citizen_memories_direct_writes.sql
-- revokes insert/update/delete from authenticated, leaving only select.
-- Writes must go through add_citizen_memory / update_citizen_memory /
-- delete_citizen_memory.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cd100000-0000-0000-0000-000000000002"}';

select
  throws_ok (
    $test$
    insert into public.citizen_memories (
      world_id, citizen_id, memory_text, occurred_on_turn_number, source
    ) values (
      'cd200000-0000-0000-0000-000000000001',
      'cd300000-0000-0000-0000-000000000001',
      'direct insert attempt',
      0,
      'manual'
    )
    $test$,
    '42501',
    null,
    'world admin cannot directly insert a citizen memory (must use RPC)'
  );

-- ---------------------------------------------------------------------------
-- Test: DIRECT_WRITE_UPDATE_DENIED
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    update public.citizen_memories
    set memory_text = 'direct update attempt'
    where id = 'cd500000-0000-0000-0000-000000000001'
    $test$,
    '42501',
    null,
    'world admin cannot directly update a citizen memory (must use RPC)'
  );

-- ---------------------------------------------------------------------------
-- Test: DIRECT_WRITE_DELETE_DENIED
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    delete from public.citizen_memories
    where id = 'cd500000-0000-0000-0000-000000000001'
    $test$,
    '42501',
    null,
    'world admin cannot directly delete a citizen memory (must use RPC)'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Test: SOURCE_MANUAL_VS_EVENT
-- Manual memories have source=manual; event-sourced memories are written by
-- the SECURITY DEFINER event-patch inserter (apply_turn_transition), not by
-- an authenticated caller. Insert directly as the migration owner (bypasses
-- grants/RLS, mirroring the inserter's SECURITY DEFINER privileges) to verify
-- the source column distinguishes memory types.
-- ---------------------------------------------------------------------------
insert into
  public.citizen_memories (
    world_id,
    citizen_id,
    memory_text,
    occurred_on_turn_number,
    source,
    event_id
  )
values
  (
    'cd200000-0000-0000-0000-000000000001',
    'cd300000-0000-0000-0000-000000000001',
    'Event-sourced memory',
    5,
    'event',
    'cd400000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        source = 'event'
        and citizen_id = 'cd300000-0000-0000-0000-000000000001'
    ),
    1::bigint,
    'event-sourced memory distinguishable by source column'
  );

-- ---------------------------------------------------------------------------
-- Finish
-- ---------------------------------------------------------------------------
select
  finish ();

rollback;
