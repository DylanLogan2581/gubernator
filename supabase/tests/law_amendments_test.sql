-- pgTAP tests for public.law_amendments, public.law_amendment_votes,
-- public.propose_law_amendment, public.cast_law_amendment_vote,
-- public.withdraw_law_amendment, and the turn-transition expiry hook
-- (#1119): decree instant-apply, vote pass/early-fail/bicameral, withdraw,
-- atomic operation application, and deadline expiry.
-- Run with: npx supabase test db
begin;

select
  plan (46);

-- A scratch table to stash ids returned by RPC calls across role switches --
-- mirrors law_documents_test.sql / nation_readiness_voting_test.sql.
create temporary table amendment_test_ids (key text primary key, id uuid not null);

grant
select
,
  insert on amendment_test_ids to authenticated;

-- ===========================================================================
-- Fixtures
-- ===========================================================================
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
    '4a000000-0000-0000-0000-000000000001',
    'amend-admin@example.com',
    'x',
    now(),
    '{"username":"amend_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000002',
    'amend-ruler@example.com',
    'x',
    now(),
    '{"username":"amend_ruler"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000003',
    'amend-m1@example.com',
    'x',
    now(),
    '{"username":"amend_m1"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000004',
    'amend-m2@example.com',
    'x',
    now(),
    '{"username":"amend_m2"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000005',
    'amend-m3@example.com',
    'x',
    now(),
    '{"username":"amend_m3"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000006',
    'amend-m4@example.com',
    'x',
    now(),
    '{"username":"amend_m4"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000007',
    'amend-m5@example.com',
    'x',
    now(),
    '{"username":"amend_m5"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000008',
    'amend-outsider@example.com',
    'x',
    now(),
    '{"username":"amend_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '4a000000-0000-0000-0000-000000000009',
    'amend-nonmember@example.com',
    'x',
    now(),
    '{"username":"amend_nonmember"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    '4b000000-0000-0000-0000-000000000001',
    'Amendment World',
    'private',
    'active',
    10
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '4b000000-0000-0000-0000-000000000001',
    '4a000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '4c000000-0000-0000-0000-000000000001',
    '4b000000-0000-0000-0000-000000000001',
    'Amendment Nation',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '4c900000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    'Amendment Settlement'
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
    '4e000000-0000-0000-0000-000000000001',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'player_character',
    'Ruler',
    'alive',
    '4a000000-0000-0000-0000-000000000002',
    'nation_manager',
    '4c000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000002',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'player_character',
    'MemberOne',
    'alive',
    '4a000000-0000-0000-0000-000000000003',
    'none',
    null,
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000003',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'player_character',
    'MemberTwo',
    'alive',
    '4a000000-0000-0000-0000-000000000004',
    'none',
    null,
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000004',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'player_character',
    'MemberThree',
    'alive',
    '4a000000-0000-0000-0000-000000000005',
    'none',
    null,
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000005',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'npc',
    'NpcMember',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000006',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'player_character',
    'ChamberTwoOne',
    'alive',
    '4a000000-0000-0000-0000-000000000006',
    'none',
    null,
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000007',
    '4b000000-0000-0000-0000-000000000001',
    '4c900000-0000-0000-0000-000000000001',
    'player_character',
    'ChamberTwoTwo',
    'alive',
    '4a000000-0000-0000-0000-000000000007',
    'none',
    null,
    null
  ),
  (
    '4e000000-0000-0000-0000-000000000008',
    '4b000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'NonMember',
    'alive',
    '4a000000-0000-0000-0000-000000000009',
    'none',
    null,
    null
  );

insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    '4a000000-0000-0000-0000-000000000002',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000001'
  ),
  (
    '4a000000-0000-0000-0000-000000000003',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000002'
  ),
  (
    '4a000000-0000-0000-0000-000000000004',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000003'
  ),
  (
    '4a000000-0000-0000-0000-000000000005',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000004'
  ),
  (
    '4a000000-0000-0000-0000-000000000006',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000006'
  ),
  (
    '4a000000-0000-0000-0000-000000000007',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000007'
  ),
  (
    '4a000000-0000-0000-0000-000000000009',
    '4b000000-0000-0000-0000-000000000001',
    '4e000000-0000-0000-0000-000000000008'
  );

insert into
  public.government_bodies (
    id,
    world_id,
    nation_id,
    settlement_id,
    name,
    description,
    composition_json
  )
values
  (
    '4f000000-0000-0000-0000-000000000001',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'The Senate',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'kind',
        'citizens',
        'citizen_ids',
        jsonb_build_array(
          '4e000000-0000-0000-0000-000000000002',
          '4e000000-0000-0000-0000-000000000003',
          '4e000000-0000-0000-0000-000000000004',
          '4e000000-0000-0000-0000-000000000005'
        )
      )
    )
  ),
  (
    '4f000000-0000-0000-0000-000000000002',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'The Assembly',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'kind',
        'citizens',
        'citizen_ids',
        jsonb_build_array(
          '4e000000-0000-0000-0000-000000000006',
          '4e000000-0000-0000-0000-000000000007'
        )
      )
    )
  ),
  (
    '4f000000-0000-0000-0000-000000000003',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'The Double Pass Council',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'kind',
        'citizens',
        'citizen_ids',
        jsonb_build_array(
          '4e000000-0000-0000-0000-000000000002',
          '4e000000-0000-0000-0000-000000000003'
        )
      )
    )
  );

insert into
  public.law_documents (
    id,
    world_id,
    nation_id,
    settlement_id,
    title,
    status,
    amendment_procedure_json,
    current_version,
    created_turn_number
  )
values
  (
    '4d000000-0000-0000-0000-000000000001',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Decree Charter',
    'active',
    jsonb_build_object('kind', 'decree', 'authority', 'ruler'),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000002',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Vote Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000001',
      'threshold',
      'majority',
      'votingPeriodTurns',
      2,
      'secondBodyId',
      null
    ),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000003',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Bicameral Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000001',
      'threshold',
      'majority',
      'votingPeriodTurns',
      2,
      'secondBodyId',
      '4f000000-0000-0000-0000-000000000002'
    ),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000004',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Atomic Charter',
    'active',
    jsonb_build_object('kind', 'decree', 'authority', 'ruler'),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000005',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Expiry Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000001',
      'threshold',
      'majority',
      'votingPeriodTurns',
      1,
      'secondBodyId',
      null
    ),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000006',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Long Vote Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000001',
      'threshold',
      'majority',
      'votingPeriodTurns',
      5,
      'secondBodyId',
      null
    ),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000007',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Withdraw Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000001',
      'threshold',
      'majority',
      'votingPeriodTurns',
      2,
      'secondBodyId',
      null
    ),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000008',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Unreachable Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000001',
      'threshold',
      'majority',
      'votingPeriodTurns',
      2,
      'secondBodyId',
      null
    ),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-000000000009',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Locked Charter',
    'active',
    jsonb_build_object('kind', 'locked'),
    1,
    10
  ),
  (
    '4d000000-0000-0000-0000-00000000000a',
    '4b000000-0000-0000-0000-000000000001',
    '4c000000-0000-0000-0000-000000000001',
    null,
    'Double Pass Charter',
    'active',
    jsonb_build_object(
      'kind',
      'vote',
      'bodyId',
      '4f000000-0000-0000-0000-000000000003',
      'threshold',
      'majority',
      'votingPeriodTurns',
      2,
      'secondBodyId',
      null
    ),
    1,
    10
  );

insert into
  public.law_articles (
    id,
    document_id,
    article_number,
    heading,
    body_markdown,
    status,
    sort_order
  )
