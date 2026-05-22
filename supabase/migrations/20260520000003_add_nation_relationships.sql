-- Migration: add_nation_relationships
-- Adds the directional nation_relationships table. Each row stores one
-- nation's current stance toward another, plus an optional pending proposal
-- recorded on the row owned by the nation that needs to confirm. Unilateral
-- stances (neutral, friendly, hostile, at_war) write only to the row owned by
-- the originating nation; allied and non_aggression_pact require both sides
-- and use the pending_* columns to track the proposal lifecycle.
--
-- Read visibility chains through public.nations via `exists` subqueries so
-- whatever rules apply to nations (including any future hidden-flag filter)
-- automatically govern relationship visibility. Writes are limited to world
-- admins of the from_nation's world and the Nation Manager whose active
-- player character governs the from_nation; the WITH CHECK on update applies
-- the same rule to the new from_nation_id so rows cannot be moved between
-- nations.
-- ---------------------------------------------------------------------------
-- nation_relationships
-- ---------------------------------------------------------------------------
create table public.nation_relationships (
  id uuid primary key default gen_random_uuid(),
  from_nation_id uuid not null references public.nations (id) on delete cascade,
  to_nation_id uuid not null references public.nations (id) on delete cascade,
  current_stance text not null default 'neutral',
  pending_stance text,
  pending_status text,
  pending_changed_by_citizen_id uuid references public.citizens (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nation_relationships_distinct_nations_check check (from_nation_id <> to_nation_id),
  constraint nation_relationships_current_stance_check check (
    current_stance in (
      'neutral',
      'friendly',
      'allied',
      'hostile',
      'at_war',
      'non_aggression_pact'
    )
  ),
  constraint nation_relationships_pending_stance_check check (
    pending_stance is null
    or pending_stance in ('allied', 'non_aggression_pact')
  ),
  constraint nation_relationships_pending_status_check check (
    pending_status is null
    or pending_status in ('proposed', 'accepted', 'declined', 'withdrawn')
  ),
  constraint nation_relationships_unique_ordered_pair unique (from_nation_id, to_nation_id)
);

create index nation_relationships_from_nation_idx on public.nation_relationships (from_nation_id);

create index nation_relationships_to_nation_idx on public.nation_relationships (to_nation_id);

create trigger nation_relationships_set_updated_at before
update on public.nation_relationships for each row
execute function public.set_updated_at ();

alter table public.nation_relationships enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Read: visible if either participant nation is visible to the caller. The
-- `exists` subqueries piggyback on the nations select policy so any future
-- visibility tightening on nations (e.g. enforcing is_hidden) automatically
-- governs nation_relationships visibility too.
create policy "nation_relationships_select_visible" on public.nation_relationships for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_relationships.from_nation_id
    )
    or exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_relationships.to_nation_id
    )
  );

-- Writes: super admins, world admins of the from_nation's world, and the
-- Nation Manager whose active player character governs from_nation. The
-- WITH CHECK on update applies the same rule to the proposed row so a writer
-- cannot reassign a relationship to a nation they do not manage.
create policy "nation_relationships_insert_admin_or_manager" on public.nation_relationships for insert to authenticated
with
  check (
    public.is_super_admin ()
    or public.is_nation_manager_of (from_nation_id)
    or exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_relationships.from_nation_id
        and public.is_world_admin (n.world_id)
    )
  );

create policy "nation_relationships_update_admin_or_manager" on public.nation_relationships
for update
  to authenticated using (
    public.is_super_admin ()
    or public.is_nation_manager_of (from_nation_id)
    or exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_relationships.from_nation_id
        and public.is_world_admin (n.world_id)
    )
  )
with
  check (
    public.is_super_admin ()
    or public.is_nation_manager_of (from_nation_id)
    or exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_relationships.from_nation_id
        and public.is_world_admin (n.world_id)
    )
  );

create policy "nation_relationships_delete_admin_or_manager" on public.nation_relationships for delete to authenticated using (
  public.is_super_admin ()
  or public.is_nation_manager_of (from_nation_id)
  or exists (
    select
      1
    from
      public.nations n
    where
      n.id = nation_relationships.from_nation_id
      and public.is_world_admin (n.world_id)
  )
);
