import { isRecord } from "../utils.ts";

// ---------------------------------------------------------------------------
// Raw row types
// ---------------------------------------------------------------------------

export type SupabaseWorldRow = {
  readonly id: string;
  readonly status: "active" | "archived";
  readonly current_turn_number: number;
  readonly calendar_config_json: unknown;
  readonly naming_config_json: unknown;
  readonly npc_flavor_config_json: unknown;
  readonly partnership_seek_chance: number;
  readonly fertility_chance: number;
  readonly minimum_partnership_age_turns: number;
  readonly maximum_fertility_age_turns: number | null;
  readonly mourning_period_turns: number;
  readonly homelessness_decline_rate: number;
  readonly starvation_severity_multiplier: number;
  readonly food_consumption_per_citizen: number;
  readonly water_consumption_per_citizen: number;
  readonly incest_prevention_depth: number;
};

export type SupabaseSettlementRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly nation_id: string;
  readonly nations: { readonly nameset_id: string | null } | null;
};

export type SupabaseNamesetRow = {
  readonly id: string;
  readonly config_json: unknown;
  readonly is_default: boolean;
};

export type SupabaseResourceRow = {
  readonly decay_rate: number;
  readonly id: string;
  readonly slug: string;
};

export type SupabaseStockpileRow = {
  readonly settlement_id: string;
  readonly resource_id: string;
  readonly quantity: number;
  readonly effective_cap: number;
};

export type SupabaseJobRow = {
  readonly id: string;
  readonly name: string;
  readonly job_type: string;
  readonly base_capacity: number | null;
  readonly trader_capacity_per_worker: number | null;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly required_education_level_id: string | null;
  readonly inputs_json: unknown;
  readonly outputs_json: unknown;
};

export type SupabaseTierRow = {
  readonly id: string;
  readonly building_blueprint_id: string;
  readonly tier_number: number;
  readonly worker_turns_required: number;
  readonly construction_costs_json: unknown;
  readonly upkeep_costs_json: unknown;
  readonly effects_json: unknown;
  readonly education_config_json: unknown;
};

export type SupabaseBlueprintRow = {
  readonly id: string;
  readonly name: string;
  readonly grace_period_turns: number;
  readonly max_instances_per_settlement: number | null;
  readonly building_blueprint_tiers: readonly unknown[];
};

export type SupabaseBuildingRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly building_blueprint_id: string;
  readonly current_tier_id: string;
  readonly source_project_id: string | null;
  readonly state: string;
  readonly missed_upkeep_count: number;
  readonly activated_on_turn_number: number;
};

export type SupabaseProjectRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly building_blueprint_id: string;
  readonly target_tier_id: string;
  readonly status: string;
  readonly queue_position: number;
  readonly progress_worker_turns: number;
  readonly target_tier: { readonly worker_turns_required: number } | null;
};

export type SupabaseDepositTypeRow = {
  readonly id: string;
  readonly name: string;
  readonly job_id: string;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: unknown;
};

export type SupabaseDepositResourceRow = {
  readonly id: string;
  readonly resource_id: string;
  readonly remaining_quantity: number;
};

export type SupabaseDepositRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly deposit_type_id: string;
  readonly name: string;
  readonly status: string;
  readonly max_workers: number | null;
  readonly deposit_instance_resources: readonly unknown[];
};

export type SupabaseManagedPopTypeRow = {
  readonly id: string;
  readonly name: string;
  readonly husbandry_job_id: string;
  readonly culling_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly growth_rate: number;
  readonly maintenance_rules_json: unknown;
  readonly culling_outputs_json: unknown;
  readonly regular_outputs_json: unknown;
};

export type SupabaseManagedPopRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly managed_population_type_id: string;
  readonly name: string;
  readonly current_count: number;
  readonly configured_cull_quantity: number;
  readonly status: string;
};

export type SupabaseTradeRouteLegRow = {
  readonly direction: string;
  readonly quantity_per_transition: number;
  readonly resource_id: string;
};