values
  (
    '48000000-0000-0000-0000-000000000001',
    '4d000000-0000-0000-0000-000000000001',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000002',
    '4d000000-0000-0000-0000-000000000002',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000003',
    '4d000000-0000-0000-0000-000000000003',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000004',
    '4d000000-0000-0000-0000-000000000004',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000005',
    '4d000000-0000-0000-0000-000000000005',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000006',
    '4d000000-0000-0000-0000-000000000006',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000007',
    '4d000000-0000-0000-0000-000000000007',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000008',
    '4d000000-0000-0000-0000-000000000008',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-000000000009',
    '4d000000-0000-0000-0000-000000000009',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  ),
  (
    '48000000-0000-0000-0000-00000000000a',
    '4d000000-0000-0000-0000-00000000000a',
    1,
    'Article I',
    'Original body.',
    'active',
    1
  );

-- ===========================================================================
-- Decree: ruler instant-applies, non-ruler is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'decree_amendment',
  (
    public.propose_law_amendment (
      p_document_id => '4d000000-0000-0000-0000-000000000001',
      p_proposing_citizen_id => '4e000000-0000-0000-0000-000000000001',
      p_title => 'Grain Tithe Reform',
      p_rationale_markdown => null,
      p_operations_json => jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000001',
          'heading',
          'Article I Amended',
          'body_markdown',
          'New body.'
        )
      )
    )
  ).id;

reset role;

select
  is (
    (
      select
        format('%s|%s', status, resolved_turn_number)
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'decree_amendment'
        )
    ),
    'passed|10',
    'a decree amendment instant-applies and resolves in the proposing turn'
  );

select
  is (
    (
      select
        current_version
      from
        public.law_documents
      where
        id = '4d000000-0000-0000-0000-000000000001'
    ),
    2,
    'decree instant-apply bumps the document version'
  );

select
  is (
    (
      select
        format('%s|%s', heading, body_markdown)
      from
        public.law_articles
      where
        id = '48000000-0000-0000-0000-000000000001'
    ),
    'Article I Amended|New body.',
    'decree instant-apply mutates the article'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_amendment_votes
      where
        amendment_id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'decree_amendment'
        )
    ),
    0,
    'a decree amendment writes no vote rows'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.propose_law_amendment('4d000000-0000-0000-0000-000000000001'::uuid, '4e000000-0000-0000-0000-000000000002'::uuid, 'Usurped Decree', null, %L::jsonb)$test$,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000001',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    ),
    '42501',
    null,
    'a non-ruler cannot instant-apply a decree amendment'
  );

reset role;

-- ===========================================================================
-- Locked procedure: only an admin override can propose.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.propose_law_amendment('4d000000-0000-0000-0000-000000000009'::uuid, '4e000000-0000-0000-0000-000000000001'::uuid, 'Ruler Tries Locked', null, %L::jsonb)$test$,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000009',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    ),
    '42501',
    null,
    'the ruler cannot propose against a locked procedure'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.propose_law_amendment (
    '4d000000-0000-0000-0000-000000000009',
    '4e000000-0000-0000-0000-000000000001',
    'Admin Override',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'op',
        'amend_article',
        'article_id',
        '48000000-0000-0000-0000-000000000009',
        'heading',
        'Overridden',
        'body_markdown',
        'Z'
      )
    )
  );

reset role;

select
  is (
    (
      select
        heading
      from
        public.law_articles
      where
        id = '48000000-0000-0000-0000-000000000009'
    ),
    'Overridden',
    'a world admin can instant-apply against a locked procedure'
  );

-- ===========================================================================
-- Vote-kind proposal authority: a body member/ruler may propose, an
-- unaffiliated world member may not.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000009","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.propose_law_amendment('4d000000-0000-0000-0000-000000000002'::uuid, '4e000000-0000-0000-0000-000000000008'::uuid, 'Outsider Bill', null, %L::jsonb)$test$,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000002',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    ),
    '42501',
    null,
    'a non-member, non-ruler citizen cannot propose a vote-kind amendment'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'vote_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-000000000002',
      '4e000000-0000-0000-0000-000000000002',
      'Road Tax Reform',
      'Because roads.',
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000002',
          'heading',
          'Road Tax',
          'body_markdown',
          'Roads funded.'
        )
      )
    )
  ).id;

