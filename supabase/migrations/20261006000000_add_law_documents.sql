-- Migration: add_law_documents
-- #1117: DM-reference law books for a nation or settlement -- a document
-- (title + preamble) made of numbered articles, with full ratification
-- history. Zero simulation effects. Writes are RPC-only (create_law_document,
-- repeal_law_document below): there is no INSERT/UPDATE/DELETE grant on any
-- of the three tables, so every change is versioned by construction -- no
-- direct UPDATE path exists to edit an article outside a version snapshot.
-- Full amendment/decree procedures (amendment_procedure_json's shape,
-- amend-document RPC) are a later issue; this one stores the procedure
-- opaquely and only supports create + direct admin repeal.
-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.law_documents (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid references public.nations (id) on delete cascade,
  settlement_id uuid references public.settlements (id) on delete cascade,
  title text not null,
  preamble_markdown text,
  status text not null default 'active' check (status in ('active', 'repealed')),
  amendment_procedure_json jsonb not null default '{}'::jsonb,
  current_version integer not null default 1,
  created_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint law_documents_scope_exclusive_check check (
    (
      nation_id is not null
      and settlement_id is null
    )
    or (
      nation_id is null
      and settlement_id is not null
    )
  ),
  constraint law_documents_title_length_check check (char_length(btrim(title)) >= 1),
  constraint law_documents_title_max_length_check check (char_length(title) <= 200),
  constraint law_documents_preamble_max_length_check check (char_length(preamble_markdown) <= 20000),
  constraint law_documents_current_version_check check (current_version >= 1),
  constraint law_documents_created_turn_number_check check (created_turn_number >= 0)
);

create index law_documents_world_id_idx on public.law_documents (world_id);

create index law_documents_nation_id_idx on public.law_documents (nation_id);

create index law_documents_settlement_id_idx on public.law_documents (settlement_id);

create trigger law_documents_set_updated_at before
update on public.law_documents for each row
execute function public.set_updated_at ();

comment on table public.law_documents is 'A nation or settlement''s book of law: title, preamble, and a versioned set of articles. Exactly one of nation_id / settlement_id is set per row. DM-reference only, zero simulation effects (#1117).';

create table public.law_articles (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.law_documents (id) on delete cascade,
  article_number integer not null,
  heading text not null,
  body_markdown text not null,
  status text not null default 'active' check (status in ('active', 'repealed')),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint law_articles_article_number_check check (article_number >= 1),
  constraint law_articles_heading_length_check check (char_length(btrim(heading)) >= 1),
  constraint law_articles_heading_max_length_check check (char_length(heading) <= 200),
  constraint law_articles_document_article_number_unique unique (document_id, article_number)
);

create index law_articles_document_id_idx on public.law_articles (document_id);

create trigger law_articles_set_updated_at before
update on public.law_articles for each row
execute function public.set_updated_at ();

comment on table public.law_articles is 'Current article state for a law_documents row. article_number is a stable identity, never reused across amendments. No direct UPDATE path exists -- every change flows through an RPC that also writes a law_document_versions snapshot (#1117).';

create table public.law_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.law_documents (id) on delete cascade,
  version integer not null,
  articles_snapshot_json jsonb not null,
  amendment_title text not null,
  enacted_turn_number integer not null,
  enacted_by_citizen_id uuid references public.citizens (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint law_document_versions_version_check check (version >= 1),
  constraint law_document_versions_enacted_turn_number_check check (enacted_turn_number >= 0),
  constraint law_document_versions_document_version_unique unique (document_id, version)
);

create index law_document_versions_document_id_idx on public.law_document_versions (document_id);

comment on table public.law_document_versions is 'Full-article-set snapshot taken every time a law_documents row is enacted or amended. Version 1 is written by create_law_document; later versions are written by the amend-document RPC (later issue) (#1117).';

-- ---------------------------------------------------------------------------
-- 2. RLS: world members read (nation visibility per #1086 for nation-scoped
-- documents, world access for settlement-scoped ones, mirroring
-- settlements' own SELECT policy since there is no settlement-level
-- visibility helper). No INSERT/UPDATE/DELETE grants on any of the three
-- tables -- all writes go through the SECURITY DEFINER RPCs below, which
-- run as the function owner and so are unaffected by the lack of grants.
-- ---------------------------------------------------------------------------
alter table public.law_documents enable row level security;

create policy "law_documents_select_visibility" on public.law_documents for
select
  to authenticated using (
    case
      when nation_id is not null then public.nation_visible_to_current_user (nation_id)
      else public.current_user_has_world_access (world_id)
    end
  );

grant
select
  on public.law_documents to authenticated;

alter table public.law_articles enable row level security;

create policy "law_articles_select_visibility" on public.law_articles for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.law_documents d
      where
        d.id = law_articles.document_id
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
  on public.law_articles to authenticated;

alter table public.law_document_versions enable row level security;

create policy "law_document_versions_select_visibility" on public.law_document_versions for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.law_documents d
      where
        d.id = law_document_versions.document_id
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
  on public.law_document_versions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. create_law_document: title + preamble + initial articles + initial
-- (opaque) amendment procedure, written as version 1. Authority mirrors
-- appoint_nation_office / appoint_settlement_office: the nation's manager
-- for a nation-scoped document, the settlement's manager (or its nation's
-- manager) for a settlement-scoped one; world/super admins are covered by
-- current_user_manages_nation / current_user_manages_settlement already.
-- p_articles is a jsonb array of {heading, bodyMarkdown} objects in display
-- order; article_number and sort_order are assigned 1..N by this function.
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

-- ---------------------------------------------------------------------------
-- 4. repeal_law_document: direct admin repeal (world/super admin only). The
-- amendment-procedure-gated repeal path for nation/settlement managers lands
-- in the amendments issue; this is the escape hatch for now.
-- ---------------------------------------------------------------------------
create or replace function public.repeal_law_document (p_document_id uuid) returns public.law_documents language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_status text;
  v_document public.law_documents%rowtype;
begin
  if p_document_id is null then
    raise exception 'p_document_id must not be null'
      using errcode = '22023';
  end if;

  select d.world_id, d.status, w.status
  into v_world_id, v_status, v_world_status
  from public.law_documents d
  inner join public.worlds w on w.id = d.world_id
  where d.id = p_document_id;

  if v_world_id is null then
    raise exception 'document not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if v_status = 'repealed' then
    raise exception 'document is already repealed'
      using errcode = '22023', hint = 'document_already_repealed';
  end if;

  update public.law_documents
  set
    status = 'repealed'
  where
    id = p_document_id
  returning * into v_document;

  return v_document;
end;
$$;

revoke all on function public.repeal_law_document (uuid)
from
  public;

grant
execute on function public.repeal_law_document (uuid) to authenticated;
