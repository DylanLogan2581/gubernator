-- Migration: add_partnerships
-- Adds the partnerships table covering the persistent record of romantic /
-- household partnerships between citizens. Rows are kept as history: when a
-- partnership ends, its row remains with a non-null ended_on_turn_number and a
-- terminal status ('dissolved' | 'widowed'). Active partnerships are unique per
-- citizen regardless of column order via a paired pair of partial unique
-- indexes on citizen_a_id and citizen_b_id.
--
-- Writes are admin-only in this epic; the simulation engine in Epic 6 will own
-- system-driven partnership formation/dissolution via a dedicated mutation
-- surface. Manual admin changes record the operator on changed_by_user_id with
-- a free-text change_reason; the paired turn log entry is written by the
-- partnerships data layer item, not this migration.
--
-- Read RLS mirrors citizens read visibility: a partnership is visible if
-- either participant citizen is visible. The `exists` subqueries against
-- public.citizens piggyback on the citizens select policy so visibility stays
-- in sync with any future expansion there.
-- ---------------------------------------------------------------------------
-- partnerships
-- ---------------------------------------------------------------------------
create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  citizen_a_id uuid not null references public.citizens (id) on delete restrict,
  citizen_b_id uuid not null references public.citizens (id) on delete restrict,
  status text not null default 'active',
  formed_on_turn_number integer not null,
  ended_on_turn_number integer,
  changed_by_user_id uuid references public.users (id) on delete restrict,
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnerships_status_check check (status in ('active', 'dissolved', 'widowed')),
  constraint partnerships_distinct_citizens_check check (citizen_a_id <> citizen_b_id),
  constraint partnerships_ended_on_turn_number_check check (
    (
      status = 'active'
      and ended_on_turn_number is null
    )
    or (
      status <> 'active'
      and ended_on_turn_number is not null
    )
  )
);

-- Find-partnerships-for-citizen queries hit either side, so index both.
create index partnerships_citizen_a_idx on public.partnerships (citizen_a_id);

create index partnerships_citizen_b_idx on public.partnerships (citizen_b_id);

-- Enforce "at most one active partnership per citizen" regardless of column
-- order via a paired pair of partial unique indexes. A new active row that
-- references an already-partnered citizen on either side will collide with one
-- of these indexes.
create unique index partnerships_unique_active_citizen_a_idx on public.partnerships (citizen_a_id)
where
  status = 'active';

create unique index partnerships_unique_active_citizen_b_idx on public.partnerships (citizen_b_id)
where
  status = 'active';

create trigger partnerships_set_updated_at before
update on public.partnerships for each row
execute function public.set_updated_at ();

alter table public.partnerships enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Read: visible if either participant citizen is visible. The `exists`
-- subqueries against public.citizens defer to the citizens select policy.
create policy "partnerships_select_visible" on public.partnerships for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.citizens c
      where
        c.id = partnerships.citizen_a_id
    )
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = partnerships.citizen_b_id
    )
  );

-- Writes: admin-only in this epic. Simulation-driven partnership writes ship
-- in Epic 6 via a dedicated SECURITY DEFINER mutation surface. Admin checks
-- require both participants to share a world that the caller administers; the
-- distinct-citizens check above plus the citizens.world_id foreign key make
-- this a single-world lookup in practice.
create policy "partnerships_insert_admin" on public.partnerships for insert to authenticated
with
  check (
    public.is_super_admin ()
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = partnerships.citizen_a_id
        and public.is_world_admin (c.world_id)
    )
  );

create policy "partnerships_update_admin" on public.partnerships
for update
  to authenticated using (
    public.is_super_admin ()
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = partnerships.citizen_a_id
        and public.is_world_admin (c.world_id)
    )
  )
with
  check (
    public.is_super_admin ()
    or exists (
      select
        1
      from
        public.citizens c
      where
        c.id = partnerships.citizen_a_id
        and public.is_world_admin (c.world_id)
    )
  );

create policy "partnerships_delete_admin" on public.partnerships for delete to authenticated using (
  public.is_super_admin ()
  or exists (
    select
      1
    from
      public.citizens c
    where
      c.id = partnerships.citizen_a_id
      and public.is_world_admin (c.world_id)
  )
);
