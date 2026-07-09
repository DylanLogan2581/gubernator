-- pgTAP tests for public.law_documents, public.law_articles,
-- public.law_document_versions, public.create_law_document and
-- public.repeal_law_document (#1117): version-1 snapshot on creation,
-- authority guards, RLS read visibility, and the no-direct-write guarantee
-- (every table grants SELECT only -- writes are RPC-only).
-- Run with: npx supabase test db
begin;

select
  plan (19);

-- A scratch table to stash ids returned by RPC calls across role switches --
-- avoids relying on psql variables, which the other test files don't use.
create temporary table law_test_ids (key text primary key, id uuid not null);

grant
select
,
  insert on law_test_ids to authenticated;

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
    'law-admin@example.com',
    'x',
    now(),
    '{"username":"law_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '1a000000-0000-0000-0000-000000000002',
    'law-nation-manager@example.com',
    'x',
    now(),
    '{"username":"law_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '1a000000-0000-0000-0000-000000000003',
    'law-outsider@example.com',
    'x',
    now(),
    '{"username":"law_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '1a000000-0000-0000-0000-000000000004',
    'law-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"law_settlement_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    '1b000000-0000-0000-0000-000000000001',
    'Law World',
    'private',
    'active',
    7
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '1b000000-0000-0000-0000-000000000001',
    '1a000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '1c000000-0000-0000-0000-000000000001',
    '1b000000-0000-0000-0000-000000000001',
    'Law Nation',
    'republic'
  ),
  (
    '1c000000-0000-0000-0000-000000000002',
    '1b000000-0000-0000-0000-000000000001',
    'Other Nation',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '1d000000-0000-0000-0000-000000000001',
    '1c000000-0000-0000-0000-000000000001',
    'Law Settlement'
  );

-- Out-of-scope government body (#1138): belongs to Other Nation, used to
-- prove create_law_document rejects a vote procedure whose bodyId is scoped
-- to a different nation than the document being created.
insert into
  public.government_bodies (id, world_id, nation_id, name, composition_json)
values
  (
    '1f000000-0000-0000-0000-000000000001',
    '1b000000-0000-0000-0000-000000000001',
    '1c000000-0000-0000-0000-000000000002',
    'Other Nation Council',
    '[{"kind":"ruler"}]'::jsonb
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
    '1e000000-0000-0000-0000-000000000001',
    '1b000000-0000-0000-0000-000000000001',
    '1d000000-0000-0000-0000-000000000001',
    'player_character',
    'NationManager',
    'alive',
    '1a000000-0000-0000-0000-000000000002',
    'nation_manager',
    '1c000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '1e000000-0000-0000-0000-000000000002',
    '1b000000-0000-0000-0000-000000000001',
    '1d000000-0000-0000-0000-000000000001',
    'player_character',
    'SettlementManager',
    'alive',
    '1a000000-0000-0000-0000-000000000004',
    'settlement_manager',
    null,
    '1d000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- create_law_document: happy path (nation manager, two articles) writes the
-- document, both articles (numbered/sorted 1..2), and a version-1 snapshot.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  law_test_ids (key, id)
select
  'nation_doc',
  (
    public.create_law_document (
      p_world_id => '1b000000-0000-0000-0000-000000000001',
      p_nation_id => '1c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => ' The Founding Charter ',
      p_preamble_markdown => 'We the citizens...',
      p_amendment_procedure_json => '{"kind":"locked"}'::jsonb,
      p_articles => '[{"heading":"Article I","bodyMarkdown":"Body one."},{"heading":"Article II","bodyMarkdown":"Body two."}]'::jsonb
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
          status,
          current_version,
          nation_id,
          settlement_id
        )
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
    ),
    format(
      '%s|%s|%s|%s|%s',
      'The Founding Charter',
      'active',
      1,
      '1c000000-0000-0000-0000-000000000001'::uuid,
      null::uuid
    ),
    'create_law_document trims the title and writes an active version-1 document'
  );

select
  is (
    (
      select
        string_agg(
          format(
            '%s:%s:%s:%s',
            article_number,
            heading,
            sort_order,
            status
          ),
          ','
          order by
            article_number
        )
      from
        public.law_articles
      where
        document_id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
    ),
    '1:Article I:1:active,2:Article II:2:active',
    'both articles are inserted, numbered and sorted 1..2'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_document_versions
      where
        document_id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
    ),
    1,
    'exactly one version row is written on creation'
  );

select
  is (
    (
      select
        jsonb_array_length(articles_snapshot_json)
      from
        public.law_document_versions
      where
        document_id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
        and version = 1
    ),
    2,
    'the version-1 snapshot contains both articles'
  );

-- ===========================================================================
-- create_law_document: validation and authority guards.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_law_document(
      '1b000000-0000-0000-0000-000000000001',
      '1c000000-0000-0000-0000-000000000001',
      null,
      'Empty Charter',
      null,
      '{}'::jsonb,
      '[]'::jsonb
    )
  $test$,
    '22023',
    null,
    'an empty articles array is rejected'
  );