reset role;

select
  is (
    (
      select
        format('%s|%s', status, deadline_turn_number)
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'vote_amendment'
        )
    ),
    'proposed|12',
    'a member-proposed vote amendment opens with a deadline of proposed turn + voting period'
  );

-- ===========================================================================
-- Vote authority + pass: non-member rejected, self-vote across citizens
-- rejected, PC self-vote ok, admin-for-NPC ok; third yes vote reaches
-- majority (3/4) and applies immediately.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000009","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.cast_law_amendment_vote(%L::uuid, '4e000000-0000-0000-0000-000000000008'::uuid, true)$test$,
      (
        select
          id
        from
          amendment_test_ids
        where
          key = 'vote_amendment'
      )
    ),
    '42501',
    null,
    'a non-member citizen cannot cast a vote'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.cast_law_amendment_vote(%L::uuid, '4e000000-0000-0000-0000-000000000003'::uuid, true)$test$,
      (
        select
          id
        from
          amendment_test_ids
        where
          key = 'vote_amendment'
      )
    ),
    '42501',
    null,
    'a PC cannot cast a vote as a different citizen'
  );

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'vote_amendment'
    ),
    '4e000000-0000-0000-0000-000000000002',
    true
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'vote_amendment'
    ),
    '4e000000-0000-0000-0000-000000000005',
    true
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'vote_amendment'
        )
    ),
    'proposed',
    'the amendment is still open after two of four members vote yes'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'vote_amendment'
    ),
    '4e000000-0000-0000-0000-000000000003',
    true
  );

reset role;

select
  is (
    (
      select
        format('%s|%s', status, resolved_turn_number)
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'vote_amendment'
        )
    ),
    'passed|10',
    'the amendment passes as soon as the yes tally clears the threshold against total membership'
  );

select
  is (
    (
      select
        format('%s|%s', heading, body_markdown)
      from
        public.law_articles
      where
        id = '48000000-0000-0000-0000-000000000002'
    ),
    'Road Tax|Roads funded.',
    'a passed vote amendment applies its operations'
  );

select
  is (
    (
      select
        current_version
      from
        public.law_documents
      where
        id = '4d000000-0000-0000-0000-000000000002'
    ),
    2,
    'a passed vote amendment bumps the document version'
  );

-- ===========================================================================
-- Early failure: once yes can no longer mathematically reach the threshold,
-- the amendment fails before the deadline.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'unreachable_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-000000000008',
      '4e000000-0000-0000-0000-000000000001',
      'Unpopular Reform',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'repeal_article',
          'article_id',
          '48000000-0000-0000-0000-000000000008'
        )
      )
    )
  ).id;

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'unreachable_amendment'
    ),
    '4e000000-0000-0000-0000-000000000002',
    false
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'unreachable_amendment'
    ),
    '4e000000-0000-0000-0000-000000000003',
    false
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'unreachable_amendment'
        )
    ),
    'failed',
    'the amendment fails early once a majority can no longer be mathematically reached'
  );

select
  is (
    (
      select
        status
      from
        public.law_articles
      where
        id = '48000000-0000-0000-0000-000000000008'
    ),
    'active',
    'a failed amendment never applies its operations'
  );

