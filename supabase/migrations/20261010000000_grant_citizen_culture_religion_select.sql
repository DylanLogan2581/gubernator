-- Migration: grant_citizen_culture_religion_select
-- #1125: citizens' column-level SELECT grant to authenticated is an explicit
-- column list (20260611000003_restrict_citizen_npc_visibility) that does not
-- extend to new columns automatically -- culture_id/religion_id
-- (20260920000000_add_citizen_culture_religion) were never added to it, so
-- every citizens read selecting either column fails with
-- "permission denied for table citizens" (42501) for every role, including
-- super admin, since the revoke/grant pair predates and gates RLS.
grant
select
  (culture_id, religion_id) on public.citizens to authenticated;
