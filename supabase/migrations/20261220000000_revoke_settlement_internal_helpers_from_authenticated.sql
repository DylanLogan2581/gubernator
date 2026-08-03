-- Migration: revoke_settlement_internal_helpers_from_authenticated
-- #1394: settlement_effective_storage_cap_internal and
-- settlement_alive_citizen_count_internal are SECURITY DEFINER with no access
-- check at all. 20260604000002 intended them to be private ("intentionally no
-- grant to authenticated -- internal use only") but only revoked them from
-- public, which does not remove the direct grant Supabase default privileges
-- had already handed to authenticated. 20260803000000 revoked from public and
-- anon, still leaving authenticated. Any signed-in user could therefore read
-- the effective storage cap / alive citizen count of any settlement in any
-- world, including worlds they have no role in.
--
-- Both helpers are only ever called from SECURITY DEFINER functions owned by
-- postgres (apply_turn_transition and its sub-phase helpers, the gated
-- settlement_effective_storage_cap / settlement_alive_citizen_count
-- wrappers), which run as the owner and so do not need the grant.
-- settlement_stockpiles_view is security_invoker but calls the *gated*
-- wrapper, not the internal, so it is unaffected.
-- ---------------------------------------------------------------------------
revoke
execute on function public.settlement_effective_storage_cap_internal (uuid, uuid)
from
  authenticated;

revoke
execute on function public.settlement_alive_citizen_count_internal (uuid)
from
  authenticated;
