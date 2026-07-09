-- Migration: add_decrees
-- #1121: one-off proclamations ("All exports of amulets are banned") for a
-- nation or settlement -- pure roleplay/DM reference, zero simulation
-- effects. Distinct from law_amendments' decree-procedure amendments
-- (20261007000001): an amendment always changes a law_documents' articles
-- and is scoped to one document's amendment procedure, while a row here is a
-- standalone announcement with no document, no articles, and no procedure
-- gating -- amendment decree-applies never write to this table. History is
-- preserved: revoke_decree sets revoked_turn_number rather than deleting.
-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.decrees (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid references public.nations (id) on delete cascade,
  settlement_id uuid references public.settlements (id) on delete cascade,
  title text not null,
  body_markdown text not null,
  issued_by_citizen_id uuid references public.citizens (id) on delete set null,
  issued_turn_number integer not null,
  revoked_turn_number integer,
  created_at timestamptz not null default now(),
  constraint decrees_scope_exclusive_check check (
    (
      nation_id is not null
      and settlement_id is null
    )
    or (
      nation_id is null
      and settlement_id is not null
    )
  ),
  constraint decrees_title_length_check check (char_length(btrim(title)) >= 1),
  constraint decrees_title_max_length_check check (char_length(title) <= 200),
  constraint decrees_body_markdown_length_check check (char_length(btrim(body_markdown)) >= 1),
  constraint decrees_body_markdown_max_length_check check (char_length(body_markdown) <= 20000),
  constraint decrees_issued_turn_number_check check (issued_turn_number >= 0),
  constraint decrees_revoked_turn_number_check check (
    revoked_turn_number is null
    or revoked_turn_number >= issued_turn_number
  )
);

create index decrees_world_id_idx on public.decrees (world_id);

create index decrees_nation_id_idx on public.decrees (nation_id);

create index decrees_settlement_id_idx on public.decrees (settlement_id);

comment on table public.decrees is 'Standalone proclamations for a nation or settlement -- pure roleplay/DM reference, zero simulation effects. Exactly one of nation_id / settlement_id is set per row. Never written by the law_amendments decree-apply path; revoked rows are kept (revoked_turn_number set) rather than deleted (#1121).';

-- ---------------------------------------------------------------------------
-- 2. RLS: world members read (nation visibility per #1086 for nation-scoped
-- decrees, world access for settlement-scoped ones, mirroring
-- law_documents_select_visibility). No INSERT/UPDATE/DELETE grants -- all
-- writes go through the SECURITY DEFINER RPCs below.
-- ---------------------------------------------------------------------------
alter table public.decrees enable row level security;

create policy "decrees_select_visibility" on public.decrees for
select
  to authenticated using (
    case
      when nation_id is not null then public.nation_visible_to_current_user (nation_id)
      else public.current_user_has_world_access (world_id)
    end
  );

grant
select
  on public.decrees to authenticated;

-- ---------------------------------------------------------------------------
-- 3. issue_decree: authority is manage-nation / manage-settlement for the
-- scope (current_user_manages_nation / current_user_manages_settlement,
-- which already fold in super admin and world admin). issued_by is the
-- current user's own manager citizen for that scope when they are not an
-- admin; a world/super admin instead records the acting citizen id passed
-- explicitly (p_issued_by_citizen_id), since an admin need not hold the
-- manager role themselves.
-- ---------------------------------------------------------------------------
create or replace function public.issue_decree (
  p_world_id uuid,
  p_nation_id uuid,
  p_settlement_id uuid,
  p_title text,
  p_body_markdown text,
  p_issued_by_citizen_id uuid
) returns public.decrees language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_turn_number integer;
  v_owning_world_id uuid;
  v_is_admin boolean;
  v_issued_by uuid;
  v_decree public.decrees%rowtype;
begin
  if p_world_id is null or p_title is null or p_body_markdown is null then
    raise exception 'world, title, and body are required'
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

  if btrim(p_body_markdown) = '' then
    raise exception 'body must not be blank'
      using errcode = '22023';
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

  v_is_admin := public.is_world_admin (p_world_id) or public.is_super_admin ();

  if v_is_admin then
    if p_issued_by_citizen_id is null then
      raise exception 'p_issued_by_citizen_id is required'
        using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.citizens c
      where c.id = p_issued_by_citizen_id and c.world_id = p_world_id
    ) then
      raise exception 'issuing citizen not found in this world'
        using errcode = 'P0002';
    end if;

    v_issued_by := p_issued_by_citizen_id;
  elsif p_nation_id is not null then
    select c.id into v_issued_by
    from public.citizens c
    where c.role_type = 'nation_manager'
      and c.role_nation_id = p_nation_id
      and c.status = 'alive'
      and c.user_id = auth.uid ()
    limit 1;
  else
    select c.id into v_issued_by
    from public.citizens c
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = p_settlement_id
      and c.status = 'alive'
      and c.user_id = auth.uid ()
    limit 1;
  end if;

  if v_issued_by is null then
    raise exception 'no active manager citizen found for the current user'
      using errcode = '42501';
  end if;

  insert into public.decrees (
    world_id, nation_id, settlement_id, title, body_markdown,
    issued_by_citizen_id, issued_turn_number
  )
  values (
    p_world_id, p_nation_id, p_settlement_id, btrim(p_title), p_body_markdown,
    v_issued_by, v_turn_number
  )
  returning * into v_decree;

  return v_decree;
end;
$$;

revoke all on function public.issue_decree (uuid, uuid, uuid, text, text, uuid)
from
  public;

grant
execute on function public.issue_decree (uuid, uuid, uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. revoke_decree: same authority as issue_decree (manage-nation /
-- manage-settlement for the decree's scope). History preserved --
-- revoked_turn_number is set, the row is never deleted.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_decree (p_decree_id uuid) returns public.decrees language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_revoked_turn_number integer;
  v_decree public.decrees%rowtype;
begin
  if p_decree_id is null then
    raise exception 'p_decree_id must not be null'
      using errcode = '22023';
  end if;

  select d.world_id, d.nation_id, d.settlement_id, d.revoked_turn_number, w.status, w.current_turn_number
  into v_world_id, v_nation_id, v_settlement_id, v_revoked_turn_number, v_world_status, v_turn_number
  from public.decrees d
  inner join public.worlds w on w.id = d.world_id
  where d.id = p_decree_id;

  if v_world_id is null then
    raise exception 'decree not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if v_revoked_turn_number is not null then
    raise exception 'decree is already revoked'
      using errcode = '22023', hint = 'decree_already_revoked';
  end if;

  if not (
    case
      when v_nation_id is not null then public.current_user_manages_nation (v_nation_id)
      else public.current_user_manages_settlement (v_settlement_id)
    end
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  update public.decrees
  set revoked_turn_number = v_turn_number
  where id = p_decree_id
  returning * into v_decree;

  return v_decree;
end;
$$;

revoke all on function public.revoke_decree (uuid)
from
  public;

grant
execute on function public.revoke_decree (uuid) to authenticated;