-- ===========================================================================
-- Bicameral: both chambers must independently pass before operations apply.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'bicameral_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-000000000003',
      '4e000000-0000-0000-0000-000000000001',
      'Two Chamber Reform',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000003',
          'heading',
          'Bicameral Passed',
          'body_markdown',
          'Both chambers agreed.'
        )
      )
    )
  ).id;

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'bicameral_amendment'
    ),
    '4e000000-0000-0000-0000-000000000002',
    true
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'bicameral_amendment'
    ),
    '4e000000-0000-0000-0000-000000000003',
    true
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'bicameral_amendment'
    ),
    '4e000000-0000-0000-0000-000000000004',
    true
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'bicameral_amendment'
    ),
    '4e000000-0000-0000-0000-000000000006',
    true
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'bicameral_amendment'
        )
    ),
    'proposed',
    'a bicameral amendment stays open once only the first chamber has passed'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'bicameral_amendment'
    ),
    '4e000000-0000-0000-0000-000000000007',
    true
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'bicameral_amendment'
        )
    ),
    'passed',
    'a bicameral amendment passes only once both chambers have independently passed'
  );

select
  is (
    (
      select
        current_version
      from
        public.law_documents
      where
        id = '4d000000-0000-0000-0000-000000000003'
    ),
    2,
    'a bicameral amendment applies its operations exactly once'
  );

-- ===========================================================================
-- Withdraw: proposer or admin only, and only while open.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'withdraw_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-000000000007',
      '4e000000-0000-0000-0000-000000000002',
      'Withdrawn Bill',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000007',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    )
  ).id;

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000009","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.withdraw_law_amendment(%L::uuid)$test$,
      (
        select
          id
        from
          amendment_test_ids
        where
          key = 'withdraw_amendment'
      )
    ),
    '42501',
    null,
    'a citizen who is neither the proposer nor an admin cannot withdraw'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.withdraw_law_amendment (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'withdraw_amendment'
    )
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'withdraw_amendment'
        )
    ),
    'withdrawn',
    'the proposer can withdraw their own open amendment'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.withdraw_law_amendment(%L::uuid)$test$,
      (
        select
          id
        from
          amendment_test_ids
        where
          key = 'withdraw_amendment'
      )
    ),
    '22023',
    null,
    'withdrawing an already-withdrawn amendment is rejected'
  );

select
  throws_ok (
    format(
      $test$select public.cast_law_amendment_vote(%L::uuid, '4e000000-0000-0000-0000-000000000002'::uuid, true)$test$,
      (
        select
          id
        from
          amendment_test_ids
        where
          key = 'withdraw_amendment'
      )
    ),
    '22023',
    null,
    'voting on a withdrawn amendment is rejected'
  );

reset role;

-- ===========================================================================
-- Atomic application: a batch with one invalid operation rolls back
-- everything, including the amendment row itself.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.propose_law_amendment('4d000000-0000-0000-0000-000000000004'::uuid, '4e000000-0000-0000-0000-000000000001'::uuid, 'Bad Batch', null, %L::jsonb)$test$,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'add_article',
          'heading',
          'Valid Add',
          'body_markdown',
          'Body.'
        ),
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '00000000-0000-0000-0000-000000000000',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    ),
    '22023',
    null,
    'a batch containing an invalid operation is rejected'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_articles
      where
        document_id = '4d000000-0000-0000-0000-000000000004'
    ),
    1,
    'a rolled-back batch leaves the article set unchanged'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_amendments
      where
        document_id = '4d000000-0000-0000-0000-000000000004'
        and title = 'Bad Batch'
    ),
    0,
    'a rolled-back batch leaves no amendment row behind'
  );

-- ===========================================================================
-- Operation validation: an empty operations array is rejected outright.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$select public.propose_law_amendment('4d000000-0000-0000-0000-000000000004'::uuid, '4e000000-0000-0000-0000-000000000001'::uuid, 'Empty Ops', null, '[]'::jsonb)$test$,
    '22023',
    null,
    'proposing with an empty operations array is rejected'
  );

-- add_article position is clamped to the current active article range.
select
  public.propose_law_amendment (
    '4d000000-0000-0000-0000-000000000004',
    '4e000000-0000-0000-0000-000000000001',
    'Clamped Add',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'op',
        'add_article',
        'position',
        999,
        'heading',
        'Tacked On',
        'body_markdown',
        'End of the list.'
      )
    )
  );

