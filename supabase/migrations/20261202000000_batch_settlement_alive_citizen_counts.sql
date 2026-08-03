-- Migration: batch_settlement_alive_citizen_counts
-- Fixes #1302: getNationSettlements issued one settlement_alive_citizen_count
-- RPC per settlement via Promise.all, multiplying round-trips on every load
-- of the nation Settlements tab. Adds a batched RPC that returns counts for
-- an array of settlements in a single round-trip.
-- ---------------------------------------------------------------------------
-- Function: settlement_alive_citizen_counts_batch
-- Returns: one row per requested settlement id with its alive-citizen count
-- (0 for settlements with no alive citizens or unknown ids).
-- Auth: requires world access to every world touched by the given
-- settlement ids, same guard as settlement_alive_citizen_count.
-- ---------------------------------------------------------------------------
create or replace function public.settlement_alive_citizen_counts_batch (p_settlement_ids uuid[]) returns table (settlement_id uuid, alive_citizen_count integer) language plpgsql stable security definer
set
  search_path = '' as $$
begin
  if exists (
    select 1
    from public.settlements s
    join public.nations n on n.id = s.nation_id
    where s.id = any (p_settlement_ids)
      and not public.current_user_has_world_access(n.world_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    ids.id as settlement_id,
    coalesce(count(c.id), 0)::integer as alive_citizen_count
  from unnest(p_settlement_ids) as ids (id)
  left join public.citizens c
    on c.settlement_id = ids.id
    and c.status = 'alive'
  group by ids.id;
end;
$$;

revoke all on function public.settlement_alive_citizen_counts_batch (uuid[])
from
  public;

grant
execute on function public.settlement_alive_citizen_counts_batch (uuid[]) to authenticated;
