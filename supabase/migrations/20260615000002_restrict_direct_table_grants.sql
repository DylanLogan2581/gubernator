-- Migration: restrict_direct_table_grants
-- Tightens column/table grants that drifted after later schema refactors.
-- death_cause_category is written by simulation/admin RPC paths only.
revoke insert,
update on public.citizens
from
  anon;

revoke insert (death_cause_category),
update (death_cause_category) on public.citizens
from
  authenticated;

-- trade_route_legs is readable through RLS, but quantity/resource edits go
-- through SECURITY DEFINER trade-route RPCs so route replacement remains atomic.
revoke all privileges on public.trade_route_legs
from
  anon,
  authenticated;

grant
select
  on public.trade_route_legs to authenticated;
