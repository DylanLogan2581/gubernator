-- Turn-guard table classification.
--
-- Single source of truth for which tables reject writes while a world has a
-- running turn transition. Kept as a function rather than a table so it needs
-- no RLS policy and cannot be edited at runtime.
--
-- Buckets:
--   guarded      - world-scoped state the simulation reads or writes. Includes
--                  world-admin configuration tables: a blueprint edited mid-run
--                  applies to an already-loaded turn just as ambiguously as a
--                  job reassignment.
--   turn_output  - written only by the turn itself.
--   out_of_scope - auth, infrastructure, per-user preferences. The simulation
--                  never reads these.
--
-- turn_guard_table_classification_test.sql asserts these buckets partition
-- public's base tables exactly. Adding a table without classifying it fails
-- that test. That is deliberate.
create or replace function public.internal_turn_guard_classification () returns table (
  table_name text,
  bucket text,
  key_column text,
  resolver_sql text
) language sql immutable
set
  search_path = '' as $$
  with direct as (
    -- Tables carrying world_id themselves.
    select unnest(array[
      'armies', 'building_blueprints', 'citizen_memories', 'citizens',
      'cultures', 'decrees', 'deposit_type_jobs', 'deposit_types',
      'education_enrollments', 'education_levels', 'event_groups', 'events',
      'government_bodies', 'job_definitions', 'law_documents',
      'managed_population_culling_jobs', 'managed_population_husbandry_jobs',
      'managed_population_types', 'namesets', 'nation_currencies',
      'nation_discoveries', 'nation_offices', 'nation_relationships',
      'nation_treaties', 'nation_turn_readiness', 'nations', 'office_types',
      'religions', 'resource_categories', 'resources', 'unit_soldiers',
      'unit_types'
    ]) as name
  )
  select direct.name::text, 'guarded'::text, 'world_id'::text, 'select $1'::text
  from direct

  union all
  -- The world row itself: renames, trash/restore, turn-number bumps.
  select 'worlds'::text, 'guarded'::text, 'id'::text, 'select $1'::text

  union all
  -- Resolve through nations.
  select unnest(array['nation_readiness_votes', 'nation_resource_stockpiles', 'settlements'])::text,
         'guarded'::text, 'nation_id'::text,
         'select world_id from public.nations where id = $1'::text

  union all
  -- Resolve through settlements -> nations.
  select unnest(array[
      'construction_project_subsidies', 'construction_projects',
      'deposit_instances', 'managed_population_instances',
      'nation_tax_policies', 'settlement_buildings',
      'settlement_resource_stockpiles'
    ])::text,
    'guarded'::text, 'settlement_id'::text,
    'select n.world_id from public.settlements s join public.nations n on n.id = s.nation_id where s.id = $1'::text

  union all
  select 'citizen_assignments'::text, 'guarded'::text, 'citizen_id'::text,
         'select world_id from public.citizens where id = $1'::text

  union all
  -- partnerships has no world_id; citizen_a_id is not null on every row.
  select 'partnerships'::text, 'guarded'::text, 'citizen_a_id'::text,
         'select world_id from public.citizens where id = $1'::text

  union all
  select unnest(array['army_groups', 'army_units'])::text, 'guarded'::text, 'army_id'::text,
         'select world_id from public.armies where id = $1'::text

  union all
  select 'building_blueprint_tiers'::text, 'guarded'::text, 'building_blueprint_id'::text,
         'select world_id from public.building_blueprints where id = $1'::text

  union all
  select 'deposit_instance_resources'::text, 'guarded'::text, 'deposit_instance_id'::text,
         'select n.world_id from public.deposit_instances di join public.settlements s on s.id = di.settlement_id join public.nations n on n.id = s.nation_id where di.id = $1'::text

  union all
  select unnest(array['event_effects', 'event_memories'])::text, 'guarded'::text, 'event_id'::text,
         'select world_id from public.events where id = $1'::text

  union all
  select unnest(array['law_amendments', 'law_articles', 'law_document_versions'])::text,
         'guarded'::text, 'document_id'::text,
         'select world_id from public.law_documents where id = $1'::text

  union all
  select 'law_amendment_votes'::text, 'guarded'::text, 'amendment_id'::text,
         'select ld.world_id from public.law_amendments la join public.law_documents ld on ld.id = la.document_id where la.id = $1'::text

  union all
  select 'nation_currency_ledger'::text, 'guarded'::text, 'currency_id'::text,
         'select world_id from public.nation_currencies where id = $1'::text

  union all
  select 'trade_routes'::text, 'guarded'::text, 'origin_settlement_id'::text,
         'select n.world_id from public.settlements s join public.nations n on n.id = s.nation_id where s.id = $1'::text

  union all
  select 'trade_route_legs'::text, 'guarded'::text, 'trade_route_id'::text,
         'select n.world_id from public.trade_routes tr join public.settlements s on s.id = tr.origin_settlement_id join public.nations n on n.id = s.nation_id where tr.id = $1'::text

  union all
  -- Written only by the turn. Guarding these would block the turn itself.
  select unnest(array[
      'army_turn_snapshots', 'nation_currency_snapshots', 'nation_turn_snapshots',
      'settlement_turn_snapshots', 'notifications', 'turn_jobs', 'turn_transitions'
    ])::text, 'turn_output'::text, null::text, null::text

  union all
  -- Auth, infrastructure, and per-user state the simulation never reads.
  select unnest(array[
      'admin_create_user_idempotency_keys', 'edge_rate_limit_buckets',
      'email_send_log', 'notification_preferences', 'smtp_settings', 'users',
      'world_admins', 'user_active_player_characters', 'world_retention_config'
    ])::text, 'out_of_scope'::text, null::text, null::text;
$$;

comment on function public.internal_turn_guard_classification () is 'Classifies every public base table as guarded / turn_output / out_of_scope for the running-turn write guard. Guarded rows carry the column and one-parameter SQL used to resolve the row''s world. Completeness is asserted by turn_guard_table_classification_test.sql.';

revoke all on function public.internal_turn_guard_classification ()
from
  public,
  anon,
  authenticated;
