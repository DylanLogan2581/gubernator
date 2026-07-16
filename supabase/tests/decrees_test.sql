-- pgTAP tests for public.decrees, public.issue_decree and
-- public.revoke_decree (#1121): authority guards (manage-nation /
-- manage-settlement), issued_by resolution (manager citizen vs. admin's
-- explicit citizen id), RLS read visibility, revoked decrees staying
-- visible, and the no-direct-write guarantee.
-- Run with: npx supabase test db
begin;

select
  plan (19);

-- A scratch table to stash ids returned by RPC calls across role switches --
-- avoids relying on psql variables, mirroring law_documents_test.sql.
create temporary table decree_test_ids (key text primary key, id uuid not null);

grant
select
,
  insert on decree_test_ids to authenticated;

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
    '2a000000-0000-0000-0000-000000000001',
    'decree-admin@example.com',
    'x',
    now(),
    '{"username":"decree_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '2a000000-0000-0000-0000-000000000002',
    'decree-nation-manager@example.com',
    'x',
    now(),
    '{"username":"decree_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '2a000000-0000-0000-0000-000000000003',
    'decree-outsider@example.com',
    'x',
    now(),
    '{"username":"decree_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '2a000000-0000-0000-0000-000000000004',
    'decree-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"decree_settlement_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    '2b000000-0000-0000-0000-000000000001',
    'Decree World',
    'active',
    9
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '2b000000-0000-0000-0000-000000000001',
    '2a000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '2c000000-0000-0000-0000-000000000001',
    '2b000000-0000-0000-0000-000000000001',
    'Decree Nation',
    'republic'
  ),
  (
    '2c000000-0000-0000-0000-000000000002',
    '2b000000-0000-0000-0000-000000000001',
    'Other Nation',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '2d000000-0000-0000-0000-000000000001',
    '2c000000-0000-0000-0000-000000000001',
    'Decree Settlement'
  ),
  (
    '2d000000-0000-0000-0000-000000000002',
    '2c000000-0000-0000-0000-000000000002',
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
    role_nation_id,
    role_settlement_id
  )
values
  (
    '2e000000-0000-0000-0000-000000000001',
    '2b000000-0000-0000-0000-000000000001',
    '2d000000-0000-0000-0000-000000000001',
    'player_character',
    'NationManager',
    'alive',
    '2a000000-0000-0000-0000-000000000002',
    'nation_manager',
    '2c000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '2e000000-0000-0000-0000-000000000002',
    '2b000000-0000-0000-0000-000000000001',
    '2d000000-0000-0000-0000-000000000001',
    'player_character',
    'SettlementManager',
    'alive',
    '2a000000-0000-0000-0000-000000000004',
    'settlement_manager',
    null,
    '2d000000-0000-0000-0000-000000000001'
  ),
  (
    '2e000000-0000-0000-0000-000000000003',
    '2b000000-0000-0000-0000-000000000001',
    '2d000000-0000-0000-0000-000000000001',
    'npc',
    'RulerBySpirit',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    '2e000000-0000-0000-0000-000000000004',
    '2b000000-0000-0000-0000-000000000001',
    '2d000000-0000-0000-0000-000000000002',
    'npc',
    'ForeignCitizen',
    'alive',
    null,
    'none',
    null,
    null
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause_category,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    '2e000000-0000-0000-0000-000000000005',
    '2b000000-0000-0000-0000-000000000001',
    '2d000000-0000-0000-0000-000000000001',
    'npc',
    'DeadCitizen',
    'dead',
    'unknown',
    null,
    'none',
    null,
    null
  );

-- ===========================================================================
-- issue_decree: happy path (nation manager) writes a decree with the
-- manager's own citizen id as issuer, trims the title, and stamps the
-- world's current turn number.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  decree_test_ids (key, id)
select
  'nation_decree',
  (
    public.issue_decree (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => ' All exports of amulets are banned ',
      p_body_markdown => 'By order of the crown, amulet exports cease immediately.',
      p_issued_by_citizen_id => null
    )
  ).id;

reset role;

select
  is (
    (
      select
        format(
          '%s|%s|%s|%s|%s',
          title,
          issued_by_citizen_id,
          issued_turn_number,
          revoked_turn_number,
          nation_id
        )
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'nation_decree'
        )
    ),
    format(
      '%s|%s|%s|%s|%s',
      'All exports of amulets are banned',
      '2e000000-0000-0000-0000-000000000001'::uuid,
      9,
      null::integer,
      '2c000000-0000-0000-0000-000000000001'::uuid
    ),
    'issue_decree trims the title and records the manager citizen as issuer'
  );

-- ===========================================================================
-- issue_decree: validation and authority guards.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      null,
      '  ',
      'Body.',
      null
    )
  $test$,
    '22023',
    null,
    'a blank title is rejected'
  );

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000002',
      null,
      'Hijacked Decree',
      'Body.',
      null
    )
  $test$,
    '42501',
    null,
    'a nation manager cannot issue a decree for another nation'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      null,
      'Outsider Decree',
      'Body.',
      null
    )
  $test$,
    '42501',
    null,
    'an outsider cannot issue a decree for a nation they do not manage'
  );

reset role;

-- ===========================================================================
-- issue_decree: settlement manager, settlement-scoped decree.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into
  decree_test_ids (key, id)
