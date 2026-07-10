import { parseTierEducationConfig } from "../../_shared/education/index.ts";
import { isRecord } from "../utils.ts";

import { isBlueprintRow, isDepositResourceRow, isDepositRow, isTierRow } from "./rowTypes.ts";

import type {
  SupabaseArmyRow,
  SupabaseArmyUnitRow,
  SupabaseAssignmentRow,
  SupabaseBuildingRow,
  SupabaseCitizenRow,
  SupabaseDepositTypeRow,
  SupabaseEducationEnrollmentRow,
  SupabaseEducationLevelRow,
  SupabaseEventEffectRow,
  SupabaseEventRow,
  SupabaseJobRow,
  SupabaseManagedPopRow,
  SupabaseManagedPopTypeRow,
  SupabaseNationCurrencyLedgerRow,
  SupabaseNationCurrencyRow,
  SupabaseNationOfficeRow,
  SupabaseNationRelationshipRow,
  SupabaseNationRow,
  SupabaseNationStockpileRow,
  SupabaseNationTreatyRow,
  SupabasePartnershipRow,
  SupabaseProjectRow,
  SupabaseSettlementRow,
  SupabaseStockpileRow,
  SupabaseTradeRouteRow,
  SupabaseUnitSoldierRow,
  SupabaseUnitTypeRow,
  SupabaseWorldRow,
} from "./rowTypes.ts";
import type {
  SimArmy,
  SimArmyUnit,
  SimBuildingBlueprint,
  SimBuildingState,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimConstructionProject,
  SimCurrencyLedgerEntry,
  SimDeposit,
  SimDepositResource,
  SimDepositType,
  SimEducationEnrollment,
  SimEducationLevel,
  SimEffect,
  SimEvent,
  SimJob,
  SimJobIoEntry,
  SimManagedPopulation,
  SimManagedPopulationType,
  SimNation,
  SimNationCurrency,
  SimNationOffice,
  SimNationRelationship,
  SimNationStockpile,
  SimPartnership,
  SimPopulationResourceEntry,
  SimSettlement,
  SimSettlementBuilding,
  SimStockpile,
  SimTierCostEntry,
  SimTierEffect,
  SimTradeRoute,
  SimTreaty,
  SimTreatyType,
  SimUnitSoldier,
  SimUnitType,
  SimWorkerInputEntry,
  WorldPopulationRules,
} from "../../_shared/simulation/simulationTypes.ts";

// ---------------------------------------------------------------------------
// JSONB array transformers (snake_case DB keys → camelCase Sim types)
// ---------------------------------------------------------------------------

function toSimJobIoEntries(raw: unknown): readonly SimJobIoEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimJobIoEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount_per_worker === "number"
    ) {
      result.push({
        amountPerWorker: item.amount_per_worker,
        resourceId: item.resource_id,
      });
    }
  }
  return result;
}

export function toSimTierCostEntries(
  raw: unknown,
): readonly SimTierCostEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimTierCostEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount === "number"
    ) {
      result.push({ amount: item.amount, resourceId: item.resource_id });
    }
  }
  return result;
}

function toSimTierAmountEffect(item: Record<string, unknown>): SimTierEffect | null {
  const { type, amount } = item;
  if (typeof amount !== "number") return null;
  if (type === "job_capacity_increase" && typeof item.job_id === "string") {
    return { amount, jobId: item.job_id, type };
  }
  if (type === "passive_resource_production" && typeof item.resource_id === "string") {
    return { amount, resourceId: item.resource_id, type };
  }
  if (type === "resource_storage_increase" && typeof item.resource_id === "string") {
    return { amount, resourceId: item.resource_id, type };
  }
  if (type === "population_cap_increase") {
    return { amount, type: "population_cap_increase" };
  }
  return null;
}

export function toSimTierEffects(raw: unknown): readonly SimTierEffect[] {
  if (!Array.isArray(raw)) return [];
  const result: SimTierEffect[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.type !== "string") continue;
    if (item.type === "education") {
      const config = parseTierEducationConfig(item);
      if (config !== null) result.push({ ...config, type: "education" });
      continue;
    }
    const effect = toSimTierAmountEffect(item);
    if (effect !== null) result.push(effect);
  }
  return result;
}

