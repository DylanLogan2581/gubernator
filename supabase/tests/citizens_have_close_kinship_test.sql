-- pgTAP tests for public.citizens_have_close_kinship and its interaction with
-- the incest_prevention_depth world setting. Run with: npx supabase test db
--
-- Covers three depth values:
--   depth = 0: disabled — any pairing is allowed (function returns false)
--   depth = 1: siblings sharing a common parent are blocked; unrelated allowed
--   depth = 4: parent/child pairings are blocked; unrelated allowed
--
-- Family tree used in fixtures:
--   AncestralRoot → Parent → SiblingA
--                          → SiblingB
--   UnrelatedA (no parents)
--   UnrelatedB (no parents)
begin;

select
  plan (5);

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
    'kinship-owner@example.com',
    'x',
    now(),
    '{"username":"kinship_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Kinship Test World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Kinship Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Kinship Settlement'
  );

-- Root generation and unrelated citizens (no parents).
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
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Ancestral Root',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-000000000005',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Unrelated A',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-000000000006',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Unrelated B',
    'alive'
  );

-- Parent (child of AncestralRoot). Must be inserted after AncestralRoot due to
-- the FK on parent_a_citizen_id.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    parent_a_citizen_id
  )
values
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Parent',
    'alive',
    'e5000000-0000-0000-0000-000000000001'
  );

-- SiblingA and SiblingB both have Parent as parent_a — the shared ancestor
-- that depth=1 and depth=4 checks detect.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    parent_a_citizen_id
  )
values
  (
    'e5000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Sibling A',
    'alive',
    'e5000000-0000-0000-0000-000000000002'
  ),
  (
    'e5000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Sibling B',
    'alive',
    'e5000000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- depth = 0: disabled — any pairing is allowed
-- ===========================================================================
select
  is (
    public.citizens_have_close_kinship (
      'e5000000-0000-0000-0000-000000000002',
      'e5000000-0000-0000-0000-000000000003',
      0
    ),
    false,
    'depth=0 disables the check; parent/child pairing returns false'
  );

-- ===========================================================================
-- depth = 1: siblings blocked, unrelated allowed
-- ===========================================================================
select
  is (
    public.citizens_have_close_kinship (
      'e5000000-0000-0000-0000-000000000003',
      'e5000000-0000-0000-0000-000000000004',
      1
    ),
    true,
    'depth=1 blocks siblings sharing a common parent'
  );

select
  is (
    public.citizens_have_close_kinship (
      'e5000000-0000-0000-0000-000000000005',
      'e5000000-0000-0000-0000-000000000006',
      1
    ),
    false,
    'depth=1 allows unrelated citizens'
  );

-- ===========================================================================
-- depth = 4: parent/child blocked, unrelated allowed
-- ===========================================================================
select
  is (
    public.citizens_have_close_kinship (
      'e5000000-0000-0000-0000-000000000002',
      'e5000000-0000-0000-0000-000000000003',
      4
    ),
    true,
    'depth=4 blocks parent/child pairings'
  );

select
  is (
    public.citizens_have_close_kinship (
      'e5000000-0000-0000-0000-000000000005',
      'e5000000-0000-0000-0000-000000000006',
      4
    ),
    false,
    'depth=4 allows citizens with no shared lineage within 4 generations'
  );

select
  *
from
  finish ();

rollback;
