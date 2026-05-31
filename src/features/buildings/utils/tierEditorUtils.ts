import { generateLocalId } from "@/lib/uid";

import type {
  TierCostEntryInput,
  TierEffectInput,
} from "../schemas/buildingSchemas";
import type { TierCostEntry, TierEffect } from "../types/buildingTypes";

export type CostRowState = {
  id: string;
  resourceId: string;
  amount: string;
};

export type EffectRowState = {
  id: string;
  effectType: string;
  jobId: string;
  resourceId: string;
  amount: string;
};

export type TierFormErrors = {
  blueprintId?: string;
  constructionCostsJson?: string;
  effectsJson?: string;
  tierNumber?: string;
  upkeepCostsJson?: string;
  workerTurnsRequired?: string;
};

export function buildCostInputs(
  rows: readonly CostRowState[],
): TierCostEntryInput[] {
  return rows.map((r) => ({
    amount: r.amount !== "" ? parseFloat(r.amount) : 0,
    resourceId: r.resourceId,
  }));
}

export function buildEffectInputs(
  rows: readonly EffectRowState[],
): TierEffectInput[] {
  const result: TierEffectInput[] = [];
  for (const r of rows) {
    const amount = r.amount !== "" ? parseFloat(r.amount) : 0;
    if (r.effectType === "job_capacity_increase") {
      result.push({ amount, jobId: r.jobId, type: "job_capacity_increase" });
    } else if (r.effectType === "passive_resource_production") {
      result.push({
        amount,
        resourceId: r.resourceId,
        type: "passive_resource_production",
      });
    } else if (r.effectType === "resource_storage_increase") {
      result.push({
        amount,
        resourceId: r.resourceId,
        type: "resource_storage_increase",
      });
    } else if (r.effectType === "population_cap_increase") {
      result.push({ amount, type: "population_cap_increase" });
    }
  }
  return result;
}

export function tierCostsToState(
  costs: readonly TierCostEntry[],
): CostRowState[] {
  return costs.map((c) => ({
    amount: String(c.amount),
    id: generateLocalId(),
    resourceId: c.resourceId,
  }));
}

export function tierEffectsToState(
  effects: readonly TierEffect[],
): EffectRowState[] {
  return effects.map((e) => {
    const base = { amount: String(e.amount), id: generateLocalId() };
    switch (e.type) {
      case "job_capacity_increase":
        return {
          ...base,
          effectType: "job_capacity_increase",
          jobId: e.jobId,
          resourceId: "",
        };
      case "passive_resource_production":
        return {
          ...base,
          effectType: "passive_resource_production",
          jobId: "",
          resourceId: e.resourceId,
        };
      case "resource_storage_increase":
        return {
          ...base,
          effectType: "resource_storage_increase",
          jobId: "",
          resourceId: e.resourceId,
        };
      case "population_cap_increase":
        return {
          ...base,
          effectType: "population_cap_increase",
          jobId: "",
          resourceId: "",
        };
    }
  });
}

export function extractFieldErrors(
  issues: Array<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): TierFormErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const first = issue.path[0];
    const field =
      typeof first === "string" || typeof first === "number"
        ? String(first)
        : "";
    if (field !== "" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export function extractRefErrors(
  issues: readonly { field: string; message: string }[],
): TierFormErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.field in errors)) {
      errors[issue.field] = issue.message;
    }
  }
  return errors;
}
