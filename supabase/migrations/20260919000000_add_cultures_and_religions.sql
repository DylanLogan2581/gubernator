-- Migration: add_cultures_and_religions
-- Epic 11 (#1096): world-admin-authored culture and religion registries.
-- Record-keeping only in v1 -- carried by nations (primary_culture_id /
-- state_religion_id, display-only) and, in a follow-up issue, by citizens.
-- No simulation effects yet.
-- ---------------------------------------------------------------------------
-- cultures
-- ---------------------------------------------------------------------------
create table public.cultures (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cultures_world_name_unique unique (world_id, name),
  constraint cultures_name_length_check check (char_length(btrim(name)) >= 1),
  constraint cultures_name_max_length_check check (char_length(name) <= 64),
  constraint cultures_description_max_length_check check (
    description is null
    or char_length(description) <= 1000
  ),
  constraint cultures_color_format_check check (color ~* '^#[0-9a-f]{6}$')
);

create index cultures_world_id_idx on public.cultures (world_id);

create trigger cultures_set_updated_at before
update on public.cultures for each row
execute function public.set_updated_at ();

alter table public.cultures enable row level security;

create policy "cultures_select_world_access" on public.cultures for
select
  to authenticated using (public.has_world_access (world_id));

create policy "cultures_insert_world_admin" on public.cultures for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "cultures_update_world_admin" on public.cultures
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

create policy "cultures_delete_world_admin" on public.cultures for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- religions
-- ---------------------------------------------------------------------------
create table public.religions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint religions_world_name_unique unique (world_id, name),
  constraint religions_name_length_check check (char_length(btrim(name)) >= 1),
  constraint religions_name_max_length_check check (char_length(name) <= 64),
  constraint religions_description_max_length_check check (
    description is null
    or char_length(description) <= 1000
  ),
  constraint religions_color_format_check check (color ~* '^#[0-9a-f]{6}$')
);

create index religions_world_id_idx on public.religions (world_id);

create trigger religions_set_updated_at before
update on public.religions for each row
execute function public.set_updated_at ();

alter table public.religions enable row level security;

create policy "religions_select_world_access" on public.religions for
select
  to authenticated using (public.has_world_access (world_id));

create policy "religions_insert_world_admin" on public.religions for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "religions_update_world_admin" on public.religions
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

create policy "religions_delete_world_admin" on public.religions for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- nations: primary_culture_id / state_religion_id
-- Display-only in v1. Nullable, ON DELETE SET NULL so removing a culture/
-- religion from the registry never blocks the delete (nations quietly
-- revert to "unset" -- same semantics as the citizen FK planned for the
-- follow-up issue).
-- ---------------------------------------------------------------------------
alter table public.nations
add column primary_culture_id uuid references public.cultures (id) on delete set null,
add column state_religion_id uuid references public.religions (id) on delete set null;

create index nations_primary_culture_id_idx on public.nations (primary_culture_id);

create index nations_state_religion_id_idx on public.nations (state_religion_id);

-- ---------------------------------------------------------------------------
-- set_nation_culture_religion: writes primary_culture_id / state_religion_id.
-- Mirrors set_nation_trade_policy (20260912000000) -- the nations UPDATE
-- policy (nations_update_world_admin) restricts direct table writes to
-- world admins/super admins only, so a SECURITY DEFINER RPC gated by
-- current_user_manages_nation (super admin, world admin, or nation manager)
-- is required to let nation managers edit these columns too. Archived
-- worlds are read-only. Pass null to clear a field; both params are always
-- applied (callers pass the existing value for the field they don't want to
-- change).
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_culture_religion (
  p_nation_id uuid,
  p_primary_culture_id uuid,
  p_state_religion_id uuid
) returns setof public.nations language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_nation_id is null then
    return;
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    return;
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_primary_culture_id is not null and not exists (
    select 1 from public.cultures
    where id = p_primary_culture_id
      and world_id = v_world_id
  ) then
    raise exception 'Culture does not belong to this nation''s world.'
      using errcode = 'P0001';
  end if;

  if p_state_religion_id is not null and not exists (
    select 1 from public.religions
    where id = p_state_religion_id
      and world_id = v_world_id
  ) then
    raise exception 'Religion does not belong to this nation''s world.'
      using errcode = 'P0001';
  end if;

  return query
  update public.nations
  set
    primary_culture_id = p_primary_culture_id,
    state_religion_id = p_state_religion_id
  where id = p_nation_id
  returning *;
end;
$$;

revoke all on function public.set_nation_culture_religion (uuid, uuid, uuid)
from
  public;

grant
execute on function public.set_nation_culture_religion (uuid, uuid, uuid) to authenticated;
