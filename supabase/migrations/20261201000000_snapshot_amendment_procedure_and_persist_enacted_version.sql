-- #1300: propose_law_amendment reads the document's amendment_procedure_json
-- into the amendment at proposal time, but never stored it -- so
-- cast_law_amendment_vote re-read the document's CURRENT
-- amendment_procedure_json on every tally. A set_procedure amendment that
-- resolves while a second, unrelated amendment on the same document is
-- still open silently changes that in-flight vote's threshold/body/math out
-- from under it. Fix: freeze the procedure into
-- law_amendments.amendment_procedure_snapshot_json at proposal time; every
-- eligibility and tally check in cast_law_amendment_vote reads the snapshot
-- from then on, never the live document.
--
-- Separately, enacted_version was never persisted -- the UI reconstructed it
-- by zipping passed amendments to law_document_versions positionally
-- (src/features/law-amendments/utils/zipPassedAmendmentsToVersions.ts),
-- which has no tiebreak when two amendments resolve in the same turn.
-- internal_apply_law_amendment_operations already computes the new version
-- number in-transaction (v_new_version); it just discarded it instead of
-- returning it. Fix: add OUT params so callers can capture it and persist
-- it onto law_amendments.enacted_version alongside status = 'passed'.
--
-- Function bodies below are copied from the latest prior definition of each
-- (cast_law_amendment_vote / propose_law_amendment: 20261010000002 /
-- 20261011000000 respectively -- the FOR UPDATE lock and the office
-- ended_turn_number filter must both be preserved), with only the changes
-- this issue requires.
-- ---------------------------------------------------------------------------
-- 1. Columns.
-- ---------------------------------------------------------------------------
alter table public.law_amendments
add column amendment_procedure_snapshot_json jsonb,
add column enacted_version integer;

comment on column public.law_amendments.amendment_procedure_snapshot_json is 'The document''s amendment_procedure_json at the moment this amendment was proposed -- frozen so a later set_procedure amendment cannot change an in-flight vote''s threshold/body/math (#1300).';

comment on column public.law_amendments.enacted_version is 'The law_document_versions.version this amendment created when it passed -- null for amendments that never applied (failed/withdrawn/expired) or haven''t resolved yet (#1300).';

-- Backfill: every existing row proposed under the document's procedure at
-- the time (there is no history, so the document's current
-- amendment_procedure_json is the best available approximation for rows
-- that predate this migration).
update public.law_amendments a
set
  amendment_procedure_snapshot_json = d.amendment_procedure_json
from
  public.law_documents d
where
  d.id = a.document_id;

alter table public.law_amendments
alter column amendment_procedure_snapshot_json
set not null;

-- Backfill enacted_version for historical passed amendments using the same
-- positional-zip invariant the UI util relied on (version 1 is always
-- create_law_document; every version after that is exactly one amendment's
-- apply, in the order the amendments resolved) -- this is the last time
-- that invariant needs to be leaned on now that new rows persist their own
-- version directly.
with
  passed as (
    select
      id,
      document_id,
      row_number() over (
        partition by
          document_id
        order by
          resolved_turn_number,
          id
      ) as passed_rank
    from
      public.law_amendments
    where
      status = 'passed'
  ),
  versions as (
    select
      id,
      document_id,
      version,
      row_number() over (
        partition by
          document_id
        order by
          version
      ) as version_rank
    from
      public.law_document_versions
    where
      version > 1
  )
update public.law_amendments a
set
  enacted_version = v.version
from
  passed p
  inner join versions v on v.document_id = p.document_id
  and v.version_rank = p.passed_rank
where
  a.id = p.id;

-- ---------------------------------------------------------------------------
-- 2. internal_apply_law_amendment_operations: unchanged body, only the
-- return shape changes from a bare integer (operation count) to a record
-- with the operation count and the new version, so callers can persist the
-- version onto enacted_version. Input signature is unchanged, so existing
-- revoke/grant statements from 20261007000001 still apply -- Postgres
-- function identity is keyed on input types only.
-- ---------------------------------------------------------------------------
-- create or replace cannot change a function's return type (integer ->
-- record); drop the old signature first.
drop function public.internal_apply_law_amendment_operations (uuid, jsonb, text, integer, uuid);

create function public.internal_apply_law_amendment_operations (
  p_document_id uuid,
  p_operations_json jsonb,
  p_amendment_title text,
  p_turn_number integer,
  p_enacted_by_citizen_id uuid,
  out operation_count integer,
  out new_version integer
) returns record language plpgsql security definer
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

  operation_count := v_op_count;
  new_version := v_new_version;
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
-- 3. propose_law_amendment: snapshots amendment_procedure_json into the new
-- row, and captures internal_apply_law_amendment_operations' new_version
-- onto enacted_version for the instant-apply (decree/locked) path. Body
-- otherwise unchanged from 20261011000000.
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
  v_enacted_version integer;
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
          and o.ended_turn_number is null
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
    proposed_by_citizen_id, proposed_turn_number, deadline_turn_number,
    amendment_procedure_snapshot_json
  )
  values (
    p_document_id, btrim(p_title), p_rationale_markdown, p_operations_json, 'proposed',
    p_proposing_citizen_id, v_turn_number,
    case when v_kind = 'vote' then v_turn_number + (v_procedure ->> 'votingPeriodTurns')::integer else null end,
    v_procedure
  )
  returning * into v_amendment;

  if v_instant_apply then
    select new_version into v_enacted_version
    from public.internal_apply_law_amendment_operations (
      p_document_id, p_operations_json, v_amendment.title, v_turn_number, p_proposing_citizen_id
    );

    update public.law_amendments
    set status = 'passed', resolved_turn_number = v_turn_number, enacted_version = v_enacted_version
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
-- 4. cast_law_amendment_vote: reads the amendment's own
-- amendment_procedure_snapshot_json instead of the document's live
-- amendment_procedure_json for every eligibility/tally check, and persists
-- internal_apply_law_amendment_operations' new_version onto enacted_version
-- when the amendment passes. Body otherwise unchanged from 20261010000002
-- (keeps the FOR UPDATE lock).
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
  v_procedure jsonb;
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
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
  v_enacted_version integer;
begin
  if p_amendment_id is null or p_voter_citizen_id is null or p_vote is null then
    raise exception 'amendment, voter citizen, and vote are required'
      using errcode = '22023';
  end if;

  select a.document_id, a.status, a.title, a.amendment_procedure_snapshot_json
  into v_document_id, v_status, v_title, v_procedure
  from public.law_amendments a
  where a.id = p_amendment_id
  for update;

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
    select new_version into v_enacted_version
    from public.internal_apply_law_amendment_operations (
      v_document_id,
      (select operations_json from public.law_amendments where id = p_amendment_id),
      v_title, v_turn_number, p_voter_citizen_id
    );

    update public.law_amendments
    set status = 'passed', resolved_turn_number = v_turn_number, enacted_version = v_enacted_version
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