reset role;

select
  is (
    (
      select
        sort_order
      from
        public.law_articles
      where
        document_id = '4d000000-0000-0000-0000-000000000004'
        and heading = 'Tacked On'
    ),
    2,
    'an out-of-range add_article position is clamped to the end of the active list'
  );

-- ===========================================================================
-- RLS: a world member can read amendments/votes; an outsider cannot.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'vote_amendment'
        )
    ),
    1,
    'a world member can select a law amendment'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_amendment_votes
      where
        amendment_id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'vote_amendment'
        )
    ),
    3,
    'a world member can select an amendment''s votes'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000008","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'vote_amendment'
        )
    ),
    0,
    'an outsider with no world access cannot select a law amendment'
  );

reset role;

-- ===========================================================================
-- Turn-hook expiry: a still-open amendment past its deadline expires
-- deterministically at transition, with a log entry and a notification. A
-- sibling amendment not yet past its own deadline is left untouched.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'expiring_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-000000000005',
      '4e000000-0000-0000-0000-000000000002',
      'Doomed Reform',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000005',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    )
  ).id;

insert into
  amendment_test_ids (key, id)
select
  'not_yet_expiring_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-000000000006',
      '4e000000-0000-0000-0000-000000000002',
      'Slow Reform',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-000000000006',
          'heading',
          'X',
          'body_markdown',
          'Y'
        )
      )
    )
  ).id;

reset role;

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    '4b900000-0000-0000-0000-000000000001',
    '4b000000-0000-0000-0000-000000000001',
    10,
    11,
    '4a000000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role service_role;

select
  public.apply_turn_transition (
    '4b000000-0000-0000-0000-000000000001',
    10,
    '{}'::jsonb,
    '4b900000-0000-0000-0000-000000000001'::uuid
  );

reset role;

select
  is (
    (
      select
        format('%s|%s', status, resolved_turn_number)
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'expiring_amendment'
        )
    ),
    'expired|11',
    'an amendment past its deadline flips to expired at turn transition'
  );

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'not_yet_expiring_amendment'
        )
    ),
    'proposed',
    'an amendment not yet past its deadline is left open by the same transition'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        turn_transition_id = '4b900000-0000-0000-0000-000000000001'
        and log_category = 'law.amendment_expired'
        and (payload_jsonb ->> 'amendmentId')::uuid = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'expiring_amendment'
        )
    ),
    1,
    'expiry writes a turn_log_entries row'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = '4b900000-0000-0000-0000-000000000001'
        and notification_type = 'law.amendment_expired'
        and recipient_user_id = '4a000000-0000-0000-0000-000000000002'
    ),
    1,
    'expiry notifies the nation''s ruler'
  );

-- ===========================================================================
-- Fix #1128: cast_law_amendment_vote / withdraw_law_amendment race applies
-- operations twice.
--
-- pgTAP runs everything in one session/transaction, so it cannot open two
-- genuinely concurrent backends to reproduce the read-before-either-commits
-- race directly (same limitation noted in
-- per_target_bulk_assignment_test.sql and used by the precedent fixes in
-- approve_trade_route_side_test.sql / set_settlement_stockpile_quantity_
-- concurrent_race_test.sql). Two things are verified instead:
--
-- 1. Source-level: both RPCs lock the amendment row with `for update` before
--    reading its status, so concurrent resolvers serialize on that row.
-- 2. Functional: a deciding vote resolves the amendment exactly once, and a
--    second resolution attempt against the now-locked-and-resolved row is
--    rejected by the existing status guard rather than reapplying
--    operations -- the double-apply path the missing lock used to leave
--    open under real concurrency.
-- ===========================================================================
select
  matches (
    (
      select
        pg_get_functiondef(oid)
      from
        pg_proc
      where
        proname = 'cast_law_amendment_vote'
        and pronamespace = (
          select
            oid
          from
            pg_namespace
          where
            nspname = 'public'
        )
    ),
    'for update',
    'cast_law_amendment_vote locks the amendment row with for update before reading its status'
  );

