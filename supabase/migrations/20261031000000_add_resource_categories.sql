-- Migration: add_resource_categories
-- Issue #1164: world-admin-authored resource category registry, used to
-- group/filter/sort resources in the resources config table. Record-keeping
-- only -- deleting a category never deletes resources, it just clears the
-- reference (mirrors cultures/religions -> nations.primary_culture_id).
-- ---------------------------------------------------------------------------
-- resource_categories
-- ---------------------------------------------------------------------------
create table public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  icon text,
  color text not null default '#6b7280',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_categories_world_name_unique unique (world_id, name),
  constraint resource_categories_name_length_check check (char_length(btrim(name)) >= 1),
  constraint resource_categories_name_max_length_check check (char_length(name) <= 64),
  constraint resource_categories_icon_max_length_check check (
    icon is null
    or char_length(icon) <= 64
  ),
  constraint resource_categories_color_format_check check (color ~* '^#[0-9a-f]{6}$')
);

create index resource_categories_world_id_idx on public.resource_categories (world_id);

create trigger resource_categories_set_updated_at before
update on public.resource_categories for each row
execute function public.set_updated_at ();

alter table public.resource_categories enable row level security;

create policy "resource_categories_select_world_access" on public.resource_categories for
select
  to authenticated using (public.has_world_access (world_id));

create policy "resource_categories_insert_world_admin" on public.resource_categories for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "resource_categories_update_world_admin" on public.resource_categories
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

create policy "resource_categories_delete_world_admin" on public.resource_categories for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- resources.category_id
-- Nullable, ON DELETE SET NULL -- deleting a category never deletes or
-- blocks deletion of the resources that reference it; they just revert to
-- uncategorized.
-- ---------------------------------------------------------------------------
alter table public.resources
add column category_id uuid references public.resource_categories (id) on delete set null;

create index resources_category_id_idx on public.resources (category_id);
