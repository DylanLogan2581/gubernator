-- #1138: create_law_document stored p_amendment_procedure_json completely
-- unvalidated ("opaque" -- see 20261006000000 comment), but 20261007000001
-- made it live: propose_law_amendment and cast_law_amendment_vote interpret
-- it, and validate_law_amendment_procedure_json's scope check (a vote
-- procedure's bodyId/secondBodyId must belong to the document's own
-- nation/settlement) was only ever enforced on set_procedure amendments. A
-- creator could set a vote procedure pointing at a body from a different
-- nation/world, or malformed JSON, and brick the amendment flow for that
-- document from turn one.
--
-- Fix: split validate_law_amendment_procedure_json into a document-less
-- variant that takes the nation/settlement scope directly (usable before a
-- law_documents row exists), and keep the existing document_id-taking
-- overload as a thin wrapper that looks up the document's scope and
-- delegates. create_law_document then validates before insert, with the
-- same scope rules set_procedure already enforces.
-- ---------------------------------------------------------------------------
-- 1. validate_law_amendment_procedure_json (jsonb, uuid, uuid): the
-- document-less variant. Body copied from the (jsonb, uuid) overload in
-- 20261007000001, with the law_documents lookup replaced by the passed-in
-- scope.
-- ---------------------------------------------------------------------------
create or replace function public.validate_law_amendment_procedure_json (
  p_procedure jsonb,
  p_nation_id uuid,
  p_settlement_id uuid
) returns void language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_kind text;
  v_authority jsonb;
  v_threshold text;
  v_voting_period integer;
  v_body_id uuid;
  v_second_body_id uuid;
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

    if not exists (
      select 1 from public.government_bodies b
      where b.id = v_body_id
        and (
          (p_nation_id is not null and b.nation_id = p_nation_id)
          or (p_settlement_id is not null and b.settlement_id = p_settlement_id)
        )
    ) then
      raise exception 'procedure body not found'
        using errcode = '22023', hint = 'procedure_body_not_found';
    end if;

    if v_second_body_id is not null and not exists (
      select 1 from public.government_bodies b
      where b.id = v_second_body_id
        and (
          (p_nation_id is not null and b.nation_id = p_nation_id)
          or (p_settlement_id is not null and b.settlement_id = p_settlement_id)
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

revoke all on function public.validate_law_amendment_procedure_json (jsonb, uuid, uuid)
from
  public;

-- ---------------------------------------------------------------------------
-- 2. validate_law_amendment_procedure_json (jsonb, uuid): unchanged
-- signature/callers (internal_apply_law_amendment_operations' set_procedure
-- op), now a thin wrapper delegating to the document-less variant above.
-- ---------------------------------------------------------------------------
create or replace function public.validate_law_amendment_procedure_json (p_procedure jsonb, p_document_id uuid) returns void language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_settlement_id uuid;
begin
  select nation_id, settlement_id into v_nation_id, v_settlement_id
  from public.law_documents
  where id = p_document_id;

  perform public.validate_law_amendment_procedure_json (p_procedure, v_nation_id, v_settlement_id);
end;
$$;

revoke all on function public.validate_law_amendment_procedure_json (jsonb, uuid)
from
  public;

-- ---------------------------------------------------------------------------
-- 3. create_law_document: now validates p_amendment_procedure_json against
-- the target nation/settlement scope before insert, closing the gap where a
-- creator could set a vote procedure pointing at an out-of-scope body or
-- store malformed JSON that would later brick propose_law_amendment /
-- cast_law_amendment_vote for the document (#1138). Body otherwise
-- unchanged from 20261006000000.
-- ---------------------------------------------------------------------------
create or replace function public.create_law_document (
  p_world_id uuid,
  p_nation_id uuid,
  p_settlement_id uuid,
  p_title text,
  p_preamble_markdown text,
  p_amendment_procedure_json jsonb,
  p_articles jsonb
) returns public.law_documents language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_turn_number integer;
  v_owning_world_id uuid;
  v_document public.law_documents%rowtype;
  v_article jsonb;
  v_article_count integer;
  v_index integer;
begin
  if p_world_id is null or p_title is null or p_articles is null then
    raise exception 'world, title, and articles are required'
      using errcode = '22023';
  end if;

  if (p_nation_id is null) = (p_settlement_id is null) then
    raise exception 'exactly one of nation or settlement is required'
      using errcode = '22023';
  end if;

  if btrim(p_title) = '' then
    raise exception 'title must not be blank'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_articles) <> 'array' or jsonb_array_length(p_articles) = 0 then
    raise exception 'at least one article is required'
      using errcode = '22023', hint = 'articles_required';
  end if;

  select status, current_turn_number
  into v_world_status, v_turn_number
  from public.worlds
  where id = p_world_id;

  if v_world_status is null then
    raise exception 'world not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if p_nation_id is not null then
    select world_id into v_owning_world_id
    from public.nations
    where id = p_nation_id;

    if v_owning_world_id is null or v_owning_world_id <> p_world_id then
      raise exception 'nation not found in this world'
        using errcode = 'P0002';
    end if;

    if not public.current_user_manages_nation (p_nation_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;
  else
    select n.world_id into v_owning_world_id
    from public.settlements s
    inner join public.nations n on n.id = s.nation_id
    where s.id = p_settlement_id;

    if v_owning_world_id is null or v_owning_world_id <> p_world_id then
      raise exception 'settlement not found in this world'
        using errcode = 'P0002';
    end if;

    if not public.current_user_manages_settlement (p_settlement_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;
  end if;

  v_article_count := jsonb_array_length(p_articles);
  for v_index in 0..(v_article_count - 1) loop
    v_article := p_articles -> v_index;

    if jsonb_typeof(v_article) <> 'object'
      or not (v_article ? 'heading')
      or not (v_article ? 'bodyMarkdown')
      or jsonb_typeof(v_article -> 'heading') <> 'string'
      or jsonb_typeof(v_article -> 'bodyMarkdown') <> 'string'
      or btrim(v_article ->> 'heading') = ''
      or btrim(v_article ->> 'bodyMarkdown') = '' then
      raise exception 'each article requires a heading and body'
        using errcode = '22023', hint = 'article_invalid';
    end if;
  end loop;

  perform public.validate_law_amendment_procedure_json (
    coalesce(p_amendment_procedure_json, '{}'::jsonb),
    p_nation_id,
    p_settlement_id
  );

  insert into public.law_documents (
    world_id,
    nation_id,
    settlement_id,
    title,
    preamble_markdown,
    status,
    amendment_procedure_json,
    current_version,
    created_turn_number
  )
  values (
    p_world_id,
    p_nation_id,
    p_settlement_id,
    btrim(p_title),
    p_preamble_markdown,
    'active',
    coalesce(p_amendment_procedure_json, '{}'::jsonb),
    1,
    v_turn_number
  )
  returning * into v_document;

  for v_index in 0..(v_article_count - 1) loop
    v_article := p_articles -> v_index;

    insert into public.law_articles (
      document_id,
      article_number,
      heading,
      body_markdown,
      status,
      sort_order
    )
    values (
      v_document.id,
      v_index + 1,
      btrim(v_article ->> 'heading'),
      v_article ->> 'bodyMarkdown',
      'active',
      v_index + 1
    );
  end loop;

  insert into public.law_document_versions (
    document_id,
    version,
    articles_snapshot_json,
    amendment_title,
    enacted_turn_number
  )
  select
    v_document.id,
    1,
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
    'Initial enactment',
    v_turn_number
  from public.law_articles a
  where a.document_id = v_document.id;

  return v_document;
end;
$$;

revoke all on function public.create_law_document (uuid, uuid, uuid, text, text, jsonb, jsonb)
from
  public;

grant
execute on function public.create_law_document (uuid, uuid, uuid, text, text, jsonb, jsonb) to authenticated;