select
  matches (
    (
      select
        pg_get_functiondef(oid)
      from
        pg_proc
      where
        proname = 'withdraw_law_amendment'
        and pronamespace = (
          select
            oid
          from
            pg_namespace
          where
            nspname = 'public'
        )
    ),
    'for update',
    'withdraw_law_amendment locks the amendment row with for update before reading its status'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  amendment_test_ids (key, id)
select
  'double_pass_amendment',
  (
    public.propose_law_amendment (
      '4d000000-0000-0000-0000-00000000000a',
      '4e000000-0000-0000-0000-000000000001',
      'Double Pass Reform',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'op',
          'amend_article',
          'article_id',
          '48000000-0000-0000-0000-00000000000a',
          'heading',
          'Applied Once',
          'body_markdown',
          'Applied once.'
        )
      )
    )
  ).id;

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'double_pass_amendment'
    ),
    '4e000000-0000-0000-0000-000000000002',
    true
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'double_pass_amendment'
        )
    ),
    'proposed',
    'double-pass fixture: still open after one of two council members votes yes'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  public.cast_law_amendment_vote (
    (
      select
        id
      from
        amendment_test_ids
      where
        key = 'double_pass_amendment'
    ),
    '4e000000-0000-0000-0000-000000000003',
    true
  );

reset role;

select
  is (
    (
      select
        format('%s|%s', status, resolved_turn_number)
      from
        public.law_amendments
      where
        id = (
          select
            id
          from
            amendment_test_ids
          where
            key = 'double_pass_amendment'
        )
    ),
    'passed|11',
    'double-pass fixture: the deciding second vote resolves the amendment exactly once'
  );

select
  is (
    (
      select
        current_version
      from
        public.law_documents
      where
        id = '4d000000-0000-0000-0000-00000000000a'
    ),
    2,
    'double-pass fixture: document version bumps exactly once on the deciding vote'
  );

select
  is (
    (
      select
        format('%s|%s', heading, body_markdown)
      from
        public.law_articles
      where
        id = '48000000-0000-0000-0000-00000000000a'
    ),
    'Applied Once|Applied once.',
    'double-pass fixture: the article reflects a single application of the operations'
  );

-- A third vote against the now-resolved (and row-locked-on-select) amendment
-- must be rejected by the status guard, not reapply the operations.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"4a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.cast_law_amendment_vote(%L::uuid, '4e000000-0000-0000-0000-000000000002'::uuid, false)$test$,
      (
        select
          id
        from
          amendment_test_ids
        where
          key = 'double_pass_amendment'
      )
    ),
    '22023',
    null,
    'double-pass fixture: a vote against an already-resolved amendment is rejected, not re-tallied'
  );

reset role;

select
  is (
    (
      select
        current_version
      from
        public.law_documents
      where
        id = '4d000000-0000-0000-0000-00000000000a'
    ),
    2,
    'double-pass fixture: document version is unchanged after the rejected re-vote attempt'
  );

select
  is (
    (
      select
        format('%s|%s', heading, body_markdown)
      from
        public.law_articles
      where
        id = '48000000-0000-0000-0000-00000000000a'
    ),
    'Applied Once|Applied once.',
    'double-pass fixture: the article is unchanged after the rejected re-vote attempt'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        notification_type = 'law.amendment_passed'
        and message_text like 'Amendment "Double Pass Reform" passed%'
        and recipient_user_id in (
          '4a000000-0000-0000-0000-000000000001',
          '4a000000-0000-0000-0000-000000000002'
        )
    ),
    2,
    'double-pass fixture: the operations application notifies the world admin and ruler exactly once each'
  );

select
  *
from
  finish ();

rollback;
