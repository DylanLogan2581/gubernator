-- Migration: add_law_amendments
-- #1119: the legislative flow on top of documents (#1117) and the amendment
-- procedure engine (#1118) — propose article changes, vote per procedure,
-- apply on pass, expire on deadline.
--
-- Design notes:
--   - law_amendments/law_amendment_votes hold only the columns the issue
--     specifies. There is no snapshot of the procedure used at proposal
--     time -- cast_law_amendment_vote and the eligibility checks below
--     always read the document's CURRENT amendment_procedure_json, same as
--     the shared amendmentProcedure.ts module's own contract (a
--     set_procedure amendment is ratified under whatever procedure is
--     live when it resolves).
--   - Decree / locked-by-admin amendments apply instantly inside
--     propose_law_amendment: no vote rows, no deadline. Vote-kind
--     amendments insert a 'proposed' row with a deadline and wait for
--     cast_law_amendment_vote.
--   - cast_law_amendment_vote re-tallies both chambers after every vote.
--     "Reached" (yes already clears the threshold against total membership)
--     applies immediately -> passed. "Unreachable" (even flipping every
--     non-voter to yes still misses the threshold) applies immediately ->
--     failed. Otherwise the amendment stays open until more votes arrive or
--     the turn-hook expiry below fires -- expiry is therefore a distinct
--     terminal status from "failed": failed means the engine proved the
--     vote could never pass, expired means time ran out first.
--   - Applying operations (internal_apply_law_amendment_operations) and
--     notifying (internal_notify_law_amendment) both run inside the calling
--     RPC's own transaction, so an invalid operation rolls back the entire
--     vote/decree, including the vote row and any status change.
--   - turn_log_entries.turn_transition_id is NOT NULL / FK'd to
--     turn_transitions, so it can only be written from inside
--     apply_turn_transition. Decree/vote/withdraw notifications (fired from
--     synchronous player RPCs, not a turn transition) therefore only ever
--     write to notifications, never turn_log_entries -- only the turn-hook
--     expiry path below does both, mirroring nation_currency's split
--     between synchronous grant/subsidize notifications (20260909000000)
--     and turn-transition notifications (20260918000001).
-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.law_amendments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.law_documents (id) on delete cascade,
  title text not null,
  rationale_markdown text,
  operations_json jsonb not null,
  status text not null default 'proposed' check (
    status in (
      'proposed',
      'passed',
      'failed',
      'withdrawn',
      'expired'
    )
  ),
  proposed_by_citizen_id uuid not null references public.citizens (id) on delete cascade,
  proposed_turn_number integer not null,
  deadline_turn_number integer,
  resolved_turn_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint law_amendments_title_length_check check (char_length(btrim(title)) >= 1),
  constraint law_amendments_title_max_length_check check (char_length(title) <= 200),
  constraint law_amendments_rationale_max_length_check check (char_length(rationale_markdown) <= 20000),
  constraint law_amendments_proposed_turn_number_check check (proposed_turn_number >= 0),
  constraint law_amendments_deadline_turn_number_check check (
    deadline_turn_number is null
    or deadline_turn_number >= proposed_turn_number
  ),
  constraint law_amendments_resolved_turn_number_check check (
    resolved_turn_number is null
    or resolved_turn_number >= proposed_turn_number
  )
);

create index law_amendments_document_id_idx on public.law_amendments (document_id);

create index law_amendments_status_deadline_idx on public.law_amendments (status, deadline_turn_number);

create trigger law_amendments_set_updated_at before
update on public.law_amendments for each row
execute function public.set_updated_at ();

comment on table public.law_amendments is 'Proposed changes to a law_documents row''s articles/procedure: an ordered operations_json list applied atomically on pass. status is proposed/passed/failed/withdrawn/expired; deadline_turn_number is null for instant decree/locked-admin amendments (#1119).';

create table public.law_amendment_votes (
  id uuid primary key default gen_random_uuid(),
  amendment_id uuid not null references public.law_amendments (id) on delete cascade,
  voter_citizen_id uuid not null references public.citizens (id) on delete cascade,
  vote boolean not null,
  cast_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint law_amendment_votes_unique unique (amendment_id, voter_citizen_id)
);

create index law_amendment_votes_amendment_id_idx on public.law_amendment_votes (amendment_id);

comment on table public.law_amendment_votes is 'One row per (amendment, voter) -- last cast wins via upsert. voter_citizen_id must be a resolved member of the amendment procedure''s bodyId/secondBodyId at cast time (#1119).';

-- ---------------------------------------------------------------------------
-- 2. RLS: world members read (mirrors law_documents' visibility exactly).
-- No INSERT/UPDATE/DELETE grants -- all writes go through the
-- SECURITY DEFINER RPCs below.
-- ---------------------------------------------------------------------------
alter table public.law_amendments enable row level security;

create policy "law_amendments_select_visibility" on public.law_amendments for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.law_documents d
      where
        d.id = law_amendments.document_id
        and (
          case
            when d.nation_id is not null then public.nation_visible_to_current_user (d.nation_id)
            else public.current_user_has_world_access (d.world_id)
          end
        )
    )
  );

grant
select
  on public.law_amendments to authenticated;

alter table public.law_amendment_votes enable row level security;

create policy "law_amendment_votes_select_visibility" on public.law_amendment_votes for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.law_amendments a
        inner join public.law_documents d on d.id = a.document_id
      where
        a.id = law_amendment_votes.amendment_id
        and (
          case
            when d.nation_id is not null then public.nation_visible_to_current_user (d.nation_id)
            else public.current_user_has_world_access (d.world_id)
          end
        )
    )
  );

grant
select
  on public.law_amendment_votes to authenticated;

-- ---------------------------------------------------------------------------
-- 3. resolve_government_body_member_ids: SQL mirror of resolveBodyMembers
-- (src/shared/government/governmentBodies.ts, #1116) -- the single source
-- of truth for turning a body's composition_json into a deduplicated, alive
-- voter roster. Duplicated in SQL because Postgres cannot execute the
-- shared TS module directly; keep in lockstep with governmentBodies.ts by
-- hand, same convention as is_valid_government_body_composition mirroring
-- validateAmendmentProcedure's shape rules.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_government_body_member_ids (p_body_id uuid) returns setof uuid language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_settlement_id uuid;
  v_composition jsonb;
  v_entry jsonb;
  v_kind text;
  v_member_ids uuid[] := '{}';
begin
  select nation_id, settlement_id, composition_json
  into v_nation_id, v_settlement_id, v_composition
  from public.government_bodies
  where id = p_body_id;

  if not found then
    return;
  end if;

  for v_entry in select value from jsonb_array_elements(v_composition)
  loop
    v_kind := v_entry ->> 'kind';

    if v_kind = 'office_type' then
      v_member_ids := v_member_ids || array(
        select o.citizen_id
        from public.nation_offices o
        where o.office_type_id = (v_entry ->> 'office_type_id')::uuid
          and (
            (v_nation_id is not null and o.nation_id = v_nation_id)
            or (v_settlement_id is not null and o.settlement_id = v_settlement_id)
          )
      );
    elsif v_kind = 'citizens' then
      v_member_ids := v_member_ids || array(
        select elem::uuid
        from jsonb_array_elements_text(v_entry -> 'citizen_ids') as elem
      );
    elsif v_kind = 'ruler' then
      if v_nation_id is not null then
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'nation_manager' and c.role_nation_id = v_nation_id
        );
      else
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'settlement_manager' and c.role_settlement_id = v_settlement_id
        );
      end if;
    elsif v_kind = 'settlement_managers' then
      if v_nation_id is not null then
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'settlement_manager'
            and c.role_settlement_id in (
              select s.id from public.settlements s where s.nation_id = v_nation_id
            )
        );
      end if;
    end if;
  end loop;

  return query
    select distinct m
    from unnest(v_member_ids) as m
    inner join public.citizens c on c.id = m
    where c.status = 'alive';
