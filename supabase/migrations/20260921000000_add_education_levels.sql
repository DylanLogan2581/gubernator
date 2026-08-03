-- Migration: add_education_levels
-- Epic 11/12 (#1099): world-admin-authored education level registry. Provides
-- the ordered ladder (e.g. Illiterate -> Basic -> Skilled -> Scholar) that
-- future citizen/job/building-tier requirements will reference by rank.
-- Foundation only -- no consumer columns added here.
-- ---------------------------------------------------------------------------
create table public.education_levels (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  rank integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_levels_world_name_unique unique (world_id, name),
  constraint education_levels_world_rank_unique unique (world_id, rank),
  constraint education_levels_name_length_check check (char_length(btrim(name)) >= 1),
  constraint education_levels_name_max_length_check check (char_length(name) <= 64),
  constraint education_levels_description_max_length_check check (
    description is null
    or char_length(description) <= 1000
  )
);

create index education_levels_world_id_idx on public.education_levels (world_id);

create trigger education_levels_set_updated_at before
update on public.education_levels for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Auto-assign rank on insert when omitted: appends the new level to the end
-- of the world's ladder so the create dialog never needs a rank field.
-- Reordering afterwards happens exclusively via reorder_education_level.
-- ---------------------------------------------------------------------------
create or replace function public.set_next_education_level_rank () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if new.rank is null then
    select coalesce(max(rank), 0) + 1
    into new.rank
    from public.education_levels
    where world_id = new.world_id;
  end if;
  return new;
end;
$$;

create trigger education_levels_set_rank before insert on public.education_levels for each row
execute function public.set_next_education_level_rank ();

alter table public.education_levels enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies -- mirrors the cultures/religions config-table pattern
-- ---------------------------------------------------------------------------
create policy "education_levels_select_world_access" on public.education_levels for
select
  to authenticated using (public.has_world_access (world_id));

create policy "education_levels_insert_world_admin" on public.education_levels for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "education_levels_update_world_admin" on public.education_levels
for update
  to authenticated using (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  )
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "education_levels_delete_world_admin" on public.education_levels for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- reorder_education_level: swaps the rank of p_level_id with its immediate
-- neighbor in the given direction. A single transaction with three updates
-- through a scratch rank (-1, which the auto-assign trigger never produces
-- since it always starts numbering at 1) avoids the transient unique
-- violation that a naive two-row swap would hit against the non-deferrable
-- (world_id, rank) constraint.
--
-- Error contract:
--   P0002 (no_data_found)          -- level not found
--   42501 (insufficient_privilege) -- caller is not a world admin/super admin
--   22023 (invalid_parameter_value)-- world is archived
--   P0001 (raise_exception)        -- invalid direction, or no neighbor to
--                                     swap with (already first/last)
-- ---------------------------------------------------------------------------
create or replace function public.reorder_education_level (p_level_id uuid, p_direction text) returns setof public.education_levels language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id      uuid;
  v_rank          integer;
  v_neighbor_id   uuid;
  v_neighbor_rank integer;
begin
  if p_level_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id, rank into v_world_id, v_rank
  from public.education_levels
  where id = p_level_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.' using errcode = '22023';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = 'P0001';
  end if;

  if p_direction = 'up' then
    select id, rank into v_neighbor_id, v_neighbor_rank
    from public.education_levels
    where world_id = v_world_id
      and rank < v_rank
    order by rank desc
    limit 1;
  else
    select id, rank into v_neighbor_id, v_neighbor_rank
    from public.education_levels
    where world_id = v_world_id
      and rank > v_rank
    order by rank asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    raise exception 'no adjacent level to swap with' using errcode = 'P0001';
  end if;

  update public.education_levels set rank = -1 where id = p_level_id;
  update public.education_levels set rank = v_rank where id = v_neighbor_id;
  update public.education_levels set rank = v_neighbor_rank where id = p_level_id;

  return query
  select * from public.education_levels
  where id in (p_level_id, v_neighbor_id);
end;
$$;

revoke all on function public.reorder_education_level (uuid, text)
from
  public;

grant
execute on function public.reorder_education_level (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_education_level: inserts a new level, leaving rank to the
-- education_levels_set_rank trigger. A raw PostgREST insert can't omit rank
-- (the generated Insert type has no way to express "server-computed, not
-- client-supplied" for a NOT NULL column without a literal DEFAULT), so
-- creation goes through this RPC instead -- mirrors how
-- reorder_education_level owns the rank column entirely.
-- ---------------------------------------------------------------------------
create or replace function public.create_education_level (p_world_id uuid, p_name text, p_description text) returns public.education_levels language plpgsql security definer
set
  search_path = '' as $$
declare
  v_result public.education_levels;
begin
  if not (
    public.is_world_admin (p_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if public.world_is_archived (p_world_id) then
    raise exception 'Archived worlds are read-only.' using errcode = '22023';
  end if;

  insert into public.education_levels (world_id, name, description)
  values (p_world_id, p_name, p_description)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_education_level (uuid, text, text)
from
  public;

grant
execute on function public.create_education_level (uuid, text, text) to authenticated;
