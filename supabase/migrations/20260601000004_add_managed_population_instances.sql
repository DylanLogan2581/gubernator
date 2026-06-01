-- Migration: add_managed_population_instances
-- Creates public.managed_population_instances per schema §7 / spec §10.
-- Each settlement hosts herd/flock instances with current count, configured
-- cull quantity, and active/extinct status.
-- ---------------------------------------------------------------------------
-- managed_population_instances
-- ---------------------------------------------------------------------------
create table public.managed_population_instances (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  managed_population_type_id uuid not null references public.managed_population_types (id) on delete restrict,
  name text not null,
  current_count numeric(18, 4) not null,
  configured_cull_quantity numeric(18, 4) not null default 0,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managed_population_instances_status_check check (status in ('active', 'extinct')),
  constraint managed_population_instances_current_count_non_negative check (current_count >= 0),
  constraint managed_population_instances_cull_quantity_non_negative check (configured_cull_quantity >= 0),
  -- Planning-time invariant: configured_cull_quantity may not exceed current_count.
  -- Epic 6 simulation transitions may transiently exceed this cap mid-processing;
  -- Epic 6 must relax or bypass this check during turn resolution if needed.
  constraint managed_population_instances_cull_le_count check (configured_cull_quantity <= current_count),
  constraint managed_population_instances_name_length_check check (char_length(btrim(name)) >= 1)
);

create index managed_population_instances_settlement_status_idx on public.managed_population_instances (settlement_id, status);

create index managed_population_instances_type_id_idx on public.managed_population_instances (managed_population_type_id);

create trigger managed_population_instances_set_updated_at before
update on public.managed_population_instances for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Trigger: managed_population_type_id must belong to the same world as the
-- settlement (reachable via settlement → nation → world). Enforced as a BEFORE
-- trigger because the world link requires a 3-level join and cannot be
-- expressed as a simple FK.
-- ---------------------------------------------------------------------------
create or replace function public.check_managed_population_instance_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_world_id uuid;
  v_type_world_id       uuid;
begin
  select n.world_id into v_settlement_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.settlement_id;

  select mpt.world_id into v_type_world_id
  from public.managed_population_types mpt
  where mpt.id = new.managed_population_type_id;

  if v_settlement_world_id is distinct from v_type_world_id then
    raise exception 'managed_population_type % belongs to world % but settlement belongs to world %',
      new.managed_population_type_id, v_type_world_id, v_settlement_world_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.check_managed_population_instance_same_world ()
from
  public;

create trigger managed_population_instances_same_world before insert
or
update of managed_population_type_id,
settlement_id on public.managed_population_instances for each row
execute function public.check_managed_population_instance_same_world ();

alter table public.managed_population_instances enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: managed_population_instances
-- ---------------------------------------------------------------------------
-- SELECT: world access via settlement → nation → world chain (includes
-- the player-character path via current_user_has_world_access).
create policy "managed_population_instances_select_world_access" on public.managed_population_instances for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = managed_population_instances.settlement_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- INSERT (admin path): world admin or super admin may insert with any status,
-- including 'extinct'. Multiple permissive INSERT policies are OR-combined by
-- Postgres, so an admin who also satisfies the manager policy is unaffected by
-- the manager status restriction below.
create policy "managed_population_instances_insert_admin" on public.managed_population_instances for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = managed_population_instances.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- INSERT (manager path): nation manager or settlement manager of the parent
-- settlement may add instances, but only with status='active'. Managers cannot
-- directly set 'extinct' — that transition is reserved for Epic 6 simulation
-- (Card 18). current_user_manages_settlement includes super admin and world
-- admin, so the status='active' restriction is the only additional constraint;
-- admins who need to insert with 'extinct' use the admin policy above.
create policy "managed_population_instances_insert_manager" on public.managed_population_instances for insert to authenticated
with
  check (
    public.current_user_manages_settlement (settlement_id)
    and status = 'active'
  );

-- UPDATE (admin path): world admin or super admin may update to any status.
create policy "managed_population_instances_update_admin" on public.managed_population_instances
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = managed_population_instances.settlement_id
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
        public.settlements s
        join public.nations n on n.id = s.nation_id
      where
        s.id = managed_population_instances.settlement_id
        and (
          public.is_world_admin (n.world_id)
          or public.is_super_admin ()
        )
    )
  );

-- UPDATE (manager path): nation/settlement managers may update rows they can
-- access, but the new status must remain 'active'. This blocks managers from
-- directly marking a population extinct; admins bypass via the policy above.
create policy "managed_population_instances_update_manager" on public.managed_population_instances
for update
  to authenticated using (
    public.current_user_manages_settlement (settlement_id)
  )
with
  check (
    public.current_user_manages_settlement (settlement_id)
    and status = 'active'
  );

-- DELETE: any user who manages the settlement (includes world admin / super
-- admin via current_user_manages_settlement).
create policy "managed_population_instances_delete_manager" on public.managed_population_instances for delete to authenticated using (
  public.current_user_manages_settlement (settlement_id)
);
