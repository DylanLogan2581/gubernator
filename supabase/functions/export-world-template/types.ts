// Raw row shapes returned by the PostgREST queries for world template export.
// These are plain-TypeScript types — no zod, no @/ imports.

export type RawTierEffectRow =
  | {
      readonly type: "job_capacity_increase";
      readonly job_id: string;
      readonly amount: number;
    }
  | {
      readonly type: "passive_resource_production";
      readonly resource_id: string;
      readonly amount: number;
    }
  | {
      readonly type: "resource_storage_increase";
      readonly resource_id: string;
      readonly amount: number;
    }
  | {
      readonly type: "population_cap_increase";
      readonly amount: number;
    };

export type RawTierCostRow = {
  readonly resource_id: string;
  readonly amount: number;
};

export type RawTierRow = {
  readonly building_blueprint_id: string;
  readonly tier_number: number;
  readonly worker_turns_required: number;
  readonly construction_costs_json: readonly RawTierCostRow[];
  readonly upkeep_costs_json: readonly RawTierCostRow[];
  readonly effects_json: readonly RawTierEffectRow[];
};

export type RawBlueprintRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly max_instances_per_settlement: number | null;
  readonly grace_period_turns: number;
  readonly is_trashed: boolean;
  readonly building_blueprint_tiers: readonly RawTierRow[];
};

export type RawJobIoRow = {
  readonly resource_id: string;
  readonly amount_per_worker: number;
  readonly notes?: string;
};

export type RawJobRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly job_type: string;
  readonly base_capacity: number | null;
  readonly trader_capacity_per_worker: number | null;
  readonly inputs_json: readonly RawJobIoRow[];
  readonly outputs_json: readonly RawJobIoRow[];
  readonly is_trashed: boolean;
};

export type RawResourceRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly base_stockpile_cap: number;
  readonly decay_rate: number;
  readonly is_system_resource: boolean;
  readonly is_trashed: boolean;
};

export type RawWorkerInputRow = {
  readonly resource_id: string;
  readonly amount_per_worker: number;
};

export type RawDepositTypeRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly job_id: string;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: readonly RawWorkerInputRow[];
  readonly is_trashed: boolean;
};

export type RawPopulationResourceRow = {
  readonly resource_id: string;
  readonly amount_per_n_animals: number;
};

export type RawManagedPopulationTypeRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly husbandry_job_id: string;
  readonly culling_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly growth_rate: number;
  readonly maintenance_rules_json: readonly RawPopulationResourceRow[];
  readonly culling_outputs_json: readonly RawPopulationResourceRow[];
  readonly regular_outputs_json: readonly RawPopulationResourceRow[];
  readonly is_trashed: boolean;
};

export type RawNamesetRow = {
  readonly id: string;
  readonly name: string;
  readonly config_json: unknown;
  readonly is_default: boolean;
  readonly is_trashed: boolean;
};

export type RawWorldRow = {
  readonly id: string;
  readonly name: string;
  readonly calendar_config_json: unknown;
  readonly naming_config_json: unknown;
  readonly npc_flavor_config_json: unknown;
  readonly fertility_chance: number;
  readonly food_consumption_per_citizen: number;
  readonly homelessness_decline_rate: number;
  readonly incest_prevention_depth: number;
  readonly maximum_fertility_age_turns: number | null;
  readonly minimum_partnership_age_turns: number;
  readonly mourning_period_turns: number;
  readonly partnership_seek_chance: number;
  readonly starvation_severity_multiplier: number;
  readonly water_consumption_per_citizen: number;
};

// Bundled fetch result passed to assemble()
export type WorldConfigData = {
  readonly world: RawWorldRow;
  readonly resources: readonly RawResourceRow[];
  readonly jobs: readonly RawJobRow[];
  readonly blueprints: readonly RawBlueprintRow[];
  readonly depositTypes: readonly RawDepositTypeRow[];
  readonly managedPopulationTypes: readonly RawManagedPopulationTypeRow[];
  readonly namesets: readonly RawNamesetRow[];
  readonly exportedAt: string;
};

// Structured template output (mirrors WorldTemplate from worldTemplateSchema.ts)
export type TierEffectOutput =
  | { readonly type: "job_capacity_increase"; readonly job_slug: string; readonly amount: number }
  | {
      readonly type: "passive_resource_production";
      readonly resource_slug: string;
      readonly amount: number;
    }
  | {
      readonly type: "resource_storage_increase";
      readonly resource_slug: string;
      readonly amount: number;
    }
  | { readonly type: "population_cap_increase"; readonly amount: number };

export type TierCostOutput = {
  readonly resource_slug: string;
  readonly amount: number;
};

export type TierOutput = {
  readonly tier_number: number;
  readonly worker_turns_required: number;
  readonly construction_costs: readonly TierCostOutput[];
  readonly upkeep_costs: readonly TierCostOutput[];
  readonly effects: readonly TierEffectOutput[];
};

export type JobIoOutput = {
  readonly resource_slug: string;
  readonly amount_per_worker: number;
  readonly notes?: string;
};

export type WorldTemplateOutput = {
  readonly template_version: 1;
  readonly meta: {
    readonly name: string;
    readonly slug: string;
    readonly exported_at: string;
  };
  readonly calendar: unknown;
  readonly population_rules: {
    readonly fertility_chance: number;
    readonly food_consumption_per_citizen: number;
    readonly homelessness_decline_rate: number;
    readonly incest_prevention_depth: number;
    readonly maximum_fertility_age_turns: number | null;
    readonly minimum_partnership_age_turns: number;
    readonly mourning_period_turns: number;
    readonly partnership_seek_chance: number;
    readonly starvation_severity_multiplier: number;
    readonly water_consumption_per_citizen: number;
  };
  readonly npc_flavor: unknown;
  readonly naming_config: unknown;
  readonly namesets: readonly {
    readonly name: string;
    readonly is_default: boolean;
    readonly config: unknown;
  }[];
  readonly resources: readonly {
    readonly name: string;
    readonly slug: string;
    readonly base_stockpile_cap: number;
    readonly decay_rate: number;
    readonly is_system_resource: boolean;
  }[];
  readonly jobs: readonly {
    readonly name: string;
    readonly slug: string;
    readonly job_type: string;
    readonly base_capacity: number | null;
    readonly trader_capacity_per_worker: number | null;
    readonly inputs: readonly JobIoOutput[];
    readonly outputs: readonly JobIoOutput[];
  }[];
  readonly blueprints: readonly {
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
    readonly max_instances_per_settlement: number | null;
    readonly grace_period_turns: number;
    readonly tiers: readonly TierOutput[];
  }[];
  readonly deposit_types: readonly {
    readonly name: string;
    readonly slug: string;
    readonly job_slug: string;
    readonly output_units_per_worker: number;
    readonly worker_inputs: readonly { readonly resource_slug: string; readonly amount_per_worker: number }[];
  }[];
  readonly managed_population_types: readonly {
    readonly name: string;
    readonly slug: string;
    readonly husbandry_job_slug: string;
    readonly culling_job_slug: string;
    readonly husbandry_workers_per_n_animals: number;
    readonly growth_rate: number;
    readonly maintenance_rules: readonly { readonly resource_slug: string; readonly amount_per_n_animals: number }[];
    readonly culling_outputs: readonly { readonly resource_slug: string; readonly amount_per_n_animals: number }[];
    readonly regular_outputs: readonly { readonly resource_slug: string; readonly amount_per_n_animals: number }[];
  }[];
};
