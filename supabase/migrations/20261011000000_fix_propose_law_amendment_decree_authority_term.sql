-- ---------------------------------------------------------------------------
-- Fix propose_law_amendment: decree-authority office check missed the
-- ended_turn_number is null filter added by 20261009000001_add_office_terms
-- to every other office-holder check. An expired officeholder could still
-- instant-apply decree-kind amendments. Copied from the latest prior
-- definition (20261007000001) with the filter added.
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