function toSimWorkerInputEntries(raw: unknown): readonly SimWorkerInputEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimWorkerInputEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount_per_worker === "number"
    ) {
      result.push({
        amountPerWorker: item.amount_per_worker,
        resourceId: item.resource_id,
      });
    }
  }
  return result;
}

function toSimPopResourceEntries(
  raw: unknown,
): readonly SimPopulationResourceEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimPopulationResourceEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount_per_n_animals === "number"
    ) {
      result.push({
        amountPerNAnimals: item.amount_per_n_animals,
        resourceId: item.resource_id,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Row → Sim type mappers
// ---------------------------------------------------------------------------

export function toSimSettlement(row: SupabaseSettlementRow): SimSettlement {
  return {
    autoReadyEnabled: row.auto_ready_enabled,
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
    name: row.name,
    nationId: row.nation_id,
  };
}

export function toSimStockpile(row: SupabaseStockpileRow): SimStockpile {
  return {
    cap: row.effective_cap,
    quantity: row.quantity,
    resourceId: row.resource_id,
    settlementId: row.settlement_id,
  };
}

export function toSimJob(row: SupabaseJobRow): SimJob {
  return {
    baseCapacity: row.base_capacity,
    id: row.id,
    inputsJson: toSimJobIoEntries(row.inputs_json),
    jobType: row.job_type as SimJob["jobType"],
    linkedDepositTypeId: row.linked_deposit_type_id,
    linkedManagedPopulationTypeId: row.linked_managed_population_type_id,
    name: row.name,
    outputsJson: toSimJobIoEntries(row.outputs_json),
    requiredEducationLevelId: row.required_education_level_id,
    traderCapacityPerWorker: row.trader_capacity_per_worker,
  };
}

export function toSimBuilding(row: SupabaseBuildingRow): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: row.activated_on_turn_number,
    buildingBlueprintId: row.building_blueprint_id,
    currentTierId: row.current_tier_id,
    id: row.id,
    missedUpkeepCount: row.missed_upkeep_count,
    settlementId: row.settlement_id,
    sourceProjectId: row.source_project_id,
    state: row.state as SimBuildingState,
  };
}

export function toSimProject(row: SupabaseProjectRow): SimConstructionProject {
  return {
    buildingBlueprintId: row.building_blueprint_id,
    id: row.id,
    progressWorkerTurns: row.progress_worker_turns,
    queuePosition: row.queue_position,
    settlementId: row.settlement_id,
    status: row.status as SimConstructionProject["status"],
    targetTierId: row.target_tier_id,
    workerTurnsRequired: row.target_tier?.worker_turns_required ?? 0,
  };
}

export function toSimDepositType(row: SupabaseDepositTypeRow): SimDepositType {
  return {
    id: row.id,
    jobId: row.job_id,
    name: row.name,
    outputUnitsPerWorker: row.output_units_per_worker,
    workerInputsJson: toSimWorkerInputEntries(row.worker_inputs_json),
  };
}

export function toSimManagedPopType(
  row: SupabaseManagedPopTypeRow,
): SimManagedPopulationType {
  return {
    cullingJobId: row.culling_job_id,
    cullingOutputsJson: toSimPopResourceEntries(row.culling_outputs_json),
    growthRate: row.growth_rate,
    husbandryJobId: row.husbandry_job_id,
    husbandryWorkersPerNAnimals: row.husbandry_workers_per_n_animals,
    id: row.id,
    maintenanceRulesJson: toSimPopResourceEntries(row.maintenance_rules_json),
    name: row.name,
    regularOutputsJson: toSimPopResourceEntries(row.regular_outputs_json),
  };
}

export function toSimManagedPop(
  row: SupabaseManagedPopRow,
): SimManagedPopulation {
  return {
    configuredCullQuantity: row.configured_cull_quantity,
    currentCount: row.current_count,
    id: row.id,
    managedPopulationTypeId: row.managed_population_type_id,
    name: row.name,
    settlementId: row.settlement_id,
    status: row.status as SimManagedPopulation["status"],
  };
}

export function toSimTradeRoute(row: SupabaseTradeRouteRow): SimTradeRoute {
  return {
    destinationSettlementId: row.destination_settlement_id,
    id: row.id,
    legs: row.trade_route_legs.map((leg) => ({
      direction: leg.direction as "receive" | "send",
      quantityPerTransition: leg.quantity_per_transition,
      resourceId: leg.resource_id,
    })),
    originSettlementId: row.origin_settlement_id,
    status: row.status as SimTradeRoute["status"],
  };
}

export function toSimCitizen(row: SupabaseCitizenRow): SimCitizen {
  return {
    bornOnTurnNumber: row.born_on_turn_number,
    citizenType: row.citizen_type as SimCitizen["citizenType"],
    cultureId: row.culture_id ?? null,
    educationLevelId: row.education_level_id ?? null,
    givenName: row.given_name,
    id: row.id,
    namesetId: row.nameset_id ?? null,
    parentACitizenId: row.parent_a_citizen_id,
    parentBCitizenId: row.parent_b_citizen_id,
    religionId: row.religion_id ?? null,
    roleNationId: row.role_nation_id,
    roleSettlementId: row.role_settlement_id,
    roleType: row.role_type as SimCitizen["roleType"],
    settlementId: row.settlement_id,
    sex: row.sex,
    status: row.status as SimCitizen["status"],
    surname: row.surname,
  };
}

export function toSimNation(row: SupabaseNationRow): SimNation {
  return {
    governmentType: row.government_type as SimNation["governmentType"],
    id: row.id,
    name: row.name,
    taxRate: row.tax_rate,
    tradePolicy: row.trade_policy as SimNation["tradePolicy"],
  };
}

export function toSimNationOffice(row: SupabaseNationOfficeRow): SimNationOffice {
  return {
    citizenId: row.citizen_id,
    // office_types is null only if the FK row was concurrently deleted
    // between fetch and map; default to excluding from labor (the safe,
    // Epic 11-compatible default) rather than silently including them.
    excludesFromLabor: row.office_types?.excludes_from_labor ?? true,
  };
}

export function toSimUnitSoldier(row: SupabaseUnitSoldierRow): SimUnitSoldier {
  return {
    citizenId: row.citizen_id,
    homeSettlementId: row.home_settlement_id,
    id: row.id,
    unitId: row.unit_id,
  };
}

export function toSimArmy(row: SupabaseArmyRow): SimArmy {
  return {
    fundingSource: row.funding_source as SimArmy["fundingSource"],
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
    stationedSettlementId: row.stationed_settlement_id,
  };
}

export function toSimArmyUnit(row: SupabaseArmyUnitRow): SimArmyUnit {
  return {
    armyId: row.army_id,
    id: row.id,
    unitTypeId: row.unit_type_id,
  };
}

export function toSimUnitType(row: SupabaseUnitTypeRow): SimUnitType {
  return {
    desertionRate: row.desertion_rate,
    id: row.id,
    upkeepCostsJson: toSimTierCostEntries(row.upkeep_costs_json),
  };
}

export function toSimEducationLevel(row: SupabaseEducationLevelRow): SimEducationLevel {
  return {
    id: row.id,
    name: row.name,
    naturalBornPercent: row.natural_born_percent,
    rank: row.rank,
    worldId: row.world_id,
  };
}

export function toSimEducationEnrollment(
  row: SupabaseEducationEnrollmentRow,
): SimEducationEnrollment {
  return {
    citizenId: row.citizen_id,
    enrolledTurnNumber: row.enrolled_turn_number,
    id: row.id,
    progressTurns: row.progress_turns,
    settlementBuildingId: row.settlement_building_id,
    targetLevelId: row.target_level_id,
    worldId: row.world_id,
  };
}

export function toSimNationRelationship(
  row: SupabaseNationRelationshipRow,
): SimNationRelationship {
  return {
    currentStance: row.current_stance,
    fromNationId: row.from_nation_id,
    toNationId: row.to_nation_id,
  };
}

export function toSimNationStockpile(row: SupabaseNationStockpileRow): SimNationStockpile {
  return {
    nationId: row.nation_id,
    quantity: row.quantity,
    resourceId: row.resource_id,
  };
}

const TREATY_TYPES: readonly SimTreatyType[] = [
  "tribute",
  "trade_agreement",
  "royal_marriage",
  "currency_exchange",
];

// #1090: terms shape is validated per treaty_type by propose_nation_treaty
// (20260914000001) — only the fields each type's simulation effect needs are
// extracted here; malformed/unexpected terms fields resolve to null rather
// than throwing, so a corrupt row can't crash the transition.
export function toSimTreaty(row: SupabaseNationTreatyRow): SimTreaty {
  const terms = row.terms;
  const treatyType = TREATY_TYPES.includes(row.treaty_type as SimTreatyType)
    ? (row.treaty_type as SimTreatyType)
    : "trade_agreement";

  const tributePayer = terms.payer === "proposer" || terms.payer === "responder"
    ? terms.payer
    : null;
  const tributeResourceId = typeof terms.resource_id === "string" ? terms.resource_id : null;
  const tributeQuantityPerTurn = typeof terms.quantity_per_turn === "number"
    ? terms.quantity_per_turn
    : null;
  const marriageCitizenAId = typeof terms.citizen_a_id === "string" ? terms.citizen_a_id : null;
  const marriageCitizenBId = typeof terms.citizen_b_id === "string" ? terms.citizen_b_id : null;

  return {
    endsTurnNumber: row.ends_turn_number,
    id: row.id,
    marriageCitizenAId,
    marriageCitizenBId,
    proposerNationId: row.proposer_nation_id,
    responderNationId: row.responder_nation_id,
    treatyType,
    tributePayer,
    tributeQuantityPerTurn,
    tributeResourceId,
  };
}

export function toSimNationCurrency(row: SupabaseNationCurrencyRow): SimNationCurrency {
  return {
    backingRatio: row.backing_ratio,
    backingResourceId: row.backing_resource_id,
    confidence: row.confidence,
    currencyType: row.currency_type as SimNationCurrency["currencyType"],
    id: row.id,
    isInDefault: row.is_in_default,
    moneySupply: row.money_supply,
    name: row.name,
    nationId: row.nation_id,
    reserveQuantity: row.reserve_quantity,
  };
}

export function toSimCurrencyLedgerEntry(
  row: SupabaseNationCurrencyLedgerRow,
): SimCurrencyLedgerEntry {
  return {
    action: row.action as SimCurrencyLedgerEntry["action"],
    amount: row.amount,
    currencyId: row.currency_id,
  };
}

export function toSimCitizenAssignment(
  row: SupabaseAssignmentRow,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: row.assigned_on_turn_number,
    assignmentType: row.assignment_type as SimCitizenAssignment["assignmentType"],
    citizenId: row.citizen_id,
    constructionProjectId: row.construction_project_id,
    depositInstanceId: row.deposit_instance_id,
    jobId: row.job_id,
    managedPopulationInstanceId: row.managed_population_instance_id,
    tradeRouteEnd: row.trade_route_end,
    tradeRouteId: row.trade_route_id,
  };
}

