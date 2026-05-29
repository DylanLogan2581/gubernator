import { z } from "zod";

const probabilitySchema = z.number().min(0).max(1);
const nonnegativeIntegerSchema = z.number().int().nonnegative();
const nonnegativeDecimalSchema = z.number().nonnegative();

export const worldPopulationRulesSchema = z.object({
  fertility_chance: probabilitySchema,
  food_consumption_per_citizen: nonnegativeDecimalSchema,
  homelessness_decline_rate: nonnegativeDecimalSchema,
  incest_prevention_depth: z.number().int().min(0).max(10),
  maximum_fertility_age_turns: nonnegativeIntegerSchema.nullable(),
  minimum_partnership_age_turns: nonnegativeIntegerSchema,
  mourning_period_turns: nonnegativeIntegerSchema,
  partnership_seek_chance: probabilitySchema,
  starvation_severity_multiplier: nonnegativeDecimalSchema,
  water_consumption_per_citizen: nonnegativeDecimalSchema,
});

export type WorldPopulationRules = z.infer<typeof worldPopulationRulesSchema>;
