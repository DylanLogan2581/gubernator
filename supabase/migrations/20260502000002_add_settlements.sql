-- Migration: add_settlements
-- Adds the minimal nation-scoped settlements table with current-turn
-- readiness state stored directly on the settlement row.
-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references public.nations (id) on delete cascade,
  name text not null,
  description text,
  coord_x numeric(18, 4),
  coord_z numeric(18, 4),
  auto_ready_enabled boolean not null default false,
  is_ready_current_turn boolean not null default false,
  ready_set_at timestamptz,
  ready_set_by_citizen_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_name_length_check check (char_length(btrim(name)) >= 1)
);

comment on column public.settlements.ready_set_by_citizen_id is 'Nullable placeholder for the future citizens table; intentionally not yet constrained by a foreign key.';

create index settlements_nation_id_idx on public.settlements (nation_id);

create trigger settlements_set_updated_at before
update on public.settlements for each row
execute function public.set_updated_at ();

alter table public.settlements enable row level security;

create policy "settlements_select_world_access" on public.settlements for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = settlements.nation_id
        and public.has_world_access (n.world_id)
    )
  );

create policy "settlements_insert_world_admin" on public.settlements for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = settlements.nation_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

create policy "settlements_update_world_admin" on public.settlements
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = settlements.nation_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  )
with
  check (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = settlements.nation_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

create policy "settlements_delete_world_admin" on public.settlements for delete to authenticated using (
  exists (
    select
      1
    from
      public.nations n
    where
      n.id = settlements.nation_id
      and (
        public.is_world_admin (n.world_id)
        or public.is_super_admin ()
      )
  )
);
