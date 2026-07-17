-- pgTAP tests for the citizen_memories SELECT super_admin branch after the
-- RLS lint merge (citizen_memories_select_admin). citizen_memories_rls_test.sql
-- already covers the world_admin branch (a world admin selects a memory row
-- directly and a non-admin gets zero rows), but never exercises a super_admin
-- who is NOT also a world_admin of the row's world -- this file closes that
-- gap: a super_admin with no world_admins row for the world can still SELECT
-- the memory, and a plain authenticated outsider still cannot.
-- Run with: npx supabase test db
begin;

select
  plan (2);

-- --- Fixtures: super_admin user (no world_admins row) + outsider + world + npc + memory ---
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
    'ce100000-0000-0000-0000-000000000001',
    'ce-super-admin@example.com',
    'x',
    now(),
    '{"username":"ce_super_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ce100000-0000-0000-0000-000000000002',
    'ce-outsider@example.com',
    'x',
    now(),
    '{"username":"ce_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'ce100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, status)
values
  (
    'ce200000-0000-0000-0000-000000000001',
    'CE Memories World',
    'active'
  );

-- Deliberately no public.world_admins row for either user: this isolates the
-- super_admin branch from the already-covered world_admin branch.
insert into
  public.citizens (id, world_id, citizen_type, given_name, status)
values
  (
    'ce300000-0000-0000-0000-000000000001',
    'ce200000-0000-0000-0000-000000000001',
    'npc',
    'CE Memory Target',
    'alive'
  );

-- Seeded directly as table owner (bypasses grants/RLS), mirroring the
-- fixture pattern in citizen_memories_rls_test.sql.
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
    'ce400000-0000-0000-0000-000000000001',
    'ce200000-0000-0000-0000-000000000001',
    'ce300000-0000-0000-0000-000000000001',
    'Fixture memory for super_admin-branch SELECT test',
    0,
    'manual'
  );

-- --- Positive: a super_admin with no world_admins row can SELECT the memory ---
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ce100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.citizen_memories
      where
        id = 'ce400000-0000-0000-0000-000000000001'
    ),
    'super_admin with no world_admins row can SELECT a citizen_memories row'
  );

reset role;

-- --- Negative: a plain authenticated outsider cannot SELECT the memory ---
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ce100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.citizen_memories
      where
        id = 'ce400000-0000-0000-0000-000000000001'
    ),
    'non-admin outsider cannot SELECT a citizen_memories row'
  );

reset role;

select
  *
from
  finish ();

rollback;
