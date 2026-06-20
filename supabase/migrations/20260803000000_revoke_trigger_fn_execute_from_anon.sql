-- Migration: revoke_trigger_fn_execute_from_anon
-- Revokes EXECUTE on trigger functions and internal helper functions from
-- PUBLIC and anon.
--
-- Gap found in RLS audit (issue #796): Supabase's default
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated
-- grant also applies to trigger functions and private helper functions that
-- should never be callable directly by client roles.
--
-- Trigger functions return the `trigger` pseudo-type and are called by the
-- database engine, not via PostgREST. Internal helpers are called only by
-- other SECURITY DEFINER functions. Neither category needs client-callable
-- EXECUTE grants.
--
-- Client-facing RPCs retain their grants unchanged.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Trigger functions (22): called by the DB engine via triggers, not by
-- client code.
-- ---------------------------------------------------------------------------
revoke
execute on function public.auto_exhaust_deposit_at_zero_resources ()
from
  public,
  anon;

revoke
execute on function public.check_citizen_assignment_trade_route_end ()
from
  public,
  anon;

revoke
execute on function public.check_construction_project_max_instances ()
from
  public,
  anon;

revoke
execute on function public.check_construction_project_tier_match ()
from
  public,
  anon;

revoke
execute on function public.check_deposit_instance_resource_not_trashed ()
from
  public,
  anon;

revoke
execute on function public.check_deposit_instance_resource_same_world ()
from
  public,
  anon;

revoke
execute on function public.check_managed_population_instance_same_world ()
from
  public,
  anon;

revoke
execute on function public.check_settlement_building_tier_match ()
from
  public,
  anon;

revoke
execute on function public.check_trade_route_leg_resource_same_world ()
from
  public,
  anon;

revoke
execute on function public.check_trade_routes_same_world ()
from
  public,
  anon;

revoke
execute on function public.citizens_clear_active_player_character ()
from
  public,
  anon;

revoke
execute on function public.handle_auth_user_email_update ()
from
  public,
  anon;

revoke
execute on function public.handle_new_auth_user ()
from
  public,
  anon;

revoke
execute on function public.mirror_bilateral_nation_relationship_stance ()
from
  public,
  anon;

revoke
execute on function public.seed_settlement_stockpiles_on_settlement_insert ()
from
  public,
  anon;

revoke
execute on function public.seed_stockpiles_on_resource_insert ()
from
  public,
  anon;

revoke
execute on function public.seed_world_system_resources ()
from
  public,
  anon;

revoke
execute on function public.set_nation_relationship_world_id ()
from
  public,
  anon;

revoke
execute on function public.user_active_player_characters_validate ()
from
  public,
  anon;

revoke
execute on function public.validate_notification_scope ()
from
  public,
  anon;

revoke
execute on function public.validate_turn_log_entry_scope ()
from
  public,
  anon;

revoke
execute on function public.worlds_insert_creator_as_admin ()
from
  public,
  anon;

-- ---------------------------------------------------------------------------
-- Internal helper functions: called only by other SECURITY DEFINER
-- functions, never directly by client code.
-- ---------------------------------------------------------------------------
-- create_citizen_internal: private factory called by create_npc, create_player_character
revoke
execute on function public.create_citizen_internal (
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
from
  public,
  anon;

-- end_partnership_internal: called by apply_turn_transition citizen patches
revoke
execute on function public.end_partnership_internal (uuid, text, integer, text, uuid, text)
from
  public,
  anon;

-- settlement computation internals
revoke
execute on function public.settlement_alive_citizen_count_internal (uuid)
from
  public,
  anon;

revoke
execute on function public.settlement_effective_storage_cap_internal (uuid, uuid)
from
  public,
  anon;

-- apply_turn_transition sub-phase helpers
revoke
execute on function public.internal_apply_turn_transition_advance_world_turn (uuid, integer)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_citizen_partnership_patches (uuid, uuid, jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_construction_patches (uuid, integer, jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_deposit_managed_pop_patches (jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_settlement_snapshots (uuid, uuid, jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  public,
  anon;

revoke
execute on function public.internal_apply_turn_transition_trade_route_patches (jsonb)
from
  public,
  anon;
