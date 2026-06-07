-- Migration: revoke_citizen_role_direct_updates
-- Restores original citizens table API boundary: role scope columns remain
-- writable only through dedicated privileged mutations, not direct table UPDATEs.
revoke
update (role_type, role_nation_id, role_settlement_id) on public.citizens
from
  authenticated;