export type SupabaseTradeRouteRow = {
  readonly id: string;
  readonly origin_settlement_id: string;
  readonly destination_settlement_id: string;
  readonly status: string;
  readonly trade_route_legs: readonly SupabaseTradeRouteLegRow[];
};

export type SupabaseCitizenRow = {
  readonly id: string;
  readonly culture_id: string | null;
  readonly education_level_id: string | null;
  readonly nameset_id: string | null;
  readonly religion_id: string | null;
  readonly settlement_id: string | null;
  readonly citizen_type: string;
  readonly given_name: string;
  readonly surname: string | null;
  readonly sex: string | null;
  readonly status: string;
  readonly born_on_turn_number: number | null;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
  readonly role_type: string;
  readonly role_nation_id: string | null;
  readonly role_settlement_id: string | null;
};

export type SupabaseNationRow = {
  readonly id: string;
  readonly government_type: string;
  readonly name: string;
  readonly tax_rate: number;
};

export type SupabaseNationOfficeRow = {
  readonly citizen_id: string;
};

export type SupabaseUnitSoldierRow = {
  readonly citizen_id: string;
};

export type SupabaseEducationLevelRow = {
  readonly id: string;
  readonly world_id: string;
  readonly name: string;
  readonly rank: number;
};

export type SupabaseEducationEnrollmentRow = {
  readonly id: string;
  readonly world_id: string;
  readonly settlement_building_id: string;
  readonly citizen_id: string;
  readonly target_level_id: string;
  readonly progress_turns: number;
  readonly enrolled_turn_number: number;
};

export type SupabaseNationRelationshipRow = {
  readonly current_stance: string;
  readonly from_nation_id: string;
  readonly to_nation_id: string;
};

export type SupabaseNationStockpileRow = {
  readonly nation_id: string;
  readonly resource_id: string;
  readonly quantity: number;
};

export type SupabaseNationTreatyRow = {
  readonly id: string;
  readonly proposer_nation_id: string;
  readonly responder_nation_id: string;
  readonly treaty_type: string;
  readonly terms: Record<string, unknown>;
  readonly ends_turn_number: number | null;
};

export type SupabaseNationCurrencyRow = {
  readonly id: string;
  readonly nation_id: string;
  readonly name: string;
  readonly currency_type: string;
  readonly backing_resource_id: string | null;
  readonly backing_ratio: number | null;
  readonly money_supply: number;
  readonly reserve_quantity: number;
  readonly confidence: number;
};

export type SupabaseNationCurrencyLedgerRow = {
  readonly currency_id: string;
  readonly action: string;
  readonly amount: number | null;
};

export type SupabaseAssignmentRow = {
  readonly citizen_id: string;
  readonly assignment_type: string;
  readonly job_id: string | null;
  readonly construction_project_id: string | null;
  readonly deposit_instance_id: string | null;
  readonly managed_population_instance_id: string | null;
  readonly trade_route_id: string | null;
  readonly trade_route_end: string | null;
  readonly assigned_on_turn_number: number;
};

export type SupabasePartnershipRow = {
  readonly id: string;
  readonly citizen_a_id: string;
  readonly citizen_b_id: string;
  readonly status: string;
  readonly formed_on_turn_number: number;
  readonly ended_on_turn_number: number | null;
};

export type SupabaseEventRow = {
  readonly id: string;
  readonly status: string;
  readonly effect_type: string | null;
  readonly activate_on_transition_after_turn_number: number;
  readonly duration_type: string;
  readonly remaining_transitions: number | null;
  readonly effect_payload_jsonb: unknown;
  readonly scope_type: string | null;
  readonly scope_nation_id: string | null;
  readonly scope_settlement_id: string | null;
};

