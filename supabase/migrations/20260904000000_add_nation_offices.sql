-- Migration: add_nation_offices
-- Adds public.nation_offices (#1079): officeholders a nation manager
-- appoints directly (senators, elders, clergy, chancellor, treasurer, bank
-- governor, delegate). Distinct from public.citizens.role_type
-- (nation_manager / settlement_manager), which are separate roles.
--
-- Allowed office types per government_type mirror
-- ALLOWED_NATION_OFFICE_TYPES in src/shared/government/governmentTypes.ts
-- (SQL CASE below) — treasurer/bank_governor are allowed for every
-- government, the other four are each tied to one government's
-- legislative/religious body. No per-type max in v1 (delegate/elder counts
-- are informal); readiness/succession wiring lands in a later issue.
-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.nation_offices (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid not null references public.nations (id) on delete cascade,
  office_type text not null check (
    office_type in (
      'senator',
      'elder',
      'clergy',
      'chancellor',
      'treasurer',
      'bank_governor',
      'delegate'
    )
  ),
  citizen_id uuid not null references public.citizens (id) on delete cascade,
  appointed_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nation_offices_appointed_turn_number_check check (appointed_turn_number >= 0),
  constraint nation_offices_unique unique (nation_id, citizen_id, office_type)
);

create index nation_offices_world_id_idx on public.nation_offices (world_id);

create index nation_offices_citizen_id_idx on public.nation_offices (citizen_id);

create trigger nation_offices_set_updated_at before
update on public.nation_offices for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- 2. RLS: world members read; writes only via the security-definer RPCs
-- below (no direct grants to authenticated beyond select).
-- ---------------------------------------------------------------------------
alter table public.nation_offices enable row level security;

create policy "nation_offices_select_world_access" on public.nation_offices for
select
  to authenticated using (public.current_user_has_world_access (world_id));

grant
select
  on public.nation_offices to authenticated;

-- ---------------------------------------------------------------------------
-- 3. appoint_nation_office: caller must be a world/super admin or the
-- nation's manager. Office type must be allowed for the nation's
-- government_type. Citizen must be alive and belong to a settlement of this
-- nation.
-- ---------------------------------------------------------------------------
create or replace function public.appoint_nation_office (
  p_nation_id uuid,
  p_office_type text,
  p_citizen_id uuid
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_government_type text;
  v_office_allowed boolean;
  v_citizen_status text;
  v_citizen_nation_id uuid;
  v_row public.nation_offices%rowtype;
begin
  if p_nation_id is null or p_office_type is null or p_citizen_id is null then
    raise exception 'nation, office type, and citizen are required'
      using errcode = '22023';
  end if;

  select n.world_id, w.status, w.current_turn_number, n.government_type
  into v_world_id, v_world_status, v_turn_number, v_government_type
  from public.nations n
  inner join public.worlds w on w.id = n.world_id
  where n.id = p_nation_id;

  if v_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  v_office_allowed := (
    case v_government_type
      when 'monarchy' then p_office_type in ('chancellor', 'treasurer', 'bank_governor')
      when 'republic' then p_office_type in ('senator', 'treasurer', 'bank_governor')
      when 'theocracy' then p_office_type in ('clergy', 'treasurer', 'bank_governor')
      when 'tribal_council' then p_office_type in ('elder', 'treasurer', 'bank_governor')
      when 'confederation' then p_office_type in ('delegate', 'treasurer', 'bank_governor')
      when 'despotism' then p_office_type in ('chancellor', 'treasurer', 'bank_governor')
      else false
    end
  );

  if not v_office_allowed then
    raise exception 'office type % is not allowed for government type %', p_office_type, v_government_type
      using errcode = '22023', hint = 'office_type_not_allowed';
  end if;

  select c.status, s.nation_id
  into v_citizen_status, v_citizen_nation_id
  from public.citizens c
  left join public.settlements s on s.id = c.settlement_id
  where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'citizen not found'
      using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen must be alive to hold a nation office'
      using errcode = '22023', hint = 'citizen_not_alive';
  end if;

  if v_citizen_nation_id is null or v_citizen_nation_id <> p_nation_id then
    raise exception 'citizen must belong to a settlement of this nation'
      using errcode = '22023', hint = 'citizen_not_in_nation';
  end if;

  begin
    insert into public.nation_offices (
      world_id,
      nation_id,
      office_type,
      citizen_id,
      appointed_turn_number
    )
    values (v_world_id, p_nation_id, p_office_type, p_citizen_id, v_turn_number)
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

revoke all on function public.appoint_nation_office (uuid, text, uuid)
from
  public;

grant
execute on function public.appoint_nation_office (uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. dismiss_nation_office: caller must be a world/super admin or the
-- nation's manager.
-- ---------------------------------------------------------------------------
create or replace function public.dismiss_nation_office (p_office_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_world_id uuid;
  v_world_status text;
begin
  if p_office_id is null then
    raise exception 'p_office_id must not be null'
      using errcode = '22023';
  end if;

  select o.nation_id, o.world_id, w.status
  into v_nation_id, v_world_id, v_world_status
  from public.nation_offices o
  inner join public.worlds w on w.id = o.world_id
  where o.id = p_office_id;

  if v_nation_id is null then
    raise exception 'office not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  delete from public.nation_offices where id = p_office_id;
end;
$$;

revoke all on function public.dismiss_nation_office (uuid)
from
  public;

grant
execute on function public.dismiss_nation_office (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Auto-remove offices when the citizen dies or leaves the nation (moves
-- to a settlement outside it, or has no settlement). Hard-deleting a
-- citizen already cascades via the citizen_id FK above.
-- ---------------------------------------------------------------------------
create or replace function public.nation_offices_prune_on_citizen_change () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  delete from public.nation_offices o
  where o.citizen_id = new.id
    and (
      new.status <> 'alive'
      or new.settlement_id is null
      or not exists (
        select 1
        from public.settlements s
        where s.id = new.settlement_id
          and s.nation_id = o.nation_id
      )
    );

  return new;
end;
$$;

create trigger nation_offices_prune_on_citizen_change
after
update of status,
settlement_id on public.citizens for each row
execute function public.nation_offices_prune_on_citizen_change ();

revoke
execute on function public.nation_offices_prune_on_citizen_change ()
from
  public,
  anon;
