-- pgTAP tests for public.get_citizen_family_tree(uuid). Run with:
--   npx supabase test db
--
-- Fixture shape (issue #1180):
--   Ancestors (parent_a only, parent_b always unknown):
--     GreatGreatGrandparent (gen -4, must NOT appear -- past the 3-gen cap)
--       -> GreatGrandparent (gen -3)
--         -> Grandparent (gen -2)
--           -> Parent (gen -1)
--             -> Center (gen 0, the citizen the tree is centered on)
--   Descendants:
--     Center -> Child (gen 1) -> Grandchild (gen 2) -> GreatGrandchild (gen 3)
--                                                         -> GreatGreatGrandchild (gen 4, must NOT appear)
--     Center -> ChildB (gen 1, no children of its own -- must not render an
--                        "unknown child" placeholder)
--   Partners:
--     Center <-active-> ActivePartner (must appear)
--     Center <-dissolved-> ExPartner (must NOT appear)
begin;

select
  plan (9);

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
    '1a000000-0000-0000-0000-000000000001',
    'family-tree-owner@example.com',
    'x',
    now(),
    '{"username":"family_tree_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '1a000000-0000-0000-0000-000000000002',
    'Family Tree Test World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '1a000000-0000-0000-0000-000000000003',
    '1a000000-0000-0000-0000-000000000002',
    'Family Tree Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '1a000000-0000-0000-0000-000000000004',
    '1a000000-0000-0000-0000-000000000003',
    'Family Tree Settlement'
  );

-- Ancestor chain, oldest first so each parent_a_citizen_id FK is satisfied.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause,
    death_cause_category
  )
values
  (
    '1a000000-0000-0000-0000-000000000014',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'GreatGreatGrandparent',
    'dead',
    'Unknown',
    'unknown'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause,
    death_cause_category,
    parent_a_citizen_id
  )
values
  (
    '1a000000-0000-0000-0000-000000000013',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'GreatGrandparent',
    'dead',
    'Unknown',
    'unknown',
    '1a000000-0000-0000-0000-000000000014'
  ),
  (
    '1a000000-0000-0000-0000-000000000012',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'Grandparent',
    'dead',
    'Unknown',
    'unknown',
    '1a000000-0000-0000-0000-000000000013'
  ),
  (
    '1a000000-0000-0000-0000-000000000011',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'Parent',
    'alive',
    null,
    null,
    '1a000000-0000-0000-0000-000000000012'
  ),
  (
    '1a000000-0000-0000-0000-000000000010',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'Center',
    'alive',
    null,
    null,
    '1a000000-0000-0000-0000-000000000011'
  );

-- Descendant chain.
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
    '1a000000-0000-0000-0000-000000000020',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'Child',
    'alive',
    '1a000000-0000-0000-0000-000000000010'
  ),
  (
    '1a000000-0000-0000-0000-000000000024',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'ChildB',
    'alive',
    '1a000000-0000-0000-0000-000000000010'
  ),
  (
    '1a000000-0000-0000-0000-000000000021',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'Grandchild',
    'alive',
    '1a000000-0000-0000-0000-000000000020'
  ),
  (
    '1a000000-0000-0000-0000-000000000022',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'GreatGrandchild',
    'alive',
    '1a000000-0000-0000-0000-000000000021'
  ),
  (
    '1a000000-0000-0000-0000-000000000023',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'GreatGreatGrandchild',
    'alive',
    '1a000000-0000-0000-0000-000000000022'
  );

-- Partners: one active, one dissolved.
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
    '1a000000-0000-0000-0000-000000000030',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'ActivePartner',
    'alive'
  ),
  (
    '1a000000-0000-0000-0000-000000000031',
    '1a000000-0000-0000-0000-000000000002',
    '1a000000-0000-0000-0000-000000000004',
    'npc',
    'ExPartner',
    'alive'
  );

insert into
  public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number
  )
values
  (
    '1a000000-0000-0000-0000-000000000010',
    '1a000000-0000-0000-0000-000000000030',
    'active',
    1,
    null
  ),
  (
    '1a000000-0000-0000-0000-000000000010',
    '1a000000-0000-0000-0000-000000000031',
    'dissolved',
    1,
    2
  );

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        node_path = 'root'
        and direction = 'self'
        and citizen_id = '1a000000-0000-0000-0000-000000000010'
    ),
    1,
    'the centered citizen appears exactly once as the self node'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        direction = 'ancestor'
    ),
    3,
    'exactly 3 known ancestor generations are returned (Parent, Grandparent, GreatGrandparent)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        direction = 'unknown'
    ),
    3,
    'each ancestor generation contributes one Unknown terminator for the empty parent_b slot'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        citizen_id = '1a000000-0000-0000-0000-000000000014'
    ),
    0,
    'ancestor recursion is capped at 3 generations -- the 4th-gen ancestor is absent'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        direction = 'descendant'
    ),
    4,
    'exactly 4 descendant rows are returned (Child, ChildB, Grandchild, GreatGrandchild)'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        citizen_id = '1a000000-0000-0000-0000-000000000023'
    ),
    0,
    'descendant recursion is capped at 3 generations -- the 4th-gen descendant is absent'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        direction = 'unknown'
        and generation > 0
    ),
    0,
    'a childless descendant never renders an Unknown placeholder for its children'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        direction = 'partner'
        and citizen_id = '1a000000-0000-0000-0000-000000000030'
    ),
    1,
    'the active partner is included in the tree'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.get_citizen_family_tree ('1a000000-0000-0000-0000-000000000010')
      where
        citizen_id = '1a000000-0000-0000-0000-000000000031'
    ),
    0,
    'a dissolved partnership does not appear in the tree'
  );

select
  *
from
  finish ();

rollback;