export type SupabaseEventEffectRow = {
  readonly id: string;
  readonly event_id: string;
  readonly effect_type: string;
  readonly amount_value: number | null;
  readonly multiplier_value: number | null;
  readonly is_percent: boolean;
  readonly resource_id: string | null;
  readonly job_id: string | null;
  readonly managed_population_instance_id: string | null;
  readonly deposit_instance_id: string | null;
  readonly settlement_building_id: string | null;
  readonly building_blueprint_id: string | null;
  readonly extra_data_jsonb: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isWorldRow(v: unknown): v is SupabaseWorldRow {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    (v.status === "active" || v.status === "archived") &&
    typeof v.current_turn_number === "number" &&
    typeof v.partnership_seek_chance === "number" &&
    typeof v.fertility_chance === "number" &&
    typeof v.minimum_partnership_age_turns === "number" &&
    (v.maximum_fertility_age_turns === null ||
      typeof v.maximum_fertility_age_turns === "number") &&
    typeof v.mourning_period_turns === "number" &&
    typeof v.homelessness_decline_rate === "number" &&
    typeof v.starvation_severity_multiplier === "number" &&
    typeof v.food_consumption_per_citizen === "number" &&
    typeof v.water_consumption_per_citizen === "number" &&
    typeof v.incest_prevention_depth === "number"
  );
}

export function isSettlementRow(v: unknown): v is SupabaseSettlementRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.is_ready_current_turn === "boolean" &&
    typeof v.auto_ready_enabled === "boolean" &&
    typeof v.nation_id === "string" &&
    (v.nameset_id === null || typeof v.nameset_id === "string") &&
    (v.nations === null ||
      (isRecord(v.nations) &&
        (v.nations.nameset_id === null ||
          typeof v.nations.nameset_id === "string")))
  );
}

export function isNamesetRow(v: unknown): v is SupabaseNamesetRow {
  return (
    isRecord(v) && typeof v.id === "string" && typeof v.is_default === "boolean"
  );
}

export function isResourceRow(v: unknown): v is SupabaseResourceRow {
  return (
    isRecord(v) &&
    typeof v.decay_rate === "number" &&
    typeof v.id === "string" &&
    typeof v.slug === "string"
  );
}

export function isStockpileRow(v: unknown): v is SupabaseStockpileRow {
  return (
    isRecord(v) &&
    typeof v.settlement_id === "string" &&
    typeof v.resource_id === "string" &&
    typeof v.quantity === "number" &&
    typeof v.effective_cap === "number"
  );
}

export function isJobRow(v: unknown): v is SupabaseJobRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.job_type === "string" &&
    (v.base_capacity === null || typeof v.base_capacity === "number") &&
    (v.trader_capacity_per_worker === null ||
      typeof v.trader_capacity_per_worker === "number") &&
    (v.linked_deposit_type_id === null ||
      typeof v.linked_deposit_type_id === "string") &&
    (v.linked_managed_population_type_id === null ||
      typeof v.linked_managed_population_type_id === "string") &&
    (v.required_education_level_id === null ||
      typeof v.required_education_level_id === "string")
  );
}

export function isTierRow(v: unknown): v is SupabaseTierRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.building_blueprint_id === "string" &&
    typeof v.tier_number === "number" &&
    typeof v.worker_turns_required === "number"
  );
}

export function isBlueprintRow(v: unknown): v is SupabaseBlueprintRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.grace_period_turns === "number" &&
    (v.max_instances_per_settlement === null ||
      typeof v.max_instances_per_settlement === "number") &&
    Array.isArray(v.building_blueprint_tiers)
  );
}

export function isBuildingRow(v: unknown): v is SupabaseBuildingRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.building_blueprint_id === "string" &&
    typeof v.current_tier_id === "string" &&
    (v.source_project_id === null || typeof v.source_project_id === "string") &&
    typeof v.state === "string" &&
    typeof v.missed_upkeep_count === "number" &&
    typeof v.activated_on_turn_number === "number"
  );
}

export function isProjectRow(v: unknown): v is SupabaseProjectRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.building_blueprint_id === "string" &&
    typeof v.target_tier_id === "string" &&
    typeof v.status === "string" &&
    typeof v.queue_position === "number" &&
    typeof v.progress_worker_turns === "number" &&
    (v.target_tier === null ||
      (isRecord(v.target_tier) &&
        typeof v.target_tier.worker_turns_required === "number"))
  );
}

