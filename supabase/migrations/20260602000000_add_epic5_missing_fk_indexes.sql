-- FK support indexes for Epic 5 tables.
-- settlement_buildings.current_tier_id → building_blueprint_tiers(id)
create index settlement_buildings_current_tier_idx on public.settlement_buildings (current_tier_id);

-- settlement_buildings.source_project_id → construction_projects(id)
create index settlement_buildings_source_project_idx on public.settlement_buildings (source_project_id);

-- settlement_buildings.deactivated_in_transition_id → turn_transitions(id)
create index settlement_buildings_deactivated_in_transition_idx on public.settlement_buildings (deactivated_in_transition_id);

-- construction_projects.completed_in_transition_id → turn_transitions(id)
create index construction_projects_completed_in_transition_idx on public.construction_projects (completed_in_transition_id);

-- trade_routes.proposed_by_citizen_id → citizens(id)
create index trade_routes_proposed_by_citizen_idx on public.trade_routes (proposed_by_citizen_id);

-- trade_routes.origin_approved_by_citizen_id → citizens(id)
create index trade_routes_origin_approved_by_citizen_idx on public.trade_routes (origin_approved_by_citizen_id);

-- trade_routes.destination_approved_by_citizen_id → citizens(id)
create index trade_routes_destination_approved_by_citizen_idx on public.trade_routes (destination_approved_by_citizen_id);