export function toSimPartnership(row: SupabasePartnershipRow): SimPartnership {
  return {
    citizenAId: row.citizen_a_id,
    citizenBId: row.citizen_b_id,
    endedOnTurnNumber: row.ended_on_turn_number,
    formedOnTurnNumber: row.formed_on_turn_number,
    id: row.id,
    status: row.status as SimPartnership["status"],
  };
}

export function toSimEffect(row: SupabaseEventEffectRow): SimEffect & { eventId: string } {
  return {
    id: row.id,
    eventId: row.event_id,
    effectType: row.effect_type as SimEffect["effectType"],
    amountValue: row.amount_value,
    multiplierValue: row.multiplier_value,
    isPercent: row.is_percent,
    resourceId: row.resource_id,
    jobId: row.job_id,
    managedPopulationInstanceId: row.managed_population_instance_id,
    depositInstanceId: row.deposit_instance_id,
    settlementBuildingId: row.settlement_building_id,
    extraDataJsonb: row.extra_data_jsonb,
  };
}

export function toSimEvent(
  row: SupabaseEventRow,
  effects: readonly SimEffect[] = [],
): SimEvent {
  return {
    activateOnTransitionAfterTurnNumber: row.activate_on_transition_after_turn_number,
    durationType: row.duration_type === "sustained" ? "sustained" : "instant",
    effectPayloadJsonb: isRecord(row.effect_payload_jsonb) ? row.effect_payload_jsonb : {},
    effectType: row.effect_type as SimEvent["effectType"],
    effects,
    id: row.id,
    remainingTransitions: row.remaining_transitions,
    scopeNationId: row.scope_nation_id,
    scopeSettlementId: row.scope_settlement_id,
    scopeType: (row.scope_type as SimEvent["scopeType"]) ?? "world",
    status: row.status as SimEvent["status"],
  };
}

