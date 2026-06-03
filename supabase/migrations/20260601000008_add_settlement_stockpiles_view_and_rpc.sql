-- Migration: add_settlement_stockpiles_view_and_rpc
-- Adds a security-invoker view that surfaces per-settlement stockpile data
-- (including effective storage cap from active building effects), and a
-- SECURITY DEFINER RPC that lets world admins and super admins directly set
-- a stockpile quantity.
--
-- Error contract (set_settlement_stockpile_quantity):
--   P0002 (no_data_found)          – null params or settlement / resource not found
--   42501 (insufficient_privilege) – caller lacks super_admin / world_admin,
--                                    or resource belongs to a different world
--   P0001 (raise_exception)        – resource is trashed (soft-deleted)
-- ---------------------------------------------------------------------------
-- View: settlement_stockpiles_view
-- SECURITY INVOKER so the underlying settlement_resource_stockpiles RLS
-- remains in force — outsiders see zero rows even through the view.
-- ---------------------------------------------------------------------------
create view public.settlement_stockpiles_view
with
  (security_invoker = true) as
select
  srs.settlement_id,
  srs.resource_id,
  r.name as resource_name,
  r.is_system_resource,
  srs.quantity,
  r.base_stockpile_cap + coalesce(
    (
      select
        sum((e.entry ->> 'amount')::numeric)
      from
        public.settlement_buildings sb
        join public.building_blueprint_tiers t on t.id = sb.current_tier_id
        cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
      where
        sb.settlement_id = srs.settlement_id
        and sb.state = 'active'
        and (e.entry ->> 'type') = 'resource_storage_increase'
        and (e.entry ->> 'resource_id')::uuid = srs.resource_id
    ),
    0
  ) as effective_cap
from
  public.settlement_resource_stockpiles srs
  join public.resources r on r.id = srs.resource_id;

grant
select
  on public.settlement_stockpiles_view to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: set_settlement_stockpile_quantity
-- SECURITY DEFINER so the upsert path can bypass the RLS INSERT policy (the
-- seed triggers guarantee the row normally exists; this handles edge cases).
-- Callers are verified manually inside the function body.
--
-- Column-alias strategy: every query touching settlement_resource_stockpiles
-- uses the alias `srs` and fully-qualified `srs.column_name` references in
-- WHERE/RETURNING clauses to avoid 42702 (ambiguous column) — the function's
-- `returns table(settlement_id, resource_id, quantity)` clause introduces
-- PL/pgSQL variables with the same names as the table columns.
--
-- ON CONFLICT resolution: uses the constraint name rather than the bare column
-- list `(settlement_id, resource_id)`, which would also be ambiguous.
-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_stockpile_quantity (
  p_settlement_id uuid,
  p_resource_id uuid,
  p_quantity numeric
) returns table (
  settlement_id uuid,
  resource_id uuid,
  quantity numeric
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id          uuid;
  v_resource_world_id uuid;
  v_is_trashed        boolean;
  v_row               public.settlement_resource_stockpiles%rowtype;
begin
  -- Null guard
  if p_settlement_id is null or p_resource_id is null or p_quantity is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve the settlement's world via the nation chain.
  select n.world_id
  into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: only super admins and world admins may set stockpile quantities.
  -- Nation Managers and Settlement Managers are explicitly rejected.
  if not (public.is_super_admin() or public.is_world_admin(v_world_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate resource: must exist, belong to the same world, and not be trashed.
  select r.world_id, r.is_trashed
  into v_resource_world_id, v_is_trashed
  from public.resources r
  where r.id = p_resource_id;

  if v_resource_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_resource_world_id <> v_world_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_is_trashed then
    raise exception 'resource is trashed' using errcode = 'P0001';
  end if;

  -- Attempt to lock the existing row. Alias required to avoid 42702.
  select srs.*
  into v_row
  from public.settlement_resource_stockpiles srs
  where
    srs.settlement_id = p_settlement_id
    and srs.resource_id = p_resource_id
  for update;

  if v_row.id is null then
    -- Row missing — upsert defensively. Uses ON CONFLICT ON CONSTRAINT (not
    -- bare column list) to avoid 42702 ambiguity with the output column names.
    insert into
      public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values
      (p_settlement_id, p_resource_id, p_quantity)
    on conflict on constraint settlement_resource_stockpiles_settlement_resource_unique do update
    set
      quantity = excluded.quantity
    returning
      *
    into
      v_row;
  else
    update public.settlement_resource_stockpiles srs
    set
      quantity = p_quantity
    where
      srs.settlement_id = p_settlement_id
      and srs.resource_id = p_resource_id
    returning
      srs.*
    into
      v_row;
  end if;

  return query
  select
    v_row.settlement_id,
    v_row.resource_id,
    v_row.quantity;
end;
$$;

revoke all on function public.set_settlement_stockpile_quantity (uuid, uuid, numeric)
from
  public;

grant
execute on function public.set_settlement_stockpile_quantity (uuid, uuid, numeric) to authenticated;
