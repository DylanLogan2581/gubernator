-- ---------------------------------------------------------------------------
-- Fix #1128: cast_law_amendment_vote / withdraw_law_amendment race applies
-- operations twice.
--
-- Both RPCs read the law_amendments row (status, etc.) without locking it,
-- then later do a plain `update ... set status = ...`. Two concurrent final
-- votes (or a final vote racing a withdraw) both see status = 'proposed' at
-- read time -- neither transaction has committed yet -- so both tally as
-- passed and both call internal_apply_law_amendment_operations: duplicate
-- articles, double version bump, double set_procedure.
--
-- Fix: `for update` on the initial law_amendments select in both functions.
-- This serializes concurrent resolvers on the same amendment row -- the
-- second transaction blocks until the first commits, then re-reads the
-- now-resolved status and is rejected by the existing
-- `if v_status <> 'proposed'` guard before it can tally or apply anything.
--
-- Bodies copied verbatim from 20261007000001_add_law_amendments.sql (the
-- latest -- only -- definition of these functions) with the single added
-- `for update` clause; no other behavior changes.
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
  where a.id = p_amendment_id
  for update;

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