export function isDepositTypeRow(v: unknown): v is SupabaseDepositTypeRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.job_id === "string" &&
    typeof v.output_units_per_worker === "number"
  );
}

export function isDepositResourceRow(
  v: unknown,
): v is SupabaseDepositResourceRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.resource_id === "string" &&
    typeof v.remaining_quantity === "number"
  );
}

export function isDepositRow(v: unknown): v is SupabaseDepositRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.deposit_type_id === "string" &&
    typeof v.name === "string" &&
    typeof v.status === "string" &&
    (v.max_workers === null || typeof v.max_workers === "number") &&
    Array.isArray(v.deposit_instance_resources)
  );
}

export function isManagedPopTypeRow(
  v: unknown,
): v is SupabaseManagedPopTypeRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.husbandry_job_id === "string" &&
    typeof v.culling_job_id === "string" &&
    typeof v.husbandry_workers_per_n_animals === "number" &&
    typeof v.growth_rate === "number"
  );
}

export function isManagedPopRow(v: unknown): v is SupabaseManagedPopRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.managed_population_type_id === "string" &&
    typeof v.name === "string" &&
    typeof v.current_count === "number" &&
    typeof v.configured_cull_quantity === "number" &&
    typeof v.status === "string"
  );
}

export function isTradeRouteRow(v: unknown): v is SupabaseTradeRouteRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.origin_settlement_id === "string" &&
    typeof v.destination_settlement_id === "string" &&
    typeof v.status === "string" &&
    Array.isArray(v.trade_route_legs) &&
    (v.trade_route_legs as unknown[]).every(
      (leg) =>
        isRecord(leg) &&
        typeof leg.direction === "string" &&
        typeof leg.resource_id === "string" &&
        typeof leg.quantity_per_transition === "number",
    )
  );
}

export function isCitizenRow(v: unknown): v is SupabaseCitizenRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    (v.culture_id === null || typeof v.culture_id === "string") &&
    (v.education_level_id === null || typeof v.education_level_id === "string") &&
    (v.religion_id === null || typeof v.religion_id === "string") &&
    (v.settlement_id === null || typeof v.settlement_id === "string") &&
    typeof v.citizen_type === "string" &&
    typeof v.given_name === "string" &&
    (v.surname === null || typeof v.surname === "string") &&
    (v.sex === null || typeof v.sex === "string") &&
    typeof v.status === "string" &&
    (v.born_on_turn_number === null ||
      typeof v.born_on_turn_number === "number") &&
    (v.parent_a_citizen_id === null ||
      typeof v.parent_a_citizen_id === "string") &&
    (v.parent_b_citizen_id === null ||
      typeof v.parent_b_citizen_id === "string") &&
    typeof v.role_type === "string" &&
    (v.role_nation_id === null || typeof v.role_nation_id === "string") &&
    (v.role_settlement_id === null ||
      typeof v.role_settlement_id === "string")
  );
}

export function isNationRow(v: unknown): v is SupabaseNationRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.government_type === "string" &&
    typeof v.name === "string" &&
    typeof v.tax_rate === "number"
  );
}

export function isNationOfficeRow(v: unknown): v is SupabaseNationOfficeRow {
  return isRecord(v) && typeof v.citizen_id === "string";
}

export function isUnitSoldierRow(v: unknown): v is SupabaseUnitSoldierRow {
  return isRecord(v) && typeof v.citizen_id === "string";
}

export function isEducationLevelRow(v: unknown): v is SupabaseEducationLevelRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.world_id === "string" &&
    typeof v.name === "string" &&
    typeof v.rank === "number"
  );
}

export function isEducationEnrollmentRow(
  v: unknown,
): v is SupabaseEducationEnrollmentRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.world_id === "string" &&
    typeof v.settlement_building_id === "string" &&
    typeof v.citizen_id === "string" &&
    typeof v.target_level_id === "string" &&
    typeof v.progress_turns === "number" &&
    typeof v.enrolled_turn_number === "number"
  );
}

