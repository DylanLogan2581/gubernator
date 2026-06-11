-- pgTAP tests for bilateral nation_relationship mirroring and the
-- respond_to_bilateral RPC. Run with: npx supabase test db
--
-- Covers:
--   • After B accepts A's alliance proposal, both (A→B) and (B→A) rows show
--     current_stance = 'allied'.
--   • After A withdraws (updating A's own row), both rows return to neutral.
--   • After B withdraws (updating B's own row), both rows return to neutral.
--   • Setting a unilateral stance over an existing bilateral clears the
--     symmetric row back to neutral.
--   • An unauthorized caller (no nation manager role) gets an empty set from
--     respond_to_bilateral.
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
    'e0000000-0000-0000-0000-000000000001',
    'bilateral-mgr-a@example.com',
    'x',
    now(),
    '{"username":"bilateral_mgr_a"}'::jsonb,
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'bilateral-mgr-b@example.com',
    'x',
    now(),
    '{"username":"bilateral_mgr_b"}'::jsonb,
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'bilateral-outsider@example.com',
    'x',
    now(),
    '{"username":"bilateral_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'Bilateral Mirror World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'e2000000-0000-0000-0000-00000000000a',
    'e1000000-0000-0000-0000-000000000001',
    'Nation A',
    false
  ),
  (
    'e2000000-0000-0000-0000-00000000000b',
    'e1000000-0000-0000-0000-000000000001',
    'Nation B',
    false
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e3000000-0000-0000-0000-0000000000a1',
    'e2000000-0000-0000-0000-00000000000a',
    'Settlement A1'
  ),
  (
    'e3000000-0000-0000-0000-0000000000b1',
    'e2000000-0000-0000-0000-00000000000b',
    'Settlement B1'
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
    'e4000000-0000-0000-0000-0000000000a1',
    'e1000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation A Manager PC',
    'alive',
    'e0000000-0000-0000-0000-000000000001',
    'nation_manager',
    'e2000000-0000-0000-0000-00000000000a'
  ),
  (
    'e4000000-0000-0000-0000-0000000000b1',
    'e1000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-0000000000b1',
    'player_character',
    'Nation B Manager PC',
    'alive',
    'e0000000-0000-0000-0000-000000000002',
    'nation_manager',
    'e2000000-0000-0000-0000-00000000000b'
  );

-- Seed Nation A's proposal row (table owner bypasses RLS).
insert into
  public.nation_relationships (
    from_nation_id,
    to_nation_id,
    pending_stance,
    pending_status
  )
values
  (
    'e2000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-00000000000b',
    'allied',
    'proposed'
  );

-- ===========================================================================
-- B's manager accepts the proposal via respond_to_bilateral.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        current_stance
      from
        public.respond_to_bilateral (
          'e2000000-0000-0000-0000-00000000000a',
          'e2000000-0000-0000-0000-00000000000b',
          'accepted'
        )
    ),
    'allied',
    'respond_to_bilateral returns the proposer row with current_stance=allied'
  );

reset role;

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000b'
    ),
    'allied',
    'proposer row (A→B) has current_stance=allied after B accepts'
  );

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000b'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    'allied',
    'symmetric row (B→A) has current_stance=allied after B accepts'
  );

-- ===========================================================================
-- A withdraws by updating A's own row. The mirror trigger clears (B→A).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

update public.nation_relationships
set
  current_stance = 'neutral',
  pending_stance = null,
  pending_status = 'withdrawn',
  pending_changed_by_citizen_id = null
where
  from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
  and to_nation_id = 'e2000000-0000-0000-0000-00000000000b';

reset role;

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000b'
    ),
    'neutral',
    'proposer row (A→B) has current_stance=neutral after A withdraws'
  );

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000b'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    'neutral',
    'symmetric row (B→A) has current_stance=neutral after A withdraws'
  );

-- ===========================================================================
-- Re-establish alliance (table owner, bypasses RLS). The trigger mirrors the
-- bilateral stance to the symmetric row automatically.
-- ===========================================================================
update public.nation_relationships
set
  current_stance = 'allied',
  pending_stance = null,
  pending_status = null
where
  from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
  and to_nation_id = 'e2000000-0000-0000-0000-00000000000b';

-- ===========================================================================
-- B withdraws by updating B's own row. The mirror trigger clears (A→B).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';

update public.nation_relationships
set
  current_stance = 'neutral',
  pending_stance = null,
  pending_status = 'withdrawn',
  pending_changed_by_citizen_id = null
where
  from_nation_id = 'e2000000-0000-0000-0000-00000000000b'
  and to_nation_id = 'e2000000-0000-0000-0000-00000000000a';

reset role;

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000b'
    ),
    'neutral',
    'proposer row (A→B) has current_stance=neutral after B withdraws'
  );

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000b'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    'neutral',
    'symmetric row (B→A) has current_stance=neutral after B withdraws'
  );

-- ===========================================================================
-- Re-establish alliance, then A sets a unilateral stance. The trigger clears
-- the symmetric (B→A) row back to neutral.
-- ===========================================================================
update public.nation_relationships
set
  current_stance = 'allied',
  pending_stance = null,
  pending_status = null
where
  from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
  and to_nation_id = 'e2000000-0000-0000-0000-00000000000b';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  public.nation_relationships (
    from_nation_id,
    to_nation_id,
    current_stance,
    pending_stance,
    pending_status,
    pending_changed_by_citizen_id
  )
values
  (
    'e2000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-00000000000b',
    'hostile',
    null,
    null,
    null
  )
on conflict (from_nation_id, to_nation_id) do update
set
  current_stance = 'hostile',
  pending_stance = null,
  pending_status = null,
  pending_changed_by_citizen_id = null;

reset role;

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'e2000000-0000-0000-0000-00000000000b'
        and to_nation_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    'neutral',
    'symmetric row (B→A) is cleared to neutral when A sets a unilateral stance over the bilateral'
  );

-- ===========================================================================
-- Unauthorized caller cannot use respond_to_bilateral.
-- ===========================================================================
-- Reset (A→B) to a pending proposal state so there is something to respond to.
update public.nation_relationships
set
  current_stance = 'neutral',
  pending_stance = 'allied',
  pending_status = 'proposed'
where
  from_nation_id = 'e2000000-0000-0000-0000-00000000000a'
  and to_nation_id = 'e2000000-0000-0000-0000-00000000000b';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.respond_to_bilateral (
          'e2000000-0000-0000-0000-00000000000a',
          'e2000000-0000-0000-0000-00000000000b',
          'accepted'
        )
    ),
    0,
    'unauthorized caller gets empty set from respond_to_bilateral'
  );

reset role;

select
  *
from
  finish ();

rollback;
