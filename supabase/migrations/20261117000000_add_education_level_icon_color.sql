-- Migration: add_education_level_icon_color
-- Issue #1251: education levels are the only configurable world entity
-- without an icon + icon color, so they render as plain text in the config
-- table. Mirrors the icon/icon_color pattern added to resources,
-- job_definitions, building_blueprints, deposit_types, and
-- managed_population_types in 20261113000000_add_icon_color_to_config_entities.sql
-- -- icon is a curated Lucide/game-icon name, icon_color is one of the 8
-- theme palette slots (null keeps the UUID-hash fallback).
alter table public.education_levels
add column icon text,
add column icon_color smallint;

alter table public.education_levels
add constraint education_levels_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
),
add constraint education_levels_icon_color_range_check check (
  icon_color is null
  or icon_color between 1 and 8
);

-- ---------------------------------------------------------------------------
-- create_education_level: add p_icon/p_icon_color (both default null).
-- Creation goes through this RPC (rank is server-computed), so the new
-- columns must be settable at create time, not just via update. A defaulted
-- trailing parameter still requires dropping the old signature first --
-- Postgres treats a changed parameter count as a distinct overload rather
-- than a replacement (same reasoning as
-- 20261104000000_add_education_natural_born_percent.sql).
-- ---------------------------------------------------------------------------
drop function if exists public.create_education_level (uuid, text, text, numeric);

create or replace function public.create_education_level (
  p_world_id uuid,
  p_name text,
  p_description text,
  p_natural_born_percent numeric default 0,
  p_icon text default null,
  p_icon_color smallint default null
) returns public.education_levels language plpgsql security definer
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

  insert into public.education_levels (world_id, name, description, natural_born_percent, icon, icon_color)
  values (p_world_id, p_name, p_description, coalesce(p_natural_born_percent, 0), p_icon, p_icon_color)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_education_level (uuid, text, text, numeric, text, smallint)
from
  public;

grant
execute on function public.create_education_level (uuid, text, text, numeric, text, smallint) to authenticated;
