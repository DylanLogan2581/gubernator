-- Migration: add_trade_routes_same_world_guard
-- Fixes issue #675: Direct INSERT to trade_routes was possible with cross-world
-- origin/destination, bypassing the same-world check in propose_trade_route RPC.
--
-- Solution: BEFORE INSERT/UPDATE trigger validates that origin_settlement_id and
-- destination_settlement_id belong to the same world. This prevents direct INSERT
-- with cross-world endpoints while allowing same-world routes via table and RPC.
--
-- Error: foreign_key_violation (per issue acceptance criteria).
-- ---------------------------------------------------------------------------
-- Trigger: origin and destination settlements must belong to the same world
-- ---------------------------------------------------------------------------
create or replace function public.check_trade_routes_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_origin_world_id      uuid;
  v_destination_world_id uuid;
begin
  -- Resolve origin settlement → nation → world
  select n.world_id into v_origin_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.origin_settlement_id;

  -- Resolve destination settlement → nation → world
  select n.world_id into v_destination_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = new.destination_settlement_id;

  -- Both must belong to the same world
  if v_origin_world_id is distinct from v_destination_world_id then
    raise exception
      'origin settlement % and destination settlement % must belong to the same world',
      new.origin_settlement_id, new.destination_settlement_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.check_trade_routes_same_world ()
from
  public;

-- Add trigger to enforce same-world constraint on INSERT and UPDATE
create trigger trade_routes_same_world before insert
or
update on public.trade_routes for each row
execute function public.check_trade_routes_same_world ();

-- Verify trigger was created (helps with debugging if it fails)
do $$
declare
  v_trigger_count integer;
begin
  select count(*) into v_trigger_count
  from information_schema.triggers
  where trigger_name = 'trade_routes_same_world'
    and event_object_table = 'trade_routes';

  if v_trigger_count = 0 then
    raise warning 'WARNING: trade_routes_same_world trigger was not created';
  end if;
end;
$$;
