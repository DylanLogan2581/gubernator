-- Migration: add_settlement_offices
-- #1115: generalizes public.nation_offices to also hold settlement-scoped
-- offices (mayor, sheriff, guildmaster, ... -- player-defined via the
-- office_types registry, scope = 'settlement'). Preferred/less-churn
-- approach from the issue: add settlement_id alongside nation_id rather
-- than splitting into a second table. Exactly one of nation_id /
-- settlement_id is set per row; office_type_id must carry the matching
-- scope, enforced in the appoint RPCs below (office_types.scope already
-- exists, added in 20261003000000_add_office_types_registry.sql).
-- ---------------------------------------------------------------------------
-- 1. Table: nation_id becomes optional, settlement_id added, scope-exclusive
-- CHECK, unique constraint replaced with two scope-partial unique indexes
-- (nation_id/settlement_id are never both non-null, but a plain composite
-- unique constraint would treat two NULLs as distinct and fail to dedupe).
-- ---------------------------------------------------------------------------
alter table public.nation_offices
alter column nation_id
drop not null;

alter table public.nation_offices
add column settlement_id uuid references public.settlements (id) on delete cascade;

alter table public.nation_offices
add constraint nation_offices_scope_exclusive_check check (
  (
    nation_id is not null
    and settlement_id is null
  )
  or (
    nation_id is null
    and settlement_id is not null
  )
);

alter table public.nation_offices
drop constraint nation_offices_unique;

create unique index nation_offices_nation_unique_idx on public.nation_offices (nation_id, citizen_id, office_type_id)
where
  nation_id is not null;

create unique index nation_offices_settlement_unique_idx on public.nation_offices (settlement_id, citizen_id, office_type_id)
where
  settlement_id is not null;

create index nation_offices_settlement_id_idx on public.nation_offices (settlement_id);

comment on table public.nation_offices is 'Officeholders appointed directly by a manager: nation-scoped (senator, treasurer, ...) when nation_id is set, settlement-scoped (mayor, sheriff, ...) when settlement_id is set. Exactly one of the two is set per row (#1115).';

-- ---------------------------------------------------------------------------
-- 2. appoint_settlement_office: mirrors appoint_nation_office (#1114) but
-- for settlement-scoped offices. Authority is current_user_manages_settlement
-- (settlement manager, that settlement's nation manager, world/super admin).
-- Settlement office types are never government-type-gated -- they are
-- either world-default (nation_id null, world/super-admin-owned) or custom
-- offices the settlement's nation invented (office_types RLS already
-- restricts custom-type creation to that nation's manager or an admin), so
-- every fetched candidate type is appointable outright. The citizen must be
-- an alive resident of this exact settlement, not merely the nation.
-- ---------------------------------------------------------------------------
create or replace function public.appoint_settlement_office (
  p_settlement_id uuid,
  p_office_type text,
  p_citizen_id uuid
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_office_type_id uuid;
  v_max_holders integer;
  v_current_holders integer;
  v_citizen_status text;
  v_citizen_settlement_id uuid;
  v_row public.nation_offices%rowtype;
begin
  if p_settlement_id is null or p_office_type is null or p_citizen_id is null then
    raise exception 'settlement, office type, and citizen are required'
      using errcode = '22023';
  end if;

  select n.world_id, s.nation_id, w.status, w.current_turn_number
  into v_world_id, v_nation_id, v_world_status, v_turn_number
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  inner join public.worlds w on w.id = n.world_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'settlement not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select ot.id, ot.max_holders
  into v_office_type_id, v_max_holders
  from public.office_types ot
  where ot.world_id = v_world_id
    and (
      ot.nation_id = v_nation_id
      or ot.nation_id is null
    )
    and ot.name = p_office_type
    and ot.scope = 'settlement'
  order by ot.nation_id nulls last
  limit 1;

  if v_office_type_id is null then
    raise exception 'office type % not found for this settlement', p_office_type
      using errcode = '22023', hint = 'office_type_not_found';
  end if;

  if v_max_holders is not null then
    select count(*)
    into v_current_holders
    from public.nation_offices
    where settlement_id = p_settlement_id
      and office_type_id = v_office_type_id;

    if v_current_holders >= v_max_holders then
      raise exception 'office type % already has the maximum number of holders', p_office_type
        using errcode = '22023', hint = 'office_type_max_holders';
    end if;
  end if;

  select c.status, c.settlement_id
  into v_citizen_status, v_citizen_settlement_id
  from public.citizens c
  where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'citizen not found'
      using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen must be alive to hold a settlement office'
      using errcode = '22023', hint = 'citizen_not_alive';
  end if;

  if v_citizen_settlement_id is null or v_citizen_settlement_id <> p_settlement_id then
    raise exception 'citizen must be a resident of this settlement'
      using errcode = '22023', hint = 'citizen_not_resident';
  end if;

  begin
    insert into public.nation_offices (
      world_id,
      settlement_id,
      office_type_id,
      citizen_id,
      appointed_turn_number
    )
    values (v_world_id, p_settlement_id, v_office_type_id, p_citizen_id, v_turn_number)
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

revoke all on function public.appoint_settlement_office (uuid, text, uuid)
from
  public;

grant
execute on function public.appoint_settlement_office (uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. dismiss_settlement_office: mirrors dismiss_nation_office (#1079).
-- ---------------------------------------------------------------------------
create or replace function public.dismiss_settlement_office (p_office_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id uuid;
  v_world_id uuid;
  v_world_status text;
begin
  if p_office_id is null then
    raise exception 'p_office_id must not be null'
      using errcode = '22023';
  end if;

  select o.settlement_id, o.world_id, w.status
  into v_settlement_id, v_world_id, v_world_status
  from public.nation_offices o
  inner join public.worlds w on w.id = o.world_id
  where o.id = p_office_id
    and o.settlement_id is not null;

  if v_settlement_id is null then
    raise exception 'office not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_settlement (v_settlement_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  delete from public.nation_offices where id = p_office_id;
end;
$$;

revoke all on function public.dismiss_settlement_office (uuid)
from
  public;

grant
execute on function public.dismiss_settlement_office (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. nation_offices_prune_on_citizen_change: extend to also prune settlement
-- offices when the citizen dies or moves to a different settlement (a
-- settlement office is tied to residency in that exact settlement, unlike a
-- nation office which only requires membership somewhere in the nation).
-- ---------------------------------------------------------------------------
create or replace function public.nation_offices_prune_on_citizen_change () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  delete from public.nation_offices o
  where o.citizen_id = new.id
    and (
      new.status <> 'alive'
      or (
        o.nation_id is not null
        and (
          new.settlement_id is null
          or not exists (
            select 1
            from public.settlements s
            where s.id = new.settlement_id
              and s.nation_id = o.nation_id
          )
        )
      )
      or (
        o.settlement_id is not null
        and (
          new.settlement_id is null
          or new.settlement_id <> o.settlement_id
        )
      )
    );

  return new;
end;
$$;