// ---------------------------------------------------------------------------
// Composite mappers (multi-row → structured collections)
// ---------------------------------------------------------------------------

export function toBlueprintsAndTiers(rows: readonly unknown[]): {
  readonly buildingBlueprints: SimBuildingBlueprint[];
  readonly buildingTiers: SimBuildingTier[];
} {
  const buildingBlueprints: SimBuildingBlueprint[] = [];
  const buildingTiers: SimBuildingTier[] = [];

  for (const raw of rows) {
    if (!isBlueprintRow(raw)) continue;
    buildingBlueprints.push({
      gracePeriodTurns: raw.grace_period_turns,
      id: raw.id,
      maxInstancesPerSettlement: raw.max_instances_per_settlement,
      name: raw.name,
    });
    for (const tier of raw.building_blueprint_tiers) {
      if (!isTierRow(tier)) continue;
      buildingTiers.push({
        buildingBlueprintId: tier.building_blueprint_id,
        constructionCostsJson: toSimTierCostEntries(
          tier.construction_costs_json,
        ),
        effectsJson: toSimTierEffects(tier.effects_json),
        id: tier.id,
        tierNumber: tier.tier_number,
        upkeepCostsJson: toSimTierCostEntries(tier.upkeep_costs_json),
        workerTurnsRequired: tier.worker_turns_required,
      });
    }
  }

  return { buildingBlueprints, buildingTiers };
}