end;
$$;

revoke all on function public.resolve_government_body_member_ids (uuid)
from
  public;

grant
execute on function public.resolve_government_body_member_ids (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. meets_law_amendment_vote_threshold: SQL mirror of meetsThreshold
-- (src/shared/government/amendmentProcedure.ts). memberCount = 0 always
-- fails -- an empty chamber can never pass, matching the TS module.
-- ---------------------------------------------------------------------------
create or replace function public.meets_law_amendment_vote_threshold (
  p_yes integer,
  p_member_count integer,
  p_threshold text
) returns boolean language sql immutable as $$
  select case
    when p_member_count = 0 then false
    when p_threshold = 'majority' then p_yes * 2 > p_member_count
    when p_threshold = 'two_thirds' then p_yes * 3 >= p_member_count * 2
    when p_threshold = 'three_quarters' then p_yes * 4 >= p_member_count * 3
    when p_threshold = 'unanimous' then p_yes = p_member_count
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- 5. validate_law_amendment_procedure_json: SQL mirror of
-- validateAmendmentProcedure + assertAmendmentProcedureBodiesExist
-- (amendmentProcedure.ts), used to validate a set_procedure operation's
-- payload against the document's own nation/settlement scope.
-- ---------------------------------------------------------------------------
create or replace function public.validate_law_amendment_procedure_json (p_procedure jsonb, p_document_id uuid) returns void language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_kind text;
  v_authority jsonb;
  v_threshold text;
  v_voting_period integer;
  v_body_id uuid;
  v_second_body_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_key_count integer;
begin
  if jsonb_typeof(p_procedure) <> 'object' then
    raise exception 'amendment procedure must be an object'
      using errcode = '22023', hint = 'procedure_invalid';
  end if;

  v_kind := p_procedure ->> 'kind';

  if v_kind = 'decree' then
    v_authority := p_procedure -> 'authority';

    if v_authority = to_jsonb ('ruler'::text) then
      return;
    end if;

    if jsonb_typeof(v_authority) = 'object' then
      select count(*) into v_key_count from jsonb_object_keys(v_authority);
      if v_key_count = 1
        and v_authority ? 'officeTypeId'
        and jsonb_typeof(v_authority -> 'officeTypeId') = 'string'
        and (v_authority ->> 'officeTypeId')::uuid is not null then
        return;
      end if;
    end if;

    raise exception 'decree authority must be "ruler" or an office type'
      using errcode = '22023', hint = 'procedure_invalid';
  elsif v_kind = 'vote' then
    v_body_id := nullif(p_procedure ->> 'bodyId', '')::uuid;
    v_threshold := p_procedure ->> 'threshold';
    v_voting_period := (p_procedure ->> 'votingPeriodTurns')::integer;
    v_second_body_id := nullif(p_procedure ->> 'secondBodyId', '')::uuid;

    if v_body_id is null then
      raise exception 'vote procedure requires a valid body'
        using errcode = '22023', hint = 'procedure_invalid';
    end if;

    if v_threshold is null or v_threshold not in ('majority', 'two_thirds', 'three_quarters', 'unanimous') then
      raise exception 'vote threshold must be majority, two_thirds, three_quarters, or unanimous'
        using errcode = '22023', hint = 'procedure_invalid';
    end if;

    if v_voting_period is null or v_voting_period < 1 then
      raise exception 'voting period must be an integer of at least 1 turn'
        using errcode = '22023', hint = 'procedure_invalid';
    end if;

    if v_second_body_id is not null and v_second_body_id = v_body_id then
      raise exception 'second body must differ from first'
        using errcode = '22023', hint = 'procedure_invalid';
    end if;

    select nation_id, settlement_id into v_nation_id, v_settlement_id
    from public.law_documents
    where id = p_document_id;

    if not exists (
      select 1 from public.government_bodies b
      where b.id = v_body_id
        and (
          (v_nation_id is not null and b.nation_id = v_nation_id)
          or (v_settlement_id is not null and b.settlement_id = v_settlement_id)
        )
    ) then
      raise exception 'procedure body not found'
        using errcode = '22023', hint = 'procedure_body_not_found';
    end if;

    if v_second_body_id is not null and not exists (
      select 1 from public.government_bodies b
      where b.id = v_second_body_id
        and (
          (v_nation_id is not null and b.nation_id = v_nation_id)
          or (v_settlement_id is not null and b.settlement_id = v_settlement_id)
        )
    ) then
      raise exception 'procedure body not found'
        using errcode = '22023', hint = 'procedure_body_not_found';
    end if;
  elsif v_kind = 'locked' then
    return;
  else
    raise exception 'amendment procedure kind must be decree, vote, or locked'
      using errcode = '22023', hint = 'procedure_invalid';
  end if;
exception
  when invalid_text_representation then
    raise exception 'amendment procedure has an invalid id'
      using errcode = '22023', hint = 'procedure_invalid';
end;
$$;

revoke all on function public.validate_law_amendment_procedure_json (jsonb, uuid)
from
  public;

-- ---------------------------------------------------------------------------
-- 6. internal_apply_law_amendment_operations: validates and applies an
-- ordered operations_json list against a document atomically -- any invalid
-- operation raises, rolling back everything already applied in this call
-- (plpgsql function bodies are one implicit sub-transaction; the exception
-- propagates to the caller's transaction, which is the whole point: a
-- partial op failure must not leave the document half-amended). On success,
-- bumps law_documents.current_version and writes a law_document_versions
-- snapshot, mirroring create_law_document (#1117).
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_law_amendment_operations (
  p_document_id uuid,
  p_operations_json jsonb,
  p_amendment_title text,
  p_turn_number integer,
  p_enacted_by_citizen_id uuid
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_op jsonb;
  v_op_kind text;
  v_article_id uuid;
  v_article_document_id uuid;
  v_article_status text;
  v_heading text;
  v_body text;
  v_position integer;
  v_active_count integer;
  v_next_article_number integer;
  v_procedure jsonb;
  v_op_count integer := 0;
  v_new_version integer;
begin
  if jsonb_typeof(p_operations_json) <> 'array' or jsonb_array_length(p_operations_json) = 0 then
    raise exception 'at least one operation is required'
      using errcode = '22023', hint = 'operations_required';
  end if;

  for v_op in select value from jsonb_array_elements(p_operations_json)
  loop
    v_op_kind := v_op ->> 'op';

    if v_op_kind = 'add_article' then
      v_heading := v_op ->> 'heading';
      v_body := v_op ->> 'body_markdown';

      if v_heading is null or btrim(v_heading) = '' or char_length(v_heading) > 200
        or v_body is null or btrim(v_body) = '' then
        raise exception 'add_article requires a heading and body'
          using errcode = '22023', hint = 'operation_invalid';
      end if;

      select count(*) into v_active_count
      from public.law_articles
      where document_id = p_document_id and status = 'active';

      v_position := greatest(1, least(coalesce((v_op ->> 'position')::integer, v_active_count + 1), v_active_count + 1));

      select coalesce(max(article_number), 0) + 1 into v_next_article_number
      from public.law_articles
      where document_id = p_document_id;

      update public.law_articles
      set sort_order = sort_order + 1
      where document_id = p_document_id and status = 'active' and sort_order >= v_position;

      insert into public.law_articles (
        document_id, article_number, heading, body_markdown, status, sort_order
      )
      values (
        p_document_id, v_next_article_number, btrim(v_heading), v_body, 'active', v_position
      );
    elsif v_op_kind = 'amend_article' then
      v_article_id := (v_op ->> 'article_id')::uuid;
      v_heading := v_op ->> 'heading';
      v_body := v_op ->> 'body_markdown';

      select document_id, status into v_article_document_id, v_article_status
      from public.law_articles
      where id = v_article_id;

      if v_article_document_id is null or v_article_document_id <> p_document_id or v_article_status <> 'active' then
        raise exception 'amend_article references an invalid article'
          using errcode = '22023', hint = 'article_invalid';
      end if;

      if v_heading is null or btrim(v_heading) = '' or char_length(v_heading) > 200
        or v_body is null or btrim(v_body) = '' then
        raise exception 'amend_article requires a heading and body'
          using errcode = '22023', hint = 'operation_invalid';
      end if;

      update public.law_articles
      set heading = btrim(v_heading), body_markdown = v_body
      where id = v_article_id;
    elsif v_op_kind = 'repeal_article' then
      v_article_id := (v_op ->> 'article_id')::uuid;

      select document_id, status into v_article_document_id, v_article_status
      from public.law_articles
      where id = v_article_id;

      if v_article_document_id is null or v_article_document_id <> p_document_id or v_article_status <> 'active' then
        raise exception 'repeal_article references an invalid article'
          using errcode = '22023', hint = 'article_invalid';
      end if;

      update public.law_articles
      set status = 'repealed'
      where id = v_article_id;
    elsif v_op_kind = 'set_procedure' then
      v_procedure := v_op -> 'procedure';

      perform public.validate_law_amendment_procedure_json (v_procedure, p_document_id);

      update public.law_documents
      set amendment_procedure_json = v_procedure
      where id = p_document_id;
    else
      raise exception 'unknown amendment operation %', v_op_kind
        using errcode = '22023', hint = 'operation_invalid';
    end if;

    v_op_count := v_op_count + 1;
  end loop;

  update public.law_documents
  set current_version = current_version + 1
  where id = p_document_id
  returning current_version into v_new_version;

  insert into public.law_document_versions (
    document_id, version, articles_snapshot_json, amendment_title, enacted_turn_number, enacted_by_citizen_id
  )
  select
    p_document_id,
    v_new_version,
    jsonb_agg(
      jsonb_build_object(
        'articleNumber', a.article_number,
        'heading', a.heading,
        'bodyMarkdown', a.body_markdown,
        'status', a.status,
        'sortOrder', a.sort_order
      )
      order by a.sort_order
    ),
    p_amendment_title,
    p_turn_number,
    p_enacted_by_citizen_id
  from public.law_articles a
  where a.document_id = p_document_id;

  return v_op_count;
end;
$$;

revoke all on function public.internal_apply_law_amendment_operations (uuid, jsonb, text, integer, uuid)
from
  public;

revoke
execute on function public.internal_apply_law_amendment_operations (uuid, jsonb, text, integer, uuid)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 7. internal_notify_law_amendment: fires a notification to a document's
-- nation/settlement managers + world/super admins, mirroring
-- grant_nation_resources' recipient pattern (20260909000000). Used by the
-- three synchronous RPCs below (propose decree-apply, cast pass/fail,
-- withdraw); generated_in_transition_id is always null here since none of
-- these run inside a turn transition -- see the migration header.
-- ---------------------------------------------------------------------------
create or replace function public.internal_notify_law_amendment (
  p_world_id uuid,
  p_nation_id uuid,
  p_settlement_id uuid,
  p_notification_type public.notification_type,
  p_message_text text,
  p_severity public.notification_severity
) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into public.notifications (
    recipient_user_id, world_id, nation_id, settlement_id, notification_type, message_text, severity
  )
  select
    recipients.user_id, p_world_id, p_nation_id, p_settlement_id, p_notification_type, p_message_text, p_severity
  from (
    select c.user_id
    from public.citizens c
    where c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and (
        (p_nation_id is not null and (
          (c.role_type = 'nation_manager' and c.role_nation_id = p_nation_id)
          or (c.role_type = 'settlement_manager' and c.role_settlement_id in (
            select s.id from public.settlements s where s.nation_id = p_nation_id
          ))
        ))
        or (p_settlement_id is not null and c.role_type = 'settlement_manager' and c.role_settlement_id = p_settlement_id)
      )
    union
    select wa.user_id from public.world_admins wa where wa.world_id = p_world_id
    union
    select u.id from public.users u where u.is_super_admin = true
  ) as recipients (user_id)
  inner join public.users u on u.id = recipients.user_id and u.status = 'active';
end;
$$;

revoke all on function public.internal_notify_law_amendment (
  uuid,
  uuid,
  uuid,
  public.notification_type,
  text,
  public.notification_severity
)
from
  public;

revoke
execute on function public.internal_notify_law_amendment (
  uuid,
  uuid,
  uuid,
  public.notification_type,
  text,
  public.notification_severity
)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 8. propose_law_amendment: eligibility follows canProposeAmendment
-- (amendmentProcedure.ts) plus the issue's decree/vote extensions --
-- world/super admins may always propose (and, for decree/locked procedures,
-- instant-apply as an admin override mirroring repeal_law_document's
-- escape hatch); a decree authority match instant-applies too; a vote-kind
-- procedure inserts an open proposal for the ruler or either chamber's
-- members to vote on (never instant-applies, even for an admin proposer --
-- admins get extra proposing rights, not a bypass of the vote itself).
-- ---------------------------------------------------------------------------
create or replace function public.propose_law_amendment (
  p_document_id uuid,
  p_proposing_citizen_id uuid,
  p_title text,
  p_rationale_markdown text,
  p_operations_json jsonb
) returns public.law_amendments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_document_status text;
  v_procedure jsonb;
  v_kind text;
  v_turn_number integer;
  v_is_admin boolean;
  v_ruler_citizen_id uuid;
  v_is_ruler boolean;
  v_authority jsonb;
  v_office_type_id uuid;
  v_authority_ok boolean := false;
  v_body_id uuid;
  v_second_body_id uuid;
  v_member_ok boolean := false;
  v_allowed boolean := false;
  v_instant_apply boolean := false;
  v_amendment public.law_amendments%rowtype;
begin
  if p_document_id is null or p_proposing_citizen_id is null or p_title is null or p_operations_json is null then
    raise exception 'document, proposing citizen, title, and operations are required'
      using errcode = '22023';
  end if;

  if btrim(p_title) = '' then
    raise exception 'title must not be blank'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_operations_json) <> 'array' or jsonb_array_length(p_operations_json) = 0 then
    raise exception 'at least one operation is required'
      using errcode = '22023', hint = 'operations_required';
  end if;

  select world_id, nation_id, settlement_id, status, amendment_procedure_json
  into v_world_id, v_nation_id, v_settlement_id, v_document_status, v_procedure
  from public.law_documents
  where id = p_document_id;

  if v_world_id is null then
    raise exception 'document not found'
      using errcode = 'P0002';
  end if;

  if v_document_status <> 'active' then
    raise exception 'document is repealed'
      using errcode = '22023', hint = 'document_repealed';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
    or public.current_user_active_player_character_id (v_world_id) = p_proposing_citizen_id
  ) then
    raise exception 'You can only propose a law amendment as your own active player character.'
      using errcode = '42501';
  end if;

  select w.current_turn_number into v_turn_number
  from public.worlds w
  where w.id = v_world_id;

  v_is_admin := public.is_world_admin (v_world_id) or public.is_super_admin ();

  if v_nation_id is not null then
    select c.id into v_ruler_citizen_id
    from public.citizens c
    where c.role_type = 'nation_manager' and c.role_nation_id = v_nation_id and c.status = 'alive'
    limit 1;
  else
    select c.id into v_ruler_citizen_id
    from public.citizens c
    where c.role_type = 'settlement_manager' and c.role_settlement_id = v_settlement_id and c.status = 'alive'
    limit 1;
  end if;

  v_is_ruler := v_ruler_citizen_id is not null and v_ruler_citizen_id = p_proposing_citizen_id;

  v_kind := v_procedure ->> 'kind';

  if v_kind = 'decree' then
    v_authority := v_procedure -> 'authority';

    if v_authority = to_jsonb ('ruler'::text) then
      v_authority_ok := v_is_ruler;
    else
      v_office_type_id := nullif(v_authority ->> 'officeTypeId', '')::uuid;
      v_authority_ok := v_office_type_id is not null and exists (
        select 1 from public.nation_offices o
        where o.office_type_id = v_office_type_id
          and o.citizen_id = p_proposing_citizen_id
          and (
            (v_nation_id is not null and o.nation_id = v_nation_id)
            or (v_settlement_id is not null and o.settlement_id = v_settlement_id)
          )
      );
    end if;

    v_allowed := v_is_admin or v_authority_ok;
    v_instant_apply := v_allowed;
  elsif v_kind = 'vote' then
    v_body_id := nullif(v_procedure ->> 'bodyId', '')::uuid;
    v_second_body_id := nullif(v_procedure ->> 'secondBodyId', '')::uuid;

    v_member_ok := v_is_ruler
      or (v_body_id is not null and exists (
        select 1 from public.resolve_government_body_member_ids (v_body_id) m where m = p_proposing_citizen_id
      ))
      or (v_second_body_id is not null and exists (
        select 1 from public.resolve_government_body_member_ids (v_second_body_id) m where m = p_proposing_citizen_id
      ));

    v_allowed := v_is_admin or v_member_ok;
    v_instant_apply := false;
  elsif v_kind = 'locked' then
    v_allowed := v_is_admin;
    v_instant_apply := v_allowed;
  else
    raise exception 'document has no valid amendment procedure'
      using errcode = '22023', hint = 'procedure_invalid';
  end if;

  if not v_allowed then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  insert into public.law_amendments (
    document_id, title, rationale_markdown, operations_json, status,
    proposed_by_citizen_id, proposed_turn_number, deadline_turn_number
  )
  values (
    p_document_id, btrim(p_title), p_rationale_markdown, p_operations_json, 'proposed',
    p_proposing_citizen_id, v_turn_number,
    case when v_kind = 'vote' then v_turn_number + (v_procedure ->> 'votingPeriodTurns')::integer else null end
  )
  returning * into v_amendment;

  if v_instant_apply then
    perform public.internal_apply_law_amendment_operations (
      p_document_id, p_operations_json, v_amendment.title, v_turn_number, p_proposing_citizen_id
    );

    update public.law_amendments
    set status = 'passed', resolved_turn_number = v_turn_number
    where id = v_amendment.id
    returning * into v_amendment;

    perform public.internal_notify_law_amendment (
      v_world_id, v_nation_id, v_settlement_id, 'law.amendment_passed'::public.notification_type,
      format('Amendment "%s" enacted by decree.', v_amendment.title), 'info'::public.notification_severity
    );
  end if;

  return v_amendment;
end;
$$;

revoke all on function public.propose_law_amendment (uuid, uuid, text, text, jsonb)
from
  public;

grant
execute on function public.propose_law_amendment (uuid, uuid, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. cast_law_amendment_vote: voter authority mirrors
-- cast_nation_readiness_vote (#1075) -- world/super admin (covering NPC
-- members) or the user's own active player character. The voter must be a
-- resolved member (resolve_government_body_member_ids) of the procedure's
-- bodyId or secondBodyId. After the upsert, both chambers are re-tallied;
-- see the migration header for the reached/unreachable/still-open
-- semantics.
-- ---------------------------------------------------------------------------
create or replace function public.cast_law_amendment_vote (
  p_amendment_id uuid,
  p_voter_citizen_id uuid,
  p_vote boolean
) returns public.law_amendment_votes language plpgsql security definer
set
  search_path = '' as $$
declare
  v_document_id uuid;
  v_status text;
  v_title text;
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_procedure jsonb;
  v_body_id uuid;
  v_second_body_id uuid;
  v_threshold text;
  v_turn_number integer;
  v_is_member boolean;
  v_row public.law_amendment_votes%rowtype;
  v_first_yes integer;
  v_first_no integer;
  v_first_members integer;
  v_first_reached boolean;
  v_first_unreachable boolean;
  v_second_yes integer;
  v_second_no integer;
  v_second_members integer;
  v_second_reached boolean;
  v_second_unreachable boolean;
  v_passed boolean;
  v_failed boolean;
  v_tally_message text;
begin
  if p_amendment_id is null or p_voter_citizen_id is null or p_vote is null then
    raise exception 'amendment, voter citizen, and vote are required'
      using errcode = '22023';
  end if;

  select a.document_id, a.status, a.title
  into v_document_id, v_status, v_title
  from public.law_amendments a
  where a.id = p_amendment_id;

  if v_document_id is null then
    raise exception 'amendment not found'
      using errcode = 'P0002';
  end if;

  select d.world_id, d.nation_id, d.settlement_id, d.amendment_procedure_json
  into v_world_id, v_nation_id, v_settlement_id, v_procedure
  from public.law_documents d
  where d.id = v_document_id;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if v_status <> 'proposed' then
    raise exception 'amendment is not open for voting'
      using errcode = '22023', hint = 'amendment_not_open';
  end if;

  if v_procedure ->> 'kind' <> 'vote' then
    raise exception 'document procedure is not vote-based'
      using errcode = '22023', hint = 'amendment_not_vote_procedure';
  end if;

  v_body_id := nullif(v_procedure ->> 'bodyId', '')::uuid;
  v_second_body_id := nullif(v_procedure ->> 'secondBodyId', '')::uuid;
  v_threshold := v_procedure ->> 'threshold';

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
    or public.current_user_active_player_character_id (v_world_id) = p_voter_citizen_id
  ) then
    raise exception 'You can only cast a law amendment vote for your own active player character.'
      using errcode = '42501';
  end if;

  v_is_member := (v_body_id is not null and exists (
    select 1 from public.resolve_government_body_member_ids (v_body_id) m where m = p_voter_citizen_id
  )) or (v_second_body_id is not null and exists (
    select 1 from public.resolve_government_body_member_ids (v_second_body_id) m where m = p_voter_citizen_id
  ));

  if not v_is_member then
    raise exception 'This citizen is not an eligible voter for this amendment.'
      using errcode = '42501';
  end if;

  select w.current_turn_number into v_turn_number
  from public.worlds w
  where w.id = v_world_id;

  insert into public.law_amendment_votes (
    amendment_id, voter_citizen_id, vote, cast_by_user_id
  )
  values (p_amendment_id, p_voter_citizen_id, p_vote, auth.uid ())
  on conflict (amendment_id, voter_citizen_id) do update
  set vote = excluded.vote, cast_by_user_id = excluded.cast_by_user_id
  returning * into v_row;

  select
    count(*) filter (where v.vote), count(*) filter (where v.vote = false), count(*)
  into v_first_yes, v_first_no, v_first_members
  from public.resolve_government_body_member_ids (v_body_id) m
  left join public.law_amendment_votes v on v.amendment_id = p_amendment_id and v.voter_citizen_id = m;

  v_first_reached := public.meets_law_amendment_vote_threshold (v_first_yes, v_first_members, v_threshold);
  v_first_unreachable := not public.meets_law_amendment_vote_threshold (v_first_members - v_first_no, v_first_members, v_threshold);

  if v_second_body_id is not null then
    select
      count(*) filter (where v.vote), count(*) filter (where v.vote = false), count(*)
    into v_second_yes, v_second_no, v_second_members
    from public.resolve_government_body_member_ids (v_second_body_id) m
    left join public.law_amendment_votes v on v.amendment_id = p_amendment_id and v.voter_citizen_id = m;

    v_second_reached := public.meets_law_amendment_vote_threshold (v_second_yes, v_second_members, v_threshold);
    v_second_unreachable := not public.meets_law_amendment_vote_threshold (v_second_members - v_second_no, v_second_members, v_threshold);

    v_passed := v_first_reached and v_second_reached;
    v_failed := v_first_unreachable or v_second_unreachable;
    v_tally_message := format('%s-%s / %s-%s', v_first_yes, v_first_no, v_second_yes, v_second_no);
  else
    v_passed := v_first_reached;
    v_failed := v_first_unreachable;
    v_tally_message := format('%s-%s', v_first_yes, v_first_no);
  end if;

  if v_passed then
    perform public.internal_apply_law_amendment_operations (
      v_document_id,
      (select operations_json from public.law_amendments where id = p_amendment_id),
      v_title, v_turn_number, p_voter_citizen_id
    );

    update public.law_amendments
    set status = 'passed', resolved_turn_number = v_turn_number
    where id = p_amendment_id;

    perform public.internal_notify_law_amendment (
      v_world_id, v_nation_id, v_settlement_id, 'law.amendment_passed'::public.notification_type,
      format('Amendment "%s" passed %s.', v_title, v_tally_message), 'info'::public.notification_severity
    );
  elsif v_failed then
    update public.law_amendments
    set status = 'failed', resolved_turn_number = v_turn_number
    where id = p_amendment_id;

    perform public.internal_notify_law_amendment (
      v_world_id, v_nation_id, v_settlement_id, 'law.amendment_failed'::public.notification_type,
      format('Amendment "%s" failed %s.', v_title, v_tally_message), 'warning'::public.notification_severity
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.cast_law_amendment_vote (uuid, uuid, boolean)
from
  public;

grant
execute on function public.cast_law_amendment_vote (uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. withdraw_law_amendment: proposer (as their own active player
-- character) or world/super admin. Only an open ('proposed') amendment can
-- be withdrawn.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_law_amendment (p_amendment_id uuid) returns public.law_amendments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_document_id uuid;
  v_status text;
  v_title text;
  v_proposed_by uuid;
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_turn_number integer;
  v_amendment public.law_amendments%rowtype;
begin
  if p_amendment_id is null then
    raise exception 'p_amendment_id must not be null'
      using errcode = '22023';
  end if;

  select a.document_id, a.status, a.title, a.proposed_by_citizen_id
  into v_document_id, v_status, v_title, v_proposed_by
  from public.law_amendments a
  where a.id = p_amendment_id;

  if v_document_id is null then
    raise exception 'amendment not found'
      using errcode = 'P0002';
  end if;

  select d.world_id, d.nation_id, d.settlement_id
  into v_world_id, v_nation_id, v_settlement_id
  from public.law_documents d
  where d.id = v_document_id;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if v_status <> 'proposed' then
    raise exception 'amendment is not open'
      using errcode = '22023', hint = 'amendment_not_open';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
    or public.current_user_active_player_character_id (v_world_id) = v_proposed_by
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select w.current_turn_number into v_turn_number
  from public.worlds w
  where w.id = v_world_id;

  update public.law_amendments
  set status = 'withdrawn', resolved_turn_number = v_turn_number
  where id = p_amendment_id
  returning * into v_amendment;

  perform public.internal_notify_law_amendment (
    v_world_id, v_nation_id, v_settlement_id, 'law.amendment_withdrawn'::public.notification_type,
    format('Amendment "%s" was withdrawn.', v_title), 'info'::public.notification_severity
  );

  return v_amendment;
end;
$$;

revoke all on function public.withdraw_law_amendment (uuid)
from
  public;

grant
execute on function public.withdraw_law_amendment (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. internal_apply_turn_transition_law_amendment_expiry: turn-hook. Any
-- 'proposed' amendment whose deadline_turn_number has been reached by the
-- new turn flips to 'expired' -- unconditionally, regardless of partial
-- tally (a bicameral procedure needs both chambers to have already passed
-- via cast_law_amendment_vote before the deadline; anything still open at
-- the deadline expires, deterministic, no RNG). Self-contained (reads
-- law_amendments directly rather than an engine-computed payload key) since
-- expiry needs no cross-entity simulation state beyond the turn number --
-- see the migration header.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_law_amendment_expiry (
  p_transition_id uuid,
  p_world_id uuid,
  p_turn_number integer,
  out amendment_expired_count integer,
  out amendment_notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_amendment record;
  v_rows integer;
begin
  amendment_expired_count := 0;
  amendment_notification_count := 0;

  for v_amendment in
    select a.id, a.title, d.nation_id, d.settlement_id
    from public.law_amendments a
    inner join public.law_documents d on d.id = a.document_id
    where d.world_id = p_world_id
      and a.status = 'proposed'
      and a.deadline_turn_number is not null
      and a.deadline_turn_number <= p_turn_number
    order by a.id
  loop
    update public.law_amendments
    set status = 'expired', resolved_turn_number = p_turn_number
    where id = v_amendment.id;

    amendment_expired_count := amendment_expired_count + 1;

    insert into public.turn_log_entries (
      turn_transition_id, world_id, nation_id, settlement_id, log_category, payload_jsonb
    )
    values (
      p_transition_id, p_world_id, v_amendment.nation_id, v_amendment.settlement_id,
      'law.amendment_expired',
      jsonb_build_object('amendmentId', v_amendment.id, 'title', v_amendment.title)
    );

    insert into public.notifications (
      recipient_user_id, world_id, nation_id, settlement_id, notification_type, message_text,
      severity, generated_in_transition_id
    )
    select
      recipients.user_id, p_world_id, v_amendment.nation_id, v_amendment.settlement_id,
      'law.amendment_expired'::public.notification_type,
      format('Amendment "%s" expired without quorum.', v_amendment.title),
      'warning'::public.notification_severity,
      p_transition_id
    from (
      select c.user_id
      from public.citizens c
      where c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and (
          (v_amendment.nation_id is not null and (
            (c.role_type = 'nation_manager' and c.role_nation_id = v_amendment.nation_id)
            or (c.role_type = 'settlement_manager' and c.role_settlement_id in (
              select s.id from public.settlements s where s.nation_id = v_amendment.nation_id
            ))
          ))
          or (v_amendment.settlement_id is not null and c.role_type = 'settlement_manager' and c.role_settlement_id = v_amendment.settlement_id)
        )
      union
      select wa.user_id from public.world_admins wa where wa.world_id = p_world_id
      union
      select u.id from public.users u where u.is_super_admin = true
    ) as recipients (user_id)
    inner join public.users u on u.id = recipients.user_id and u.status = 'active'
    on conflict (
      generated_in_transition_id,
      recipient_user_id,
      notification_type,
      coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(citizen_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where generated_in_transition_id is not null
    do nothing;

    get diagnostics v_rows = row_count;
    amendment_notification_count := amendment_notification_count + v_rows;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_law_amendment_expiry (uuid, uuid, integer)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_law_amendment_expiry (uuid, uuid, integer)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 12. apply_turn_transition -- full redefinition (body copied verbatim from
-- 20261002000001_soldier_lifecycle.sql, the latest definition) with one new
-- call to internal_apply_turn_transition_law_amendment_expiry and two new
-- patchCounts keys. No payload / cross-world guard changes: the new step is
-- self-contained (see §11's comment).
-- ---------------------------------------------------------------------------
create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  p_transition_id uuid,
  p_forecast_snapshot_jsonb jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition public.turn_transitions%rowtype;
  v_result jsonb;
  -- §C36 cross-world guard loop variables (shared across all validation loops)
  v_delta jsonb;
  v_update jsonb;
  v_route_outcome jsonb;
  v_backfill jsonb;
  v_birth jsonb;
  v_death jsonb;
  v_partnership_change jsonb;
  v_assignment_clear jsonb;
  v_nation_snapshot jsonb;
  v_treaty_change jsonb;
  v_currency_snapshot jsonb;
  v_currency_update jsonb;
  v_citizen_education_patch jsonb;
  v_enrollment_progress_update jsonb;
  v_enrollment_graduation jsonb;
  v_army_snapshot jsonb;
  v_deserted_soldier jsonb;
  v_disbanded_unit jsonb;
  v_deceased_soldier_id uuid;
  v_check_id uuid;
  -- §H9 stockpile re-validation variables
  v_settlement_id uuid;
  v_resource_id uuid;
  v_quantity_before numeric(18, 4);
  v_actual_quantity numeric(18, 4);
  -- §H10a/§H10b deposit & managed-pop re-validation variables (issue #670)
  v_resource_delta jsonb;
  v_deposit_instance_id uuid;
  v_remaining_quantity_before numeric(18, 4);
  v_actual_remaining_quantity numeric(18, 4);
  v_managed_pop_instance_id uuid;
  v_current_count_before numeric(18, 4);
  v_actual_current_count numeric(18, 4);
  -- §C36 id-sets per entity table
  v_valid_settlement_ids uuid[];
  v_valid_resource_ids uuid[];
  v_valid_project_ids uuid[];
  v_valid_building_ids uuid[];
  v_valid_building_blueprint_ids uuid[];
  v_valid_building_blueprint_tier_ids uuid[];
  v_valid_deposit_instance_ids uuid[];
  v_valid_managed_pop_instance_ids uuid[];
  v_valid_trade_route_ids uuid[];
  v_valid_citizen_ids uuid[];
  v_valid_nation_ids uuid[];
  v_valid_treaty_ids uuid[];
  v_valid_currency_ids uuid[];
  v_valid_education_level_ids uuid[];
  v_valid_enrollment_ids uuid[];
  v_valid_army_ids uuid[];
  v_valid_army_unit_ids uuid[];
  v_valid_unit_soldier_ids uuid[];
  -- phase result counts (populated by internal helpers)
  v_stockpile_delta_count integer := 0;
  v_construction_update_count integer := 0;
  v_buildings_created_count integer := 0;
  v_building_state_change_count integer := 0;
  v_deposit_update_count integer := 0;
  v_managed_pop_update_count integer := 0;
  v_trade_route_outcome_count integer := 0;
  v_backfill_count integer := 0;
  v_citizen_birth_count integer := 0;
  v_citizen_death_count integer := 0;
  v_partnership_change_count integer := 0;
  v_assignment_clear_count integer := 0;
  v_overshoot_stamp_count integer := 0;
  v_event_status_update_count integer := 0;
  v_citizen_memory_count integer := 0;
  v_log_entry_count integer := 0;
  v_notification_count integer := 0;
  v_settlement_snapshot_count integer := 0;
  v_readiness_reset_count integer := 0;
  v_nation_readiness_reset_count integer := 0;
  v_nation_readiness_votes_cleared_count integer := 0;
  v_nation_stockpile_delta_count integer := 0;
  v_nation_turn_snapshot_count integer := 0;
  v_treaty_status_change_count integer := 0;
  v_nation_currency_snapshot_count integer := 0;
  v_nation_currency_update_count integer := 0;
  v_nation_currency_notification_count integer := 0;
  v_citizen_education_patch_count integer := 0;
  v_enrollment_progress_update_count integer := 0;
  v_enrollment_graduation_count integer := 0;
  v_army_turn_snapshot_count integer := 0;
  v_deserted_soldier_count integer := 0;
  v_disbanded_unit_count integer := 0;
  v_deceased_soldier_count integer := 0;
  v_amendment_expired_count integer := 0;
  v_amendment_expiry_notification_count integer := 0;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select
    w.status,
    w.current_turn_number into v_world_status,
    v_world_turn
  from
    public.worlds w
  where
    w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be advanced'
      using errcode = 'P0001', hint = 'world_archived';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number'
      using errcode = 'P0001', hint = 'stale_expected_turn';
  end if;

  -- Look up the pre-created running transition by id.
  select
    tt.* into v_transition
  from
    public.turn_transitions tt
  where
    tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- §C36: Cross-world payload guard (before the failure-capture block so validation
  -- failures leave the transition in 'running' status for retry).
  v_valid_settlement_ids := array(
    select s.id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
    where n.world_id = p_world_id
  );

  v_valid_resource_ids := array(
    select id from public.resources where world_id = p_world_id
  );

  v_valid_project_ids := array(
    select id from public.construction_projects
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_building_ids := array(
    select id from public.settlement_buildings
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_deposit_instance_ids := array(
    select id from public.deposit_instances
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_managed_pop_instance_ids := array(
    select id from public.managed_population_instances
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_trade_route_ids := array(
    select id from public.trade_routes
    where origin_settlement_id = any(v_valid_settlement_ids)
      and destination_settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_citizen_ids := array(
    select id from public.citizens where world_id = p_world_id
  );

  v_valid_building_blueprint_ids := array(
    select id from public.building_blueprints where world_id = p_world_id
  );

  v_valid_building_blueprint_tier_ids := array(
    select t.id from public.building_blueprint_tiers t
    join public.building_blueprints b on b.id = t.building_blueprint_id
    where b.world_id = p_world_id
  );

  v_valid_nation_ids := array(
    select id from public.nations where world_id = p_world_id
  );

  v_valid_treaty_ids := array(
    select id from public.nation_treaties where world_id = p_world_id
  );

  v_valid_currency_ids := array(
    select id from public.nation_currencies where world_id = p_world_id
  );

  v_valid_education_level_ids := array(
    select id from public.education_levels where world_id = p_world_id
  );

  v_valid_enrollment_ids := array(
    select id from public.education_enrollments where world_id = p_world_id
  );

  -- #1110: military upkeep phase id-sets.
  v_valid_army_ids := array(
    select id from public.armies where world_id = p_world_id
  );

  v_valid_army_unit_ids := array(
    select au.id from public.army_units au
    inner join public.armies a on a.id = au.army_id
    where a.world_id = p_world_id
  );

  v_valid_unit_soldier_ids := array(
    select id from public.unit_soldiers where world_id = p_world_id
  );

  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_check_id := (v_delta ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_delta ->> 'resourceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_resource_ids)) then
      raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'constructionUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'projectId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_project_ids)) then
      raise exception 'cross-world id % in constructionUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'buildingBlueprintId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_blueprint_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'currentTierId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_blueprint_tier_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'buildingStateChanges', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'buildingId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_ids)) then
      raise exception 'cross-world id % in buildingStateChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'depositInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_deposit_instance_ids)) then
      raise exception 'cross-world id % in depositUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_managed_pop_instance_ids)) then
      raise exception 'cross-world id % in managedPopulationUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_route_outcome in
    select value from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
  loop
    v_check_id := (v_route_outcome ->> 'tradeRouteId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_trade_route_ids)) then
      raise exception 'cross-world id % in tradeRouteOutcomes', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_backfill in
    select value from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_check_id := (v_backfill ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in bornOnTurnBackfill', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_birth in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_check_id := (v_birth ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_birth ->> 'parentACitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_birth ->> 'parentBCitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_death in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_check_id := (v_death ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenDeaths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_partnership_change in
    select value from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_check_id := (v_partnership_change ->> 'citizenAId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_partnership_change ->> 'citizenBId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_assignment_clear in
    select value from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_check_id := (v_assignment_clear ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in assignmentClears', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1083: nationStockpileDeltas / nationTurnSnapshots cross-world guards.
  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationStockpileDeltas', '[]'::jsonb))
  loop
    v_check_id := (v_delta ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_delta ->> 'resourceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_resource_ids)) then
      raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_nation_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationTurnSnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_nation_snapshot ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationTurnSnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1090: treatyStatusChanges cross-world guard.
  for v_treaty_change in
    select value from jsonb_array_elements(coalesce(p_payload -> 'treatyStatusChanges', '[]'::jsonb))
  loop
    v_check_id := (v_treaty_change ->> 'treatyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_treaty_ids)) then
      raise exception 'cross-world id % in treatyStatusChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1094: nationCurrencySnapshots / nationCurrencyUpdates cross-world guards.
  for v_currency_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencySnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_currency_snapshot ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_currency_snapshot ->> 'currencyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_currency_ids)) then
      raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_currency_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencyUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_currency_update ->> 'currencyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_currency_ids)) then
      raise exception 'cross-world id % in nationCurrencyUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1104: citizenEducationPatches / enrollmentProgressUpdates /
  -- enrollmentGraduations cross-world guards.
  for v_citizen_education_patch in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenEducationPatches', '[]'::jsonb))
  loop
    v_check_id := (v_citizen_education_patch ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenEducationPatches', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_citizen_education_patch ->> 'educationLevelId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_education_level_ids)) then
      raise exception 'cross-world id % in citizenEducationPatches', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_enrollment_progress_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'enrollmentProgressUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_enrollment_progress_update ->> 'enrollmentId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_enrollment_ids)) then
      raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_enrollment_progress_update ->> 'targetLevelId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_education_level_ids)) then
      raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_enrollment_graduation in
    select value from jsonb_array_elements(coalesce(p_payload -> 'enrollmentGraduations', '[]'::jsonb))
  loop
    v_check_id := (v_enrollment_graduation ->> 'enrollmentId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_enrollment_ids)) then
      raise exception 'cross-world id % in enrollmentGraduations', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1110: armyTurnSnapshots / desertedSoldiers / disbandedUnits cross-world guards.
  for v_army_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'armyTurnSnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_army_snapshot ->> 'armyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_ids)) then
      raise exception 'cross-world id % in armyTurnSnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_deserted_soldier in
    select value from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
  loop
    v_check_id := (v_deserted_soldier ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'newSettlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'soldierId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_unit_soldier_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'unitId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_unit_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_disbanded_unit in
    select value from jsonb_array_elements(coalesce(p_payload -> 'disbandedUnits', '[]'::jsonb))
  loop
    v_check_id := (v_disbanded_unit ->> 'armyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_ids)) then
      raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_disbanded_unit ->> 'unitId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_unit_ids)) then
      raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1111: deceasedSoldierIds cross-world guard.
  for v_deceased_soldier_id in
    select value::uuid
    from jsonb_array_elements_text(coalesce(p_payload -> 'deceasedSoldierIds', '[]'::jsonb))
  loop
    if not (v_deceased_soldier_id = any(v_valid_unit_soldier_ids)) then
      raise exception 'cross-world id % in deceasedSoldierIds', v_deceased_soldier_id using errcode = 'P0001';
    end if;
  end loop;

  -- §H9: Stockpile quantityBefore re-validation (issue #506).
  for v_delta in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_settlement_id   := (v_delta ->> 'settlementId')::uuid;
    v_resource_id     := (v_delta ->> 'resourceId')::uuid;
    v_quantity_before := coalesce((v_delta ->> 'quantityBefore')::numeric, 0);

    select srs.quantity
    into v_actual_quantity
    from public.settlement_resource_stockpiles srs
    where srs.settlement_id = v_settlement_id
      and srs.resource_id = v_resource_id;

    if found and v_actual_quantity <> v_quantity_before then
      raise exception 'state diverged: stockpile (%,%) was % but payload claimed %',
        v_settlement_id, v_resource_id, v_actual_quantity, v_quantity_before
        using errcode = 'P0001', hint = 'state_drifted';
    end if;
  end loop;

  -- §H10a: Deposit resource remainingQuantityBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_deposit_instance_id := (v_update ->> 'depositInstanceId')::uuid;

    for v_resource_delta in
      select value
      from jsonb_array_elements(coalesce(v_update -> 'resourceDeltas', '[]'::jsonb))
    loop
      -- Only re-validate when the payload explicitly carries the before-value;
      -- omitting it opts out of drift detection for that delta.
      if v_resource_delta ? 'remainingQuantityBefore' then
        v_resource_id             := (v_resource_delta ->> 'resourceId')::uuid;
        v_remaining_quantity_before := (v_resource_delta ->> 'remainingQuantityBefore')::numeric;

        select dir.remaining_quantity
        into v_actual_remaining_quantity
        from public.deposit_instance_resources dir
        where dir.deposit_instance_id = v_deposit_instance_id
          and dir.resource_id = v_resource_id;

        if found and v_actual_remaining_quantity <> v_remaining_quantity_before then
          raise exception 'state diverged: deposit resource (%,%) was % but payload claimed %',
            v_deposit_instance_id, v_resource_id, v_actual_remaining_quantity, v_remaining_quantity_before
            using errcode = 'P0001', hint = 'state_drifted';
        end if;
      end if;
    end loop;
  end loop;

  -- §H10b: Managed-population currentCountBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    -- Only re-validate when the payload explicitly carries the before-value.
    if v_update ? 'currentCountBefore' then
      v_managed_pop_instance_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
      v_current_count_before    := (v_update ->> 'currentCountBefore')::numeric;

      select mpi.current_count
      into v_actual_current_count
      from public.managed_population_instances mpi
      where mpi.id = v_managed_pop_instance_id;

      if found and v_actual_current_count <> v_current_count_before then
        raise exception 'state diverged: managed-population % was % but payload claimed %',
          v_managed_pop_instance_id, v_actual_current_count, v_current_count_before
          using errcode = 'P0001', hint = 'state_drifted';
      end if;
    end if;
  end loop;

  -- Outer failure-capture block: any unhandled exception inside marks the transition
  -- failed so callers can distinguish a partial run from success.
  begin
    -- §C28
    v_stockpile_delta_count := public.internal_apply_turn_transition_stockpile_deltas (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C29
    select
      construction_update_count,
      buildings_created_count,
      building_state_change_count
    into
      v_construction_update_count,
      v_buildings_created_count,
      v_building_state_change_count
    from public.internal_apply_turn_transition_construction_patches (
      v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C30
    select
      deposit_update_count,
      managed_pop_update_count
    into
      v_deposit_update_count,
      v_managed_pop_update_count
    from public.internal_apply_turn_transition_deposit_managed_pop_patches (p_payload);

    -- §C31
    v_trade_route_outcome_count := public.internal_apply_turn_transition_trade_route_patches (p_payload);

    -- §C32
    select
      backfill_count,
      citizen_birth_count,
      citizen_death_count,
      partnership_change_count,
      assignment_clear_count,
      overshoot_stamp_count
    into
      v_backfill_count,
      v_citizen_birth_count,
      v_citizen_death_count,
      v_partnership_change_count,
      v_assignment_clear_count,
      v_overshoot_stamp_count
    from public.internal_apply_turn_transition_citizen_partnership_patches (
      p_world_id, v_transition.id, p_payload
    );

    -- §C32.5 event status patches + citizen memories
    select event_status_update_count, citizen_memory_count
    into v_event_status_update_count, v_citizen_memory_count
    from public.internal_apply_turn_transition_event_patches(
      p_world_id, v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C33
    select
      log_entry_count,
      notification_count
    into
      v_log_entry_count,
      v_notification_count
    from public.internal_apply_turn_transition_log_entries_and_notifications (
      v_transition.id, p_world_id, p_payload
    );

    -- §C34
    v_settlement_snapshot_count := public.internal_apply_turn_transition_settlement_snapshots (
      v_transition.id, p_world_id, p_payload
    );

    -- §C37: nation economy — credit/debit nation_resource_stockpiles (tax
    -- collection and treaty tribute alike), persist nation_turn_snapshots
    -- (issues #1083, #1090).
    select
      nation_stockpile_delta_count,
      nation_turn_snapshot_count
    into
      v_nation_stockpile_delta_count,
      v_nation_turn_snapshot_count
    from public.internal_apply_turn_transition_nation_economy (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C38: nation currency — persist nation_currency_snapshots, update
    -- nation_currencies.confidence, and insert currency.default /
    -- currency.confidence_collapsing notifications (issue #1094).
    select
      nation_currency_snapshot_count,
      nation_currency_update_count,
      nation_currency_notification_count
    into
      v_nation_currency_snapshot_count,
      v_nation_currency_update_count,
      v_nation_currency_notification_count
    from public.internal_apply_turn_transition_nation_currency (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §1090: treaty status changes — flip expired treaties.
    v_treaty_status_change_count := public.internal_apply_turn_transition_treaty_patches (p_payload);

    -- #1104: education — citizen education-level patches, enrollment
    -- progress updates, and enrollment graduations.
    select
      citizen_education_patch_count,
      enrollment_progress_update_count,
      enrollment_graduation_count
    into
      v_citizen_education_patch_count,
      v_enrollment_progress_update_count,
      v_enrollment_graduation_count
    from public.internal_apply_turn_transition_education_patches (p_payload);

    -- #1110/#1111: military upkeep — army_turn_snapshots, deserted-soldier
    -- civilian-return + unit_soldiers cleanup, deceased-soldier cleanup, and
    -- unit disband.
    select
      army_turn_snapshot_count,
      deserted_soldier_count,
      disbanded_unit_count,
      deceased_soldier_count
    into
      v_army_turn_snapshot_count,
      v_deserted_soldier_count,
      v_disbanded_unit_count,
      v_deceased_soldier_count
    from public.internal_apply_turn_transition_military_upkeep (
      p_world_id, v_transition.to_turn_number, p_payload
    );

    -- #1119: law amendments — expire any 'proposed' amendment whose deadline
    -- has been reached by the new turn.
    select
      amendment_expired_count,
      amendment_notification_count
    into
      v_amendment_expired_count,
      v_amendment_expiry_notification_count
    from public.internal_apply_turn_transition_law_amendment_expiry (
      v_transition.id, p_world_id, v_transition.to_turn_number
    );

    -- §C35 / §1076: advance world turn, reset settlement readiness, clear
    -- nation readiness votes and computed readiness for the departing turn.
    select
      settlement_readiness_reset_count,
      nation_readiness_reset_count,
      nation_readiness_votes_cleared_count
    into
      v_readiness_reset_count,
      v_nation_readiness_reset_count,
      v_nation_readiness_votes_cleared_count
    from public.internal_apply_turn_transition_advance_world_turn (
      p_world_id, p_expected_turn_number
    );

    update public.turn_transitions
    set
      status                  = 'completed',
      finished_at             = now (),
      readiness_summary_jsonb = p_payload -> 'readinessSummary',
      forecast_snapshot_jsonb = p_forecast_snapshot_jsonb
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;

    v_result := jsonb_build_object (
      'transitionId',      v_transition.id,
      'fromTurnNumber',    v_transition.from_turn_number,
      'toTurnNumber',      v_transition.to_turn_number,
      'currentTurnNumber', p_expected_turn_number + 1,
      'patchCounts',
      jsonb_build_object (
        'stockpileDeltas',            v_stockpile_delta_count,
        'constructionUpdates',        v_construction_update_count,
        'buildingsCreated',           v_buildings_created_count,
        'buildingStateChanges',       v_building_state_change_count,
        'depositUpdates',             v_deposit_update_count,
        'managedPopulationUpdates',   v_managed_pop_update_count,
        'tradeRouteOutcomes',         v_trade_route_outcome_count,
        'bornOnTurnBackfill',         v_backfill_count,
        'citizenBirths',              v_citizen_birth_count,
        'citizenDeaths',              v_citizen_death_count,
        'partnershipChanges',         v_partnership_change_count,
        'assignmentClears',           v_assignment_clear_count,
        'overshootStamped',           v_overshoot_stamp_count,
        'eventStatusUpdates',         v_event_status_update_count,
        'citizenMemories',            v_citizen_memory_count,
        'logEntries',                 v_log_entry_count,
        'notifications',              v_notification_count,
        'settlementSnapshots',        v_settlement_snapshot_count,
        'readinessReset',             v_readiness_reset_count,
        'nationReadinessReset',       v_nation_readiness_reset_count,
        'nationReadinessVotesCleared', v_nation_readiness_votes_cleared_count,
        'nationStockpileDeltas',      v_nation_stockpile_delta_count,
        'nationTurnSnapshots',        v_nation_turn_snapshot_count,
        'treatyStatusChanges',        v_treaty_status_change_count,
        'nationCurrencySnapshots',    v_nation_currency_snapshot_count,
        'nationCurrencyUpdates',      v_nation_currency_update_count,
        'nationCurrencyNotifications', v_nation_currency_notification_count,
        'citizenEducationPatches',    v_citizen_education_patch_count,
        'enrollmentProgressUpdates',  v_enrollment_progress_update_count,
        'enrollmentGraduations',      v_enrollment_graduation_count,
        'armyTurnSnapshots',          v_army_turn_snapshot_count,
        'desertedSoldiers',           v_deserted_soldier_count,
        'disbandedUnits',             v_disbanded_unit_count,
        'deceasedSoldierIds',         v_deceased_soldier_count,
        'lawAmendmentsExpired',       v_amendment_expired_count,
        'lawAmendmentExpiryNotifications', v_amendment_expiry_notification_count
      )
    );
  exception
    when others then
      update public.turn_transitions
      set
        status = 'failed'
      where
        public.turn_transitions.id = v_transition.id
        and public.turn_transitions.status = 'running';

      raise;
  end;

  return v_result;
end;
$$;

revoke all on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  public;

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb) to service_role;