select
  throws_ok (
    $test$
    select public.create_law_document(
      '1b000000-0000-0000-0000-000000000001',
      '1c000000-0000-0000-0000-000000000002',
      null,
      'Hijacked Charter',
      null,
      '{}'::jsonb,
      '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  $test$,
    '42501',
    null,
    'a nation manager cannot create a document for another nation'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_law_document(
      '1b000000-0000-0000-0000-000000000001',
      '1c000000-0000-0000-0000-000000000001',
      null,
      'Outsider Charter',
      null,
      '{}'::jsonb,
      '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  $test$,
    '42501',
    null,
    'an outsider cannot create a document for a nation they do not manage'
  );

reset role;

-- ===========================================================================
-- create_law_document: amendment_procedure_json is validated at creation
-- with the same scope rules set_procedure enforces (#1138).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_law_document(
      '1b000000-0000-0000-0000-000000000001',
      '1c000000-0000-0000-0000-000000000001',
      null,
      'Cross Scope Charter',
      null,
      '{"kind":"vote","bodyId":"1f000000-0000-0000-0000-000000000001","threshold":"majority","votingPeriodTurns":2,"secondBodyId":null}'::jsonb,
      '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  $test$,
    '22023',
    null,
    'a vote procedure bodyId scoped to a different nation is rejected at create'
  );

select
  throws_ok (
    $test$
    select public.create_law_document(
      '1b000000-0000-0000-0000-000000000001',
      '1c000000-0000-0000-0000-000000000001',
      null,
      'Malformed Procedure Charter',
      null,
      '{"kind":"not_a_real_kind"}'::jsonb,
      '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  $test$,
    '22023',
    null,
    'a malformed amendment procedure kind is rejected at create'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into
  law_test_ids (key, id)
select
  'settlement_doc',
  (
    public.create_law_document (
      p_world_id => '1b000000-0000-0000-0000-000000000001',
      p_nation_id => null,
      p_settlement_id => '1d000000-0000-0000-0000-000000000001',
      p_title => 'Settlement Bylaws',
      p_preamble_markdown => null,
      p_amendment_procedure_json => '{"kind":"locked"}'::jsonb,
      p_articles => '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  ).id;

reset role;

select
  is (
    (
      select
        format(
          '%s|%s|%s',
          status,
          current_version,
          settlement_id
        )
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            law_test_ids
          where
            key = 'settlement_doc'
        )
    ),
    format(
      '%s|%s|%s',
      'active',
      1,
      '1d000000-0000-0000-0000-000000000001'::uuid
    ),
    'a settlement manager can create a settlement-scoped document'
  );

-- ===========================================================================
-- No direct write path: every table grants SELECT only, so a direct
-- INSERT/UPDATE from an authenticated role (any role, including the
-- document's own manager) is rejected before RLS is even evaluated.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$
      insert into public.law_articles (document_id, article_number, heading, body_markdown, sort_order)
      values (%L, 3, 'Article III', 'Snuck in.', 3)
    $test$,
      (
        select
          id
        from
          law_test_ids
        where
          key = 'nation_doc'
      )
    ),
    '42501',
    null,
    'a direct INSERT into law_articles is rejected for an authenticated role'
  );

-- No UPDATE policy exists, so (unlike INSERT's WITH CHECK) the UPDATE
-- statement itself does not raise -- RLS's USING clause just matches zero
-- rows, silently no-opping (same "silently ignored by RLS" behavior as
-- office_types_test.sql's world-default-type update case).
update public.law_articles
set
  body_markdown = 'Rewritten.'
where
  document_id = (
    select
      id
    from
      law_test_ids
    where
      key = 'nation_doc'
  )
  and article_number = 1;

select
  is (
    (
      select
        body_markdown
      from
        public.law_articles
      where
        document_id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
        and article_number = 1
    ),
    'Body one.',
    'a direct UPDATE on law_articles is silently ignored by RLS for an authenticated role'
  );

select
  throws_ok (
    format(
      $test$
      insert into public.law_document_versions (document_id, version, articles_snapshot_json, amendment_title, enacted_turn_number)
      values (%L, 2, '[]'::jsonb, 'Forged amendment', 7)
    $test$,
      (
        select
          id
        from
          law_test_ids
        where
          key = 'nation_doc'
      )
    ),
    '42501',
    null,
    'a direct INSERT into law_document_versions is rejected for an authenticated role'
  );

reset role;

-- ===========================================================================
-- Table constraints: exactly one of nation_id / settlement_id must be set
-- (checked at table level regardless of role/RPC).
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.law_documents (
      world_id, nation_id, settlement_id, title, current_version, created_turn_number
    )
    values (
      '1b000000-0000-0000-0000-000000000001',
      '1c000000-0000-0000-0000-000000000001',
      '1d000000-0000-0000-0000-000000000001',
      'Both Scopes Charter',
      1,
      7
    )
  $test$,
    '23514',
    null,
    'setting both nation_id and settlement_id is rejected'
  );

-- ===========================================================================
-- SELECT: a world member (nation manager) can read the nation document; an
-- outsider with no world access cannot.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
    ),
    1,
    'a nation member can select their nation''s law document'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
    ),
    0,
    'an outsider with no world access cannot select the law document'
  );

reset role;

-- ===========================================================================
-- repeal_law_document: direct admin repeal only; a nation manager cannot
-- repeal their own document outright (amendment-procedure repeal is a later
-- issue), a world admin can, and repealing twice is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.repeal_law_document(%L)$test$,
      (
        select
          id
        from
          law_test_ids
        where
          key = 'nation_doc'
      )
    ),
    '42501',
    null,
    'a nation manager cannot directly repeal their own document'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.repeal_law_document (
    (
      select
        id
      from
        law_test_ids
      where
        key = 'nation_doc'
    )
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            law_test_ids
          where
            key = 'nation_doc'
        )
    ),
    'repealed',
    'a world admin can directly repeal a document'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"1a000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.repeal_law_document(%L)$test$,
      (
        select
          id
        from
          law_test_ids
        where
          key = 'nation_doc'
      )
    ),
    '22023',
    null,
    'repealing an already-repealed document is rejected'
  );

reset role;

select
  *
from
  finish ();

rollback;