export function toDeposits(rows: readonly unknown[]): SimDeposit[] {
  return rows.filter(isDepositRow).map(
    (raw): SimDeposit => ({
      depositTypeId: raw.deposit_type_id,
      id: raw.id,
      maxWorkers: raw.max_workers,
      name: raw.name,
      resources: raw.deposit_instance_resources
        .filter(isDepositResourceRow)
        .map(
          (r): SimDepositResource => ({
            depositInstanceId: raw.id,
            id: r.id,
            remainingQuantity: r.remaining_quantity,
            resourceId: r.resource_id,
          }),
        ),
      settlementId: raw.settlement_id,
      status: raw.status as SimDeposit["status"],
    }),
  );
}

export function toWorldPopulationRules(
  row: SupabaseWorldRow,
): WorldPopulationRules {
  return {
    fertilityChance: row.fertility_chance,
    foodConsumptionPerCitizen: row.food_consumption_per_citizen,
    homelessnessDecliningRate: row.homelessness_decline_rate,
    incestPreventionDepth: row.incest_prevention_depth,
    maximumFertilityAgeTurns: row.maximum_fertility_age_turns,
    minimumPartnershipAgeTurns: row.minimum_partnership_age_turns,
    mourningPeriodTurns: row.mourning_period_turns,
    partnershipSeekChance: row.partnership_seek_chance,
    starvationSeverityMultiplier: row.starvation_severity_multiplier,
    waterConsumptionPerCitizen: row.water_consumption_per_citizen,
  };
}
