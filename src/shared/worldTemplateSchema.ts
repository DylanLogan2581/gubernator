import { z } from "zod";

import { worldNamingConfigSchema } from "@/lib/worldNamingConfigSchemas";

// ── primitives ───────────────────────────────────────────────────────────

const nonnegativeInteger = z.number().int().min(0);
const probability = z.number().min(0).max(1);
const nonnegativeDecimal = z.number().min(0);

// ── calendar ─────────────────────────────────────────────────────────────

const calendarMonthSchema = z.object({
  dayCount: z.number().int().positive(),
  index: z.number().int().min(0),
  name: z.string().min(1),
});

const calendarWeekdaySchema = z.object({
  index: z.number().int().min(0),
  name: z.string().min(1),
});

const calendarConfigTemplateSchema = z.object({
  dateFormatTemplate: z.string(),
  months: z.array(calendarMonthSchema).min(1),
  startingDayOfMonth: z.number().int().positive(),
  startingMonthIndex: z.number().int().min(0),
  startingWeekdayOffset: z.number().int().min(0),
  startingYear: z.number().int(),
  weekdays: z.array(calendarWeekdaySchema).min(1),
});

// ── population rules ──────────────────────────────────────────────────────

const populationRulesTemplateSchema = z.object({
  fertility_chance: probability,
  food_consumption_per_citizen: nonnegativeDecimal,
  homelessness_decline_rate: nonnegativeDecimal,
  incest_prevention_depth: z.number().int().min(0).max(10),
  maximum_fertility_age_turns: nonnegativeInteger.nullable(),
  minimum_partnership_age_turns: nonnegativeInteger,
  mourning_period_turns: nonnegativeInteger,
  partnership_seek_chance: probability,
  starvation_severity_multiplier: nonnegativeDecimal,
  water_consumption_per_citizen: nonnegativeDecimal,
});

// ── NPC flavor ────────────────────────────────────────────────────────────

const poolSchema = z.array(z.string());

const npcFlavorTemplateSchema = z.object({
  contradictions: poolSchema,
  flaws: poolSchema,
  goals: poolSchema,
  traits: poolSchema,
});

// ── namesets ──────────────────────────────────────────────────────────────

const namesetTemplateSchema = z.object({
  name: z.string(),
  is_default: z.boolean(),
  config: worldNamingConfigSchema,
});

// ── resources ─────────────────────────────────────────────────────────────

const resourceTemplateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  base_stockpile_cap: z.number(),
  decay_rate: z.number(),
  is_system_resource: z.boolean(),
});

// ── jobs ──────────────────────────────────────────────────────────────────

const jobIoEntryTemplateSchema = z.object({
  resource_slug: z.string(),
  amount_per_worker: z.number(),
  notes: z.string().optional(),
});

const jobTemplateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  job_type: z.string(),
  base_capacity: z.number().nullable(),
  trader_capacity_per_worker: z.number().nullable(),
  inputs: z.array(jobIoEntryTemplateSchema),
  outputs: z.array(jobIoEntryTemplateSchema),
});

// ── buildings ─────────────────────────────────────────────────────────────

const tierCostEntryTemplateSchema = z.object({
  resource_slug: z.string(),
  amount: z.number(),
});

const tierEffectTemplateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("job_capacity_increase"),
    job_slug: z.string(),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("passive_resource_production"),
    resource_slug: z.string(),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("resource_storage_increase"),
    resource_slug: z.string(),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("population_cap_increase"),
    amount: z.number(),
  }),
]);

const blueprintTierTemplateSchema = z.object({
  tier_number: z.number().int().positive(),
  worker_turns_required: z.number(),
  construction_costs: z.array(tierCostEntryTemplateSchema),
  upkeep_costs: z.array(tierCostEntryTemplateSchema),
  effects: z.array(tierEffectTemplateSchema),
});

const blueprintTemplateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  max_instances_per_settlement: z.number().nullable(),
  grace_period_turns: z.number(),
  tiers: z.array(blueprintTierTemplateSchema),
});

// ── deposit types ─────────────────────────────────────────────────────────

const workerInputEntryTemplateSchema = z.object({
  resource_slug: z.string(),
  amount_per_worker: z.number(),
});

const depositTypeTemplateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  job_slug: z.string(),
  output_units_per_worker: z.number(),
  worker_inputs: z.array(workerInputEntryTemplateSchema),
});

// ── managed population types ──────────────────────────────────────────────

const populationResourceEntryTemplateSchema = z.object({
  resource_slug: z.string(),
  amount_per_n_animals: z.number(),
});

const managedPopulationTypeTemplateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  husbandry_job_slug: z.string(),
  culling_job_slug: z.string(),
  husbandry_workers_per_n_animals: z.number(),
  growth_rate: z.number(),
  maintenance_rules: z.array(populationResourceEntryTemplateSchema),
  culling_outputs: z.array(populationResourceEntryTemplateSchema),
  regular_outputs: z.array(populationResourceEntryTemplateSchema),
});

// ── world template ────────────────────────────────────────────────────────

export const WORLD_TEMPLATE_VERSION = 1 as const;

export const worldTemplateSchema = z.object({
  template_version: z.literal(WORLD_TEMPLATE_VERSION),
  meta: z.object({
    name: z.string(),
    slug: z.string(),
    exported_at: z.string(),
  }),
  calendar: calendarConfigTemplateSchema,
  population_rules: populationRulesTemplateSchema,
  npc_flavor: npcFlavorTemplateSchema,
  naming_config: worldNamingConfigSchema,
  namesets: z.array(namesetTemplateSchema),
  resources: z.array(resourceTemplateSchema),
  jobs: z.array(jobTemplateSchema),
  blueprints: z.array(blueprintTemplateSchema),
  deposit_types: z.array(depositTypeTemplateSchema),
  managed_population_types: z.array(managedPopulationTypeTemplateSchema),
});

export type WorldTemplate = z.infer<typeof worldTemplateSchema>;
