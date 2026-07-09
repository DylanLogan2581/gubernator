-- Migration: add_office_types_registry
-- #1114: replaces the fixed office_type CHECK enum on public.nation_offices
-- with a proper registry table. World-default rows (nation_id null) seed the
-- Epic 11 (#1079) enum values per existing world so appoint_nation_office
-- and downstream authority checks keep working unchanged; nation managers
-- can additionally invent custom offices (nation_id set) that are not tied
-- to any government_type allow-list.
-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.office_types (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid references public.nations (id) on delete cascade,
  name text not null,
  description text,
  scope text not null check (scope in ('nation', 'settlement')),
  icon text,
  color text,
  max_holders integer,
  excludes_from_labor boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_types_name_length_check check (char_length(btrim(name)) >= 1),
  constraint office_types_name_max_length_check check (char_length(name) <= 64),
  constraint office_types_max_holders_check check (
    max_holders is null
    or max_holders > 0
  )
);

-- Case-insensitive uniqueness per (world, owner): owner is either a specific
-- nation (custom offices) or "no nation" (world-default offices), coalesced
-- to the nil uuid so two null nation_ids in the same world collide too.
create unique index office_types_world_owner_name_idx on public.office_types (
  world_id,
  coalesce(
    nation_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  lower(name)
);

create index office_types_world_id_idx on public.office_types (world_id);

create index office_types_nation_id_idx on public.office_types (nation_id);

create trigger office_types_set_updated_at before
update on public.office_types for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- 2. Seed world-default rows for every existing world, matching the Epic 11
-- enum values exactly (name = raw enum value, so every existing caller that
-- passes a literal like 'bank_governor' keeps matching by name).
-- ---------------------------------------------------------------------------
insert into
  public.office_types (
    world_id,
    nation_id,
    name,
    description,
    scope,
    excludes_from_labor
  )
select
  w.id,
  null,
  d.name,
  d.description,
  'nation',
  true
from
  public.worlds w
  cross join (
    values
      ('senator', 'Legislative office of a republic.'),
      ('elder', 'Council office of a tribal council.'),
      ('clergy', 'Religious office of a theocracy.'),
      (
        'chancellor',
        'Head-of-government office of a monarchy or despotism.'
      ),
      (
        'treasurer',
        'Manages nation finances; allowed for every government.'
      ),
      (
        'bank_governor',
        'Authority over the nation''s central bank; allowed for every government.'
      ),
      (
        'delegate',
        'Representative office of a confederation.'
      )
  ) as d (name, description);

-- ---------------------------------------------------------------------------
-- 2b. Auto-seed the same seven world-default office types for every world
-- created from now on (the insert above only covers worlds that already
-- existed when this migration ran).
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_office_types () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into public.office_types (
    world_id, nation_id, name, description, scope, excludes_from_labor
  )
  values
    (new.id, null, 'senator', 'Legislative office of a republic.', 'nation', true),
    (new.id, null, 'elder', 'Council office of a tribal council.', 'nation', true),
    (new.id, null, 'clergy', 'Religious office of a theocracy.', 'nation', true),
    (
      new.id,
      null,
      'chancellor',
      'Head-of-government office of a monarchy or despotism.',
      'nation',
      true
    ),
    (
      new.id,
      null,
      'treasurer',
      'Manages nation finances; allowed for every government.',
      'nation',
      true
    ),
    (
      new.id,
      null,
      'bank_governor',
      'Authority over the nation''s central bank; allowed for every government.',
      'nation',
      true
    ),
    (new.id, null, 'delegate', 'Representative office of a confederation.', 'nation', true);

  return new;
end;
$$;

create trigger worlds_seed_default_office_types
after insert on public.worlds for each row
execute function public.seed_default_office_types ();

revoke
execute on function public.seed_default_office_types ()
from
  public,
  anon;

-- ---------------------------------------------------------------------------
-- 3. Convert nation_offices.office_type (text) -> office_type_id (FK),
-- mapping every existing row onto the world-default row with the same name.
-- ---------------------------------------------------------------------------
alter table public.nation_offices
add column office_type_id uuid references public.office_types (id) on delete restrict;

update public.nation_offices o
set
  office_type_id = ot.id
from
  public.office_types ot
where
  ot.world_id = o.world_id
  and ot.nation_id is null
  and ot.name = o.office_type;

-- No orphaned rows: every pre-existing office_type value was one of the
-- seven enum values, and every world just received all seven as defaults.
alter table public.nation_offices
alter column office_type_id
set not null;

alter table public.nation_offices
drop constraint nation_offices_unique;

alter table public.nation_offices
add constraint nation_offices_unique unique (nation_id, citizen_id, office_type_id);

create index nation_offices_office_type_id_idx on public.nation_offices (office_type_id);

-- citizen_directory_view (redefined below in section 7) must stop reading
-- nation_offices.office_type before that column can be dropped -- do the
-- drop after the view redefinition instead of here.
-- ---------------------------------------------------------------------------
-- 4. RLS: world members read; world-default rows (nation_id null) are
-- written by world/super admins, custom rows (nation_id set) by that
-- nation's manager. Direct table grants are column-scoped so world_id,
-- nation_id, and scope can only ever be set on insert, never changed after.
-- The delete policy needs nation_offices.office_type_id, so this block runs
-- after section 3 above adds that column.
--
-- current_user_can_own_office_type is security definer so the nation
-- lookup bypasses nations RLS -- nation managers commonly have no
-- settlement of their own (see nation_offices #1079), which means
-- nation_visible_to_current_user(nation_id) can be false for them even
-- though current_user_manages_nation(nation_id) is true; a plain in-policy
-- EXISTS against public.nations would incorrectly deny them here.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_can_own_office_type (p_world_id uuid, p_nation_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.current_user_manages_nation (p_nation_id)
    and exists (
      select 1
      from public.nations n
      where n.id = p_nation_id
        and n.world_id = p_world_id
    )
$$;

revoke all on function public.current_user_can_own_office_type (uuid, uuid)
from
  public;

grant
execute on function public.current_user_can_own_office_type (uuid, uuid) to authenticated;

alter table public.office_types enable row level security;

create policy "office_types_select_world_access" on public.office_types for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "office_types_insert_authority" on public.office_types for insert to authenticated
with
  check (
    not public.world_is_archived (world_id)
    and (
      case
        when nation_id is null then (
          public.is_world_admin (world_id)
          or public.is_super_admin ()
        )
        else public.current_user_can_own_office_type (world_id, nation_id)
      end
    )
  );

create policy "office_types_update_authority" on public.office_types
for update
  to authenticated using (
    not public.world_is_archived (world_id)
    and (
      case
        when nation_id is null then (
          public.is_world_admin (world_id)
          or public.is_super_admin ()
        )
        else public.current_user_manages_nation (nation_id)
      end
    )
  )
with
  check (
    case
      when nation_id is null then (
        public.is_world_admin (world_id)
        or public.is_super_admin ()
      )
      else public.current_user_manages_nation (nation_id)
    end
  );

create policy "office_types_delete_authority" on public.office_types for delete to authenticated using (
  not public.world_is_archived (world_id)
  and (
    case
      when nation_id is null then (
        public.is_world_admin (world_id)
        or public.is_super_admin ()
      )
      else public.current_user_manages_nation (nation_id)
    end
  )
  and not exists (
    select
      1
    from
      public.nation_offices o
    where
      o.office_type_id = office_types.id
  )
);

grant
select
  on public.office_types to authenticated;

grant insert (
  world_id,
  nation_id,
  name,
  description,
  scope,
  icon,
  color,
  max_holders,
  excludes_from_labor
) on public.office_types to authenticated;

grant
update (
  name,
  description,
  icon,
  color,
  max_holders,
  excludes_from_labor
) on public.office_types to authenticated;

grant delete on public.office_types to authenticated;

-- ---------------------------------------------------------------------------
-- 5. appoint_nation_office: p_office_type is now resolved by name against
-- the registry (nation-owned custom office first, else the world-default
-- with that name) instead of the fixed CHECK enum. World-default offices
-- keep the exact per-government_type allow-list from #1079; custom offices
-- are not gated by government_type (the nation invented them deliberately).
-- max_holders (new) is enforced when set.
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
  v_office_type_id uuid;
  v_office_type_nation_id uuid;
  v_max_holders integer;
  v_current_holders integer;
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

  select ot.id, ot.nation_id, ot.max_holders
  into v_office_type_id, v_office_type_nation_id, v_max_holders
  from public.office_types ot
  where ot.world_id = v_world_id
    and (
      ot.nation_id = p_nation_id
      or ot.nation_id is null
    )
    and ot.name = p_office_type
    and ot.scope = 'nation'
  order by ot.nation_id nulls last
  limit 1;

  if v_office_type_id is null then
    raise exception 'office type % not found for this nation', p_office_type
      using errcode = '22023', hint = 'office_type_not_found';
  end if;

  if v_office_type_nation_id is null then
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
  end if;

  if v_max_holders is not null then
    select count(*)
    into v_current_holders
    from public.nation_offices
    where nation_id = p_nation_id
      and office_type_id = v_office_type_id;

    if v_current_holders >= v_max_holders then
      raise exception 'office type % already has the maximum number of holders', p_office_type
        using errcode = '22023', hint = 'office_type_max_holders';
    end if;
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
      office_type_id,
      citizen_id,
      appointed_turn_number
    )
    values (v_world_id, p_nation_id, v_office_type_id, p_citizen_id, v_turn_number)
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. current_user_holds_nation_office / current_user_nation_currency_actor_
-- citizen_id: redefined to join office_types by name (p_office_type / the
-- literal 'bank_governor' still resolve correctly for the seeded default).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_holds_nation_office (p_nation_id uuid, p_office_type text) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.nation_offices o
    join public.office_types ot on ot.id = o.office_type_id
    join public.citizens c on c.id = o.citizen_id
    where o.nation_id = p_nation_id
      and ot.name = p_office_type
      and c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.status = 'alive'
  )
$$;

create or replace function public.current_user_nation_currency_actor_citizen_id (p_nation_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (
      select o.citizen_id
      from public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
      join public.citizens c on c.id = o.citizen_id
      where o.nation_id = p_nation_id
        and ot.name = 'bank_governor'
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    ),
    (
      select c.id
      from public.citizens c
      where c.role_type = 'nation_manager'
        and c.role_nation_id = p_nation_id
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- 7. citizen_directory_view: office_types aggregate now joins through the
-- registry by name instead of reading the dropped office_type column.
-- Copied from the latest prior definition (20260922000000) with only that
-- one join/column swapped.
-- ---------------------------------------------------------------------------
create or replace view public.citizen_directory_view
with
  (security_invoker = true) as
select
  c.id,
  c.world_id,
  c.name,
  c.sex,
  c.status,
  c.citizen_type,
  c.born_on_turn_number,
  w.current_turn_number - c.born_on_turn_number as age_turns,
  c.settlement_id,
  s.name as settlement_name,
  s.nation_id,
  n.name as nation_name,
  ca.assignment_type,
  case ca.assignment_type
    when 'standard_job' then jd_standard.name
    when 'deposit' then jd_deposit.name
    when 'husbandry' then jd_husbandry.name
    when 'culling' then jd_culling.name
    when 'trade_route' then 'Trader'
    when 'construction_project' then 'Construction'
    else null
  end as assignment_label,
  (
    select
      string_agg(
        ot.name,
        ', '
        order by
          ot.name
      )
    from
      public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
    where
      o.citizen_id = c.id
  ) as office_types,
  el.name as education_level_name
from
  public.citizens c
  join public.worlds w on w.id = c.world_id
  left join public.settlements s on s.id = c.settlement_id
  left join public.nations n on n.id = s.nation_id
  left join public.citizen_assignments ca on ca.citizen_id = c.id
  left join public.job_definitions jd_standard on jd_standard.id = ca.job_id
  and ca.assignment_type = 'standard_job'
  left join public.deposit_instances di on di.id = ca.deposit_instance_id
  left join public.deposit_types dt on dt.id = di.deposit_type_id
  left join public.job_definitions jd_deposit on jd_deposit.id = dt.job_id
  left join public.managed_population_instances mpi on mpi.id = ca.managed_population_instance_id
  left join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
  left join public.job_definitions jd_husbandry on jd_husbandry.id = mpt.husbandry_job_id
  left join public.job_definitions jd_culling on jd_culling.id = mpt.culling_job_id
  left join public.education_levels el on el.id = c.education_level_id;

grant
select
  on public.citizen_directory_view to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Now that citizen_directory_view no longer reads it, drop the old enum
-- column -- office_type_id (section 3) is the only source of truth.
-- ---------------------------------------------------------------------------
alter table public.nation_offices
drop column office_type;
