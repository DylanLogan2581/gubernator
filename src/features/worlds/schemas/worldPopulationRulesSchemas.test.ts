import { describe, expect, it } from "vitest";

import { worldPopulationRulesSchema } from "./worldPopulationRulesSchemas";

const validConfig = {
  fertility_chance: 0.3,
  food_consumption_per_citizen: 1.5,
  homelessness_decline_rate: 0.1,
  incest_prevention_depth: 3,
  maximum_fertility_age_turns: 800,
  minimum_partnership_age_turns: 200,
  mourning_period_turns: 100,
  partnership_seek_chance: 0.5,
  starvation_severity_multiplier: 1.0,
  water_consumption_per_citizen: 0.75,
};

describe("worldPopulationRulesSchema", () => {
  it("accepts a valid config with all required fields", () => {
    const result = worldPopulationRulesSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
  });

  it("accepts maximum_fertility_age_turns as null", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      maximum_fertility_age_turns: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts fertility_chance at boundary values 0 and 1", () => {
    for (const chance of [0, 1]) {
      const result = worldPopulationRulesSchema.safeParse({
        ...validConfig,
        fertility_chance: chance,
      });

      expect(result.success).toBe(true);
    }
  });

  it("accepts zero for all nonnegative decimal fields", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      food_consumption_per_citizen: 0,
      homelessness_decline_rate: 0,
      starvation_severity_multiplier: 0,
      water_consumption_per_citizen: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects fertility_chance greater than 1", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      fertility_chance: 1.01,
    });

    expect(result.success).toBe(false);
  });

  it("rejects fertility_chance less than 0", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      fertility_chance: -0.01,
    });

    expect(result.success).toBe(false);
  });

  it("rejects partnership_seek_chance greater than 1", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      partnership_seek_chance: 1.1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects partnership_seek_chance less than 0", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      partnership_seek_chance: -0.1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects incest_prevention_depth greater than 10", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      incest_prevention_depth: 11,
    });

    expect(result.success).toBe(false);
  });

  it("rejects incest_prevention_depth less than 0", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      incest_prevention_depth: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer incest_prevention_depth", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      incest_prevention_depth: 3.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative food_consumption_per_citizen", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      food_consumption_per_citizen: -0.1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative water_consumption_per_citizen", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      water_consumption_per_citizen: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative homelessness_decline_rate", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      homelessness_decline_rate: -0.05,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative starvation_severity_multiplier", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      starvation_severity_multiplier: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer minimum_partnership_age_turns", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      minimum_partnership_age_turns: 100.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer mourning_period_turns", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      mourning_period_turns: 50.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative maximum_fertility_age_turns when not null", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      maximum_fertility_age_turns: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer maximum_fertility_age_turns when not null", () => {
    const result = worldPopulationRulesSchema.safeParse({
      ...validConfig,
      maximum_fertility_age_turns: 800.5,
    });

    expect(result.success).toBe(false);
  });
});
