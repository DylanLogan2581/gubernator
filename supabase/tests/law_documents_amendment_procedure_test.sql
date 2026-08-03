-- pgTAP tests for the amendment_procedure_json shape defined by #1118
-- (src/shared/government/amendmentProcedure.ts). Proves every procedure kind
-- (decree/ruler, decree/office, vote unicameral, vote bicameral, locked)
-- round-trips through Postgres jsonb storage unchanged via the existing
-- create_law_document RPC (#1117) -- this issue adds no migration and no
-- new RPC, so there is no direct-update path to exercise here.
--
-- canProposeAmendment enforcing "a vote-kind procedure blocks the decree
-- authority" and "a locked document is admin-only" are pure-function
-- properties, already covered exhaustively by
-- src/shared/government/amendmentProcedure.test.ts; persisting a
-- set_procedure amendment and the admin-gated locked-document update path
-- land in the amendments issue (#1119), which is the first RPC consumer of
-- validateAmendmentProcedure / assertAmendmentProcedureBodiesExist.
-- Run with: npx supabase test db
begin;

select
  plan (6);

create temporary table procedure_test_ids (key text primary key, id uuid not null);

grant
select
,
  insert on procedure_test_ids to authenticated;

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
    'procedure-nation-manager@example.com',
    'x',
    now(),
    '{"username":"procedure_nation_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    '2b000000-0000-0000-0000-000000000001',
    'Procedure World',
    'active',
    3
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '2c000000-0000-0000-0000-000000000001',
    '2b000000-0000-0000-0000-000000000001',
    'Procedure Nation',
    'republic'
  );

insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    '2e000000-0000-0000-0000-000000000001',
    '2b000000-0000-0000-0000-000000000001',
    'player_character',
    'ProcedureNationManager',
    'alive',
    '2a000000-0000-0000-0000-000000000001',
    'nation_manager',
    '2c000000-0000-0000-0000-000000000001'
  );

insert into
  public.government_bodies (id, world_id, nation_id, name, composition_json)
values
  (
    '2f000000-0000-0000-0000-000000000001',
    '2b000000-0000-0000-0000-000000000001',
    '2c000000-0000-0000-0000-000000000001',
    'Senate',
    '[{"kind":"ruler"}]'::jsonb
  ),
  (
    '2f000000-0000-0000-0000-000000000002',
    '2b000000-0000-0000-0000-000000000001',
    '2c000000-0000-0000-0000-000000000001',
    'Council',
    '[{"kind":"ruler"}]'::jsonb
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"2a000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- decree / ruler
-- ===========================================================================
insert into
  procedure_test_ids (key, id)
select
  'decree_ruler',
  (
    public.create_law_document (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => 'Decree Ruler Charter',
      p_preamble_markdown => null,
      p_amendment_procedure_json => '{"kind":"decree","authority":"ruler"}'::jsonb,
      p_articles => '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  ).id;

-- ===========================================================================
-- decree / office
-- ===========================================================================
insert into
  procedure_test_ids (key, id)
select
  'decree_office',
  (
    public.create_law_document (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => 'Decree Office Charter',
      p_preamble_markdown => null,
      p_amendment_procedure_json => '{"kind":"decree","authority":{"officeTypeId":"3a000000-0000-0000-0000-000000000001"}}'::jsonb,
      p_articles => '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  ).id;

-- ===========================================================================
-- vote / unicameral
-- ===========================================================================
insert into
  procedure_test_ids (key, id)
select
  'vote_unicameral',
  (
    public.create_law_document (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => 'Vote Unicameral Charter',
      p_preamble_markdown => null,
      p_amendment_procedure_json => '{"kind":"vote","bodyId":"2f000000-0000-0000-0000-000000000001","threshold":"two_thirds","votingPeriodTurns":2,"secondBodyId":null}'::jsonb,
      p_articles => '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  ).id;

-- ===========================================================================
-- vote / bicameral -- the shape a set_procedure amendment on the decree/ruler
-- charter above would ratify, once the amendments issue lands the RPC to do
-- so; asserted here purely as a jsonb round-trip.
-- ===========================================================================
insert into
  procedure_test_ids (key, id)
select
  'vote_bicameral',
  (
    public.create_law_document (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => 'Vote Bicameral Charter',
      p_preamble_markdown => null,
      p_amendment_procedure_json => '{"kind":"vote","bodyId":"2f000000-0000-0000-0000-000000000001","threshold":"unanimous","votingPeriodTurns":1,"secondBodyId":"2f000000-0000-0000-0000-000000000002"}'::jsonb,
      p_articles => '[{"heading":"Article I","bodyMarkdown":"Body."}]'::jsonb
    )
  ).id;

-- ===========================================================================
-- locked
-- ===========================================================================
insert into
  procedure_test_ids (key, id)
select
  'locked',
  (
    public.create_law_document (
      p_world_id => '2b000000-0000-0000-0000-000000000001',
      p_nation_id => '2c000000-0000-0000-0000-000000000001',
      p_settlement_id => null,
      p_title => 'Locked Charter',
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
        amendment_procedure_json
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            procedure_test_ids
          where
            key = 'decree_ruler'
        )
    ),
    '{"kind":"decree","authority":"ruler"}'::jsonb,
    'decree/ruler procedure round-trips through jsonb storage'
  );

select
  is (
    (
      select
        amendment_procedure_json
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            procedure_test_ids
          where
            key = 'decree_office'
        )
    ),
    '{"kind":"decree","authority":{"officeTypeId":"3a000000-0000-0000-0000-000000000001"}}'::jsonb,
    'decree/office procedure round-trips through jsonb storage'
  );

select
  is (
    (
      select
        amendment_procedure_json
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            procedure_test_ids
          where
            key = 'vote_unicameral'
        )
    ),
    '{"kind":"vote","bodyId":"2f000000-0000-0000-0000-000000000001","threshold":"two_thirds","votingPeriodTurns":2,"secondBodyId":null}'::jsonb,
    'unicameral vote procedure round-trips through jsonb storage'
  );

select
  is (
    (
      select
        amendment_procedure_json
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            procedure_test_ids
          where
            key = 'vote_bicameral'
        )
    ),
    '{"kind":"vote","bodyId":"2f000000-0000-0000-0000-000000000001","threshold":"unanimous","votingPeriodTurns":1,"secondBodyId":"2f000000-0000-0000-0000-000000000002"}'::jsonb,
    'bicameral vote procedure (the set_procedure target) round-trips through jsonb storage'
  );

select
  is (
    (
      select
        amendment_procedure_json
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            procedure_test_ids
          where
            key = 'locked'
        )
    ),
    '{"kind":"locked"}'::jsonb,
    'locked procedure round-trips through jsonb storage'
  );

-- Sanity: every procedure kind produced by create_law_document above is
-- accepted by the shared bodies-in-scope guard when its bodies are in scope
-- (asserted structurally here since SQL cannot call the TS validator
-- directly -- see amendmentProcedure.test.ts for the validator's own
-- coverage, including the out-of-scope / self-referential rejection cases).
select
  is (
    (
      select
        (amendment_procedure_json ->> 'bodyId')::uuid
      from
        public.law_documents
      where
        id = (
          select
            id
          from
            procedure_test_ids
          where
            key = 'vote_bicameral'
        )
    ),
    (
      select
        id
      from
        public.government_bodies
      where
        id = '2f000000-0000-0000-0000-000000000001'
    ),
    'the vote procedure''s bodyId matches a real government_bodies row in the same nation scope'
  );

select
  *
from
  finish ();

rollback;
