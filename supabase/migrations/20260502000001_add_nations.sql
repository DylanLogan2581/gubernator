-- Migration: add_nations
-- Adds the minimal world-scoped nations table used for settlement readiness
-- grouping.
-- ---------------------------------------------------------------------------
-- nations
-- ---------------------------------------------------------------------------
create table public.nations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nations_name_length_check check (char_length(btrim(name)) >= 1)
);

create index nations_world_id_idx on public.nations (world_id);

create trigger nations_set_updated_at before
update on public.nations for each row
execute function public.set_updated_at ();

alter table public.nations enable row level security;

create policy "nations_select_world_access" on public.nations for
select
  to authenticated using (public.has_world_access (world_id));

create policy "nations_insert_world_admin" on public.nations for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "nations_update_world_admin" on public.nations
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

create policy "nations_delete_world_admin" on public.nations for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);
