-- Migration: add_resources
-- Creates the public.resources table: the Epic 4 resource registry.
-- Food and Fresh Water are seeded as system resources for every world at
-- migration time (backfill for existing worlds) and for every new world
-- created thereafter (AFTER INSERT trigger on public.worlds).
-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  slug text not null,
  base_stockpile_cap numeric(18, 4) not null default 0,
  is_system_resource boolean not null default false,
  is_deleted boolean not null default false,
  last_cleanup_summary_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_world_slug_unique unique (world_id, slug),
  constraint resources_name_length_check check (char_length(btrim(name)) >= 1),
  constraint resources_name_max_length_check check (char_length(name) <= 64),
  constraint resources_slug_length_check check (char_length(btrim(slug)) >= 1),
  constraint resources_slug_max_length_check check (char_length(slug) <= 64)
);

create index resources_world_id_idx on public.resources (world_id);

create trigger resources_set_updated_at before
update on public.resources for each row
execute function public.set_updated_at ();

alter table public.resources enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy "resources_select_world_access" on public.resources for
select
  to authenticated using (public.has_world_access (world_id));

create policy "resources_insert_world_admin" on public.resources for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "resources_update_world_admin" on public.resources
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

create policy "resources_delete_world_admin" on public.resources for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- System resource protection
-- Rejects any UPDATE that demotes is_system_resource from true to false, and
-- rejects any DELETE of a row whose is_system_resource is true.
-- ---------------------------------------------------------------------------
create or replace function public.protect_system_resources () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.is_system_resource = true and new.is_system_resource = false then
    raise exception 'forbidden: is_system_resource cannot be changed from true to false'
      using errcode = 'restrict_violation';
  end if;

  if tg_op = 'DELETE' and old.is_system_resource = true then
    -- Cascade deletes from world destruction are permitted: the parent world
    -- row is deleted before this BEFORE DELETE trigger fires, so checking for
    -- the world's existence distinguishes a cascade (world gone) from a direct
    -- user-initiated delete (world still present).
    if exists (
      select
        1
      from
        public.worlds
      where
        id = old.world_id
    ) then
      raise exception 'forbidden: system resources cannot be deleted'
        using errcode = 'restrict_violation';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger resources_protect_system_resources before
update
or delete on public.resources for each row
execute function public.protect_system_resources ();

-- ---------------------------------------------------------------------------
-- System resource seeding trigger
-- Inserts Food and Fresh Water into every newly created world.
-- ---------------------------------------------------------------------------
create or replace function public.seed_world_system_resources () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  insert into
    public.resources (world_id, name, slug, is_system_resource)
  values
    (new.id, 'Food', 'food', true),
    (new.id, 'Fresh Water', 'fresh-water', true)
  on conflict (world_id, slug) do nothing;

  return new;
end;
$$;

create trigger worlds_seed_system_resources
after insert on public.worlds for each row
execute function public.seed_world_system_resources ();

-- ---------------------------------------------------------------------------
-- Backfill: seed system resources for all worlds that existed before this
-- migration was applied.
-- ---------------------------------------------------------------------------
insert into
  public.resources (world_id, name, slug, is_system_resource)
select
  id,
  'Food',
  'food',
  true
from
  public.worlds
on conflict (world_id, slug) do nothing;

insert into
  public.resources (world_id, name, slug, is_system_resource)
select
  id,
  'Fresh Water',
  'fresh-water',
  true
from
  public.worlds
on conflict (world_id, slug) do nothing;
