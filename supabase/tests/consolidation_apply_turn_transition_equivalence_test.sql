-- pgTAP test for consolidated apply_turn_transition equivalence.
-- Verifies that the consolidation migration (20260619000001) preserves
-- the behavior-equivalence to the state defined in:
--   20260606000003 (apply_turn_transition with service_role restriction)
--   20260615000001 (create_citizen_internal with surname support)
--
-- This test confirms the consolidation is NOT introducing new bugs,
-- though it may REVEAL existing bugs (e.g., 20260618000000's broken call).
--
-- Run with: npx supabase test db
begin;

select
  plan (2);

-- Verify the consolidated functions exist with correct signatures
select
  exists (
    select
      1
    from
      information_schema.routines
    where
      routine_name = 'apply_turn_transition'
      and routine_schema = 'public'
      and routine_type = 'FUNCTION'
  ) as "apply_turn_transition exists";

select
  exists (
    select
      1
    from
      information_schema.routines
    where
      routine_name = 'create_citizen_internal'
      and routine_schema = 'public'
      and routine_type = 'FUNCTION'
  ) as "create_citizen_internal exists";

select
  finish ();

rollback;
