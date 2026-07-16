import { z } from "zod";

import { worldNamingConfigSchema } from "@/lib/worldNamingConfigSchemas";

// ── primitives ───────────────────────────────────────────────────────────

const nonnegativeInteger = z.number().int().min(0);
const probability = z.number().min(0).max(1);
const nonnegativeDecimal = z.number().min(0);
const positiveInteger = z.number().int().positive();
const nameRef = z.string().nullable().default(null);
const iconRef = z.string().nullable().default(null);
const colorHex = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "must be a #rrggbb hex color");

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
  shortDateFormatTemplate: z.string().optional(),
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

// ── resource categories ───────────────────────────────────────────────────

const resourceCategoryTemplateSchema = z.object({
  name: z.string().min(1),
  color: colorHex,
  sort_order: z.number().int(),
});

// ── education levels ──────────────────────────────────────────────────────

const educationLevelTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  rank: z.number().int(),
  natural_born_percent: z.number().min(0).max(100),
});

const educationLevelsTemplateSchema = z
  .array(educationLevelTemplateSchema)
  .superRefine((levels, ctx) => {
    const seenRanks = new Set<number>();
    for (const level of levels) {
      if (seenRanks.has(level.rank)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate education level rank ${level.rank}`,
        });
      }
      seenRanks.add(level.rank);
    }

    const totalPercent = levels.reduce(
      (sum, level) => sum + level.natural_born_percent,
      0,
    );
    if (totalPercent > 100) {
      ctx.addIssue({
        code: "custom",
        message: "natural_born_percent values sum to more than 100",
      });
    }
  });

// ── cultures & religions ──────────────────────────────────────────────────

const cultureTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  color: colorHex,
});

const religionTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  color: colorHex,
});

// ── resources ─────────────────────────────────────────────────────────────

const resourceTemplateSchema = z.object({
  name: z.string(),
  slug: z.string(),
  base_stockpile_cap: z.number(),
  change_amount: z.number(),
  change_mode: z.enum(["percent", "flat"]),
  is_system_resource: z.boolean(),
  icon: iconRef,
  category: nameRef,
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
  icon: iconRef,
  required_education_level: nameRef,
});

// ── buildings ─────────────────────────────────────────────────────────────

const tierCostEntryTemplateSchema = z.object({
  resource_slug: z.string(),
  amount: z.number(),
});

const educationTierLevelTemplateSchema = z.object({
  from_level: nameRef,
  to_level: z.string(),
  turns: positiveInteger,
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
  z.object({
    type: z.literal("education"),
    teacher_job_slug: z.string(),
    teacher_capacity: positiveInteger,
    students_per_teacher: positiveInteger,
    levels: z.array(educationTierLevelTemplateSchema).min(1),
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
  icon: iconRef,
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
  icon: iconRef,
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
  icon: iconRef,
});

// ── unit types ────────────────────────────────────────────────────────────

const unitTypeCostEntryTemplateSchema = z.object({
  resource_slug: z.string(),
  amount: z.number(),
});

const unitTypeRequiredBuildingTemplateSchema = z.object({
  blueprint_slug: z.string(),
  tier_number: positiveInteger,
});

const unitTypeTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  soldiers_per_unit: positiveInteger,
  required_education_level: nameRef,
  required_building: unitTypeRequiredBuildingTemplateSchema.nullable(),
  recruitment_costs: z.array(unitTypeCostEntryTemplateSchema),
  upkeep_costs: z.array(unitTypeCostEntryTemplateSchema),
  desertion_rate: probability,
});

// ── world template ────────────────────────────────────────────────────────

export const WORLD_TEMPLATE_VERSION = 2 as const;

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
  resource_categories: z.array(resourceCategoryTemplateSchema).default([]),
  education_levels: educationLevelsTemplateSchema.default([]),
  cultures: z.array(cultureTemplateSchema).default([]),
  religions: z.array(religionTemplateSchema).default([]),
  resources: z.array(resourceTemplateSchema),
  jobs: z.array(jobTemplateSchema),
  blueprints: z.array(blueprintTemplateSchema),
  deposit_types: z.array(depositTypeTemplateSchema),
  managed_population_types: z.array(managedPopulationTypeTemplateSchema),
  unit_types: z.array(unitTypeTemplateSchema).default([]),
});

export type WorldTemplate = z.infer<typeof worldTemplateSchema>;