export function isNationRelationshipRow(
  v: unknown,
): v is SupabaseNationRelationshipRow {
  return (
    isRecord(v) &&
    typeof v.current_stance === "string" &&
    typeof v.from_nation_id === "string" &&
    typeof v.to_nation_id === "string"
  );
}

export function isNationStockpileRow(v: unknown): v is SupabaseNationStockpileRow {
  return (
    isRecord(v) &&
    typeof v.nation_id === "string" &&
    typeof v.resource_id === "string" &&
    typeof v.quantity === "number"
  );
}

export function isNationTreatyRow(v: unknown): v is SupabaseNationTreatyRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.proposer_nation_id === "string" &&
    typeof v.responder_nation_id === "string" &&
    typeof v.treaty_type === "string" &&
    isRecord(v.terms) &&
    (v.ends_turn_number === null || typeof v.ends_turn_number === "number")
  );
}

export function isNationCurrencyRow(v: unknown): v is SupabaseNationCurrencyRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.nation_id === "string" &&
    typeof v.name === "string" &&
    typeof v.currency_type === "string" &&
    (v.backing_resource_id === null || typeof v.backing_resource_id === "string") &&
    (v.backing_ratio === null || typeof v.backing_ratio === "number") &&
    typeof v.money_supply === "number" &&
    typeof v.reserve_quantity === "number" &&
    typeof v.confidence === "number"
  );
}

export function isNationCurrencyLedgerRow(v: unknown): v is SupabaseNationCurrencyLedgerRow {
  return (
    isRecord(v) &&
    typeof v.currency_id === "string" &&
    typeof v.action === "string" &&
    (v.amount === null || typeof v.amount === "number")
  );
}

export function isAssignmentRow(v: unknown): v is SupabaseAssignmentRow {
  return (
    isRecord(v) &&
    typeof v.citizen_id === "string" &&
    typeof v.assignment_type === "string" &&
    (v.job_id === null || typeof v.job_id === "string") &&
    (v.construction_project_id === null ||
      typeof v.construction_project_id === "string") &&
    (v.deposit_instance_id === null ||
      typeof v.deposit_instance_id === "string") &&
    (v.managed_population_instance_id === null ||
      typeof v.managed_population_instance_id === "string") &&
    (v.trade_route_id === null || typeof v.trade_route_id === "string") &&
    (v.trade_route_end === null || typeof v.trade_route_end === "string") &&
    typeof v.assigned_on_turn_number === "number"
  );
}

export function isPartnershipRow(v: unknown): v is SupabasePartnershipRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.citizen_a_id === "string" &&
    typeof v.citizen_b_id === "string" &&
    typeof v.status === "string" &&
    typeof v.formed_on_turn_number === "number" &&
    (v.ended_on_turn_number === null ||
      typeof v.ended_on_turn_number === "number")
  );
}

export function isEventRow(v: unknown): v is SupabaseEventRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.status === "string" &&
    (v.effect_type === null || typeof v.effect_type === "string") &&
    typeof v.activate_on_transition_after_turn_number === "number" &&
    typeof v.duration_type === "string" &&
    (v.remaining_transitions === null || typeof v.remaining_transitions === "number") &&
    (v.scope_type === null || typeof v.scope_type === "string") &&
    (v.scope_nation_id === null || typeof v.scope_nation_id === "string") &&
    (v.scope_settlement_id === null || typeof v.scope_settlement_id === "string")
  );
}

export function isEventEffectRow(v: unknown): v is SupabaseEventEffectRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.event_id === "string" &&
    typeof v.effect_type === "string" &&
    (v.amount_value === null || typeof v.amount_value === "number") &&
    (v.multiplier_value === null || typeof v.multiplier_value === "number") &&
    typeof v.is_percent === "boolean" &&
    (v.resource_id === null || typeof v.resource_id === "string") &&
    (v.job_id === null || typeof v.job_id === "string") &&
    (v.managed_population_instance_id === null ||
      typeof v.managed_population_instance_id === "string") &&
    (v.deposit_instance_id === null || typeof v.deposit_instance_id === "string")
  );
}
