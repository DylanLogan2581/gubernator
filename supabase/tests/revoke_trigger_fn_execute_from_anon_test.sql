-- pgTAP test: explicit per-function EXECUTE-revocation inventory for
-- 20260803000000_revoke_trigger_fn_execute_from_anon.sql (issue #973).
--
-- rpc_execute_hygiene_test.sql already guards this dynamically (by pg_trigger
-- membership / internal_* naming pattern), which also covers functions added
-- after this migration. This file complements that by pinning the exact 35
-- functions (22 trigger + 13 internal helper) this migration revoked EXECUTE
-- from, by name, so a regression that re-grants EXECUTE to anon on one of
-- these specific functions -- or renames/drops one -- fails loudly and
-- points at the exact function, not just "some trigger function regressed".
--
-- The ::regprocedure casts below also double as an existence check: a
-- dropped or renamed function fails the cast before the privilege check
-- even runs.
--
-- Run with: npx supabase test db
begin;

select
  plan (35);

-- ---------------------------------------------------------------------------
-- Trigger functions (22): called by the DB engine via triggers, not by
-- client code.
-- ---------------------------------------------------------------------------
select
  is (
    has_function_privilege(
      'anon',
      'public.auto_exhaust_deposit_at_zero_resources ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'auto_exhaust_deposit_at_zero_resources EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_citizen_assignment_trade_route_end ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_citizen_assignment_trade_route_end EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_construction_project_max_instances ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_construction_project_max_instances EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_construction_project_tier_match ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_construction_project_tier_match EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_deposit_instance_resource_not_trashed ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_deposit_instance_resource_not_trashed EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_deposit_instance_resource_same_world ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_deposit_instance_resource_same_world EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_managed_population_instance_same_world ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_managed_population_instance_same_world EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_settlement_building_tier_match ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_settlement_building_tier_match EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_trade_route_leg_resource_same_world ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_trade_route_leg_resource_same_world EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.check_trade_routes_same_world ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'check_trade_routes_same_world EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.citizens_clear_active_player_character ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'citizens_clear_active_player_character EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.handle_auth_user_email_update ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'handle_auth_user_email_update EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.handle_new_auth_user ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'handle_new_auth_user EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.mirror_bilateral_nation_relationship_stance ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'mirror_bilateral_nation_relationship_stance EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.seed_settlement_stockpiles_on_settlement_insert ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'seed_settlement_stockpiles_on_settlement_insert EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.seed_stockpiles_on_resource_insert ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'seed_stockpiles_on_resource_insert EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.seed_world_system_resources ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'seed_world_system_resources EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.set_nation_relationship_world_id ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'set_nation_relationship_world_id EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.user_active_player_characters_validate ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'user_active_player_characters_validate EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.validate_notification_scope ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'validate_notification_scope EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.validate_turn_log_entry_scope ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'validate_turn_log_entry_scope EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.worlds_insert_creator_as_admin ()'::regprocedure,
      'EXECUTE'
    ),
    false,
    'worlds_insert_creator_as_admin EXECUTE revoked from anon'
  );

-- ---------------------------------------------------------------------------
-- Internal helper functions (13): called only by other SECURITY DEFINER
-- functions, never directly by client code.
-- ---------------------------------------------------------------------------
select
  is (
    has_function_privilege(
      'anon',
      'public.create_citizen_internal ( uuid, uuid, text, text, text, text, uuid, integer, uuid, uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid )'::regprocedure,
      'EXECUTE'
    ),
    false,
    'create_citizen_internal EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.end_partnership_internal (uuid, text, integer, text, uuid, text)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'end_partnership_internal EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.settlement_alive_citizen_count_internal (uuid)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'settlement_alive_citizen_count_internal EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.settlement_effective_storage_cap_internal (uuid, uuid)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'settlement_effective_storage_cap_internal EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_advance_world_turn (uuid, integer)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_advance_world_turn EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_citizen_partnership_patches (uuid, uuid, jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_citizen_partnership_patches EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_construction_patches (uuid, integer, jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_construction_patches EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_deposit_managed_pop_patches (jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_deposit_managed_pop_patches EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_event_patches EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_log_entries_and_notifications EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_settlement_snapshots (uuid, uuid, jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_settlement_snapshots EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_stockpile_deltas EXECUTE revoked from anon'
  );

select
  is (
    has_function_privilege(
      'anon',
      'public.internal_apply_turn_transition_trade_route_patches (jsonb)'::regprocedure,
      'EXECUTE'
    ),
    false,
    'internal_apply_turn_transition_trade_route_patches EXECUTE revoked from anon'
  );

select
  finish ();

rollback;
