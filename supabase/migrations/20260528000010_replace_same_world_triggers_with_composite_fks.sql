-- Migration: replace_same_world_triggers_with_composite_fks
-- Replaces the trigger-based same-world invariants on nation_relationships and
-- citizens with declarative composite foreign keys. Triggers can be bypassed
-- (admin-level trigger disabling, future SECURITY DEFINER paths) and carry a
-- theoretical race window under READ COMMITTED; composite FKs are enforced by
-- the storage engine unconditionally.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- UNIQUE (id, world_id) on nations and citizens
-- Each id is already the primary key so these are no-ops for existing data,
-- but they create the composite indexes required as FK targets.
-- ---------------------------------------------------------------------------
alter table public.nations
add constraint nations_id_world_id_unique unique (id, world_id);

alter table public.citizens
add constraint citizens_id_world_id_unique unique (id, world_id);

-- ---------------------------------------------------------------------------
-- Add world_id to nation_relationships
-- Backfill from from_nation_id before tightening the column so the NOT NULL
-- constraint is immediately satisfiable for existing rows.
-- ---------------------------------------------------------------------------
alter table public.nation_relationships
add column world_id uuid;

update public.nation_relationships nr
set
  world_id = n.world_id
from
  public.nations n
where
  n.id = nr.from_nation_id;

alter table public.nation_relationships
alter column world_id
set not null;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT trigger: auto-derive world_id from from_nation_id so existing
-- callers (client upserts, bilateral mirror trigger) do not need to supply it.
-- The composite FKs below enforce correctness declaratively once the column is
-- populated.
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_relationship_world_id () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.world_id is null then
    select
      n.world_id into new.world_id
    from
      public.nations n
    where
      n.id = new.from_nation_id;
  end if;

  return new;
end;
$$;

revoke all on function public.set_nation_relationship_world_id ()
from
  public;

create trigger nation_relationships_set_world_id before insert on public.nation_relationships for each row
execute function public.set_nation_relationship_world_id ();

-- ---------------------------------------------------------------------------
-- Composite FKs: nation_relationships
-- Both (from_nation_id, world_id) and (to_nation_id, world_id) must reference
-- a row in nations(id, world_id). Since a nation belongs to exactly one world,
-- the two FKs together guarantee both nations share the same world.
-- ---------------------------------------------------------------------------
alter table public.nation_relationships
add constraint nation_relationships_from_nation_world_fkey foreign key (from_nation_id, world_id) references public.nations (id, world_id);

alter table public.nation_relationships
add constraint nation_relationships_to_nation_world_fkey foreign key (to_nation_id, world_id) references public.nations (id, world_id);

-- ---------------------------------------------------------------------------
-- Composite FKs: citizens
-- (parent_a_citizen_id, world_id) and (parent_b_citizen_id, world_id) must
-- each reference a row in citizens(id, world_id). FK checks are skipped when
-- the parent column is NULL (standard SQL), so nullable parents are unaffected.
-- ---------------------------------------------------------------------------
alter table public.citizens
add constraint citizens_parent_a_world_fkey foreign key (parent_a_citizen_id, world_id) references public.citizens (id, world_id);

alter table public.citizens
add constraint citizens_parent_b_world_fkey foreign key (parent_b_citizen_id, world_id) references public.citizens (id, world_id);

-- ---------------------------------------------------------------------------
-- Drop the now-redundant trigger-based invariant checks.
-- ---------------------------------------------------------------------------
drop trigger nation_relationships_same_world_check on public.nation_relationships;

drop function public.check_nation_relationships_same_world ();

drop trigger citizens_same_world_parents_check on public.citizens;

drop function public.check_citizens_same_world_parents ();