select
  'settlement_decree',
  (
    public.issue_decree (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => null,
      p_settlement_id => '2d000000-0000-0000-0000-000000000001',
      p_title => 'Curfew Declared',
      p_body_markdown => 'All citizens must be indoors by nightfall.',
      p_issued_by_citizen_id => null
    )
  ).id;

reset role;

select
  is (
    (
      select
        format(
          '%s|%s|%s',
          issued_by_citizen_id,
          nation_id,
          settlement_id
        )
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'settlement_decree'
        )
    ),
    format(
      '%s|%s|%s',
      '2e000000-0000-0000-0000-000000000002'::uuid,
      null::uuid,
      '2d000000-0000-0000-0000-000000000001'::uuid
    ),
    'a settlement manager can issue a settlement-scoped decree as themselves'
  );

-- ===========================================================================
-- issue_decree: world admin path records the explicitly passed acting
-- citizen id (here, an NPC with no user account) instead of resolving one
-- from auth.uid().
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      null,
      'Admin Decree Without Actor',
      'Body.',
      null
    )
  $test$,
    '22023',
    null,
    'an admin must pass an explicit issued-by citizen id'
  );

insert into
  decree_test_ids (key, id)
select
  'admin_decree',
  (
    public.issue_decree (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => 'Admin-Recorded Decree',
      p_body_markdown => 'Issued on behalf of the ruler by spirit.',
      p_issued_by_citizen_id => '2e000000-0000-0000-0000-000000000003'
    )
  ).id;

reset role;

select
  is (
    (
      select
        issued_by_citizen_id
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'admin_decree'
        )
    ),
    '2e000000-0000-0000-0000-000000000003'::uuid,
    'a world admin records the explicitly passed acting citizen as issuer'
  );

-- ===========================================================================
-- issue_decree (#1145): the world admin's explicitly passed citizen must be
-- alive and scoped to the decree's own nation/settlement -- not merely
-- "exists in this world".
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      null,
      'Foreign Actor Decree',
      'Body.',
      '2e000000-0000-0000-0000-000000000004'
    )
  $test$,
    'P0001',
    null,
    'a world admin cannot attribute a nation decree to a citizen of another nation'
  );

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      null,
      'Dead Actor Decree',
      'Body.',
      '2e000000-0000-0000-0000-000000000005'
    )
  $test$,
    'P0001',
    null,
    'a world admin cannot attribute a nation decree to a dead citizen'
  );

select
  throws_ok (
    $test$
    select public.issue_decree(
      '2b000000-0000-0000-0000-000000000001',
      null,
      '2d000000-0000-0000-0000-000000000001',
      'Foreign Actor Settlement Decree',
      'Body.',
      '2e000000-0000-0000-0000-000000000004'
    )
  $test$,
    'P0001',
    null,
    'a world admin cannot attribute a settlement decree to a citizen of another settlement'
  );

reset role;

-- ===========================================================================
-- No direct write path: the decrees table grants SELECT only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.decrees (
      world_id, nation_id, title, body_markdown, issued_by_citizen_id, issued_turn_number
    )
    values (
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      'Snuck in.',
      'Body.',
      '2e000000-0000-0000-0000-000000000001',
      9
    )
  $test$,
    '42501',
    null,
    'a direct INSERT into decrees is rejected for an authenticated role'
  );

reset role;

-- ===========================================================================
-- Table constraint: exactly one of nation_id / settlement_id must be set.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.decrees (
      world_id, nation_id, settlement_id, title, body_markdown, issued_turn_number
    )
    values (
      '2b000000-0000-0000-0000-000000000001',
      '2c000000-0000-0000-0000-000000000001',
      '2d000000-0000-0000-0000-000000000001',
      'Both Scopes Decree',
      'Body.',
      9
    )
  $test$,
    '23514',
    null,
    'setting both nation_id and settlement_id is rejected'
  );

-- ===========================================================================
-- SELECT: a world member (nation manager) can read the nation decree; an
-- outsider with no world access cannot.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'nation_decree'
        )
    ),
    1,
    'a nation member can select their nation''s decree'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'nation_decree'
        )
    ),
    0,
    'an outsider with no world access cannot select the decree'
  );

reset role;

-- ===========================================================================
-- revoke_decree: authority guards, revoked decrees stay visible, and
-- revoking twice is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.revoke_decree(%L)$test$,
      (
        select
          id
        from
          decree_test_ids
        where
          key = 'nation_decree'
      )
    ),
    '42501',
    null,
    'an outsider cannot revoke a decree they do not manage'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.revoke_decree (
    (
      select
        id
      from
        decree_test_ids
      where
        key = 'nation_decree'
    )
  );

reset role;

select
  is (
    (
      select
        revoked_turn_number
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'nation_decree'
        )
    ),
    9,
    'revoke_decree stamps the world''s current turn number'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.decrees
      where
        id = (
          select
            id
          from
            decree_test_ids
          where
            key = 'nation_decree'
        )
    ),
    1,
    'a revoked decree remains visible to a world member'
  );

select
  throws_ok (
    format(
      $test$select public.revoke_decree(%L)$test$,
      (
        select
          id
        from
          decree_test_ids
        where
          key = 'nation_decree'
      )
    ),
    '22023',
    null,
    'revoking an already-revoked decree is rejected'
  );

reset role;

select
  throws_ok (
    $test$select public.revoke_decree('00000000-0000-0000-0000-000000000000')$test$,
    'P0002',
    null,
    'revoking a nonexistent decree is rejected'
  );

select
  *
from
  finish ();

rollback;
