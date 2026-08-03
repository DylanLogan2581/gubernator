import { useState } from "react";

import type { EducationLevel } from "@/features/education";
import type { JobDefinition } from "@/features/jobs";
import type { Resource } from "@/features/resources";

import {
  createTierInputSchema,
  type TierCostEntryInput,
  type TierEffectInput,
} from "../schemas/buildingSchemas";
import {
  buildCostInputs,
  buildEffectInputs,
  extractFieldErrors,
  extractRefErrors,
  type CostRowState,
  type EffectRowState,
  type TierFormErrors,
} from "../utils/tierEditorUtils";
import { validateBlueprintTierReferencesAgainstWorld } from "../utils/validateBuildingReferences";

export type TierDraftFormState = {
  tierNumber: string;
  workerTurns: string;
  constructionCosts: CostRowState[];
  upkeepCosts: CostRowState[];
  effects: EffectRowState[];
};

export type TierDraftFormData = {
  tierNumber: number;
  workerTurnsRequired?: number;
  constructionCostsJson?: TierCostEntryInput[];
  upkeepCostsJson?: TierCostEntryInput[];
  effectsJson?: TierEffectInput[];
};

/**
 * Form state for a blueprint-tier draft. `initial` seeds the state on mount
 * (omitted fields fall back to the empty defaults); it is not re-read on later
 * renders, so callers that need a reset per entity must remount (e.g. via a
 * React `key`).
 */
export function useTierDraftForm(initial?: Partial<TierDraftFormState>): {
  tierNumber: string;
  setTierNumber: (value: string) => void;
  workerTurns: string;
  setWorkerTurns: (value: string) => void;
  constructionCosts: CostRowState[];
  setConstructionCosts: (rows: CostRowState[]) => void;
  upkeepCosts: CostRowState[];
  setUpkeepCosts: (rows: CostRowState[]) => void;
  effects: EffectRowState[];
  setEffects: (rows: EffectRowState[]) => void;
  fieldErrors: TierFormErrors;
  setFieldErrors: (errors: TierFormErrors) => void;
  validate: (
    activeResources: readonly Resource[],
    activeJobs: readonly JobDefinition[],
    activeEducationLevels: readonly EducationLevel[],
  ) => TierDraftFormData | null;
} {
  const [tierNumber, setTierNumber] = useState(initial?.tierNumber ?? "");
  const [workerTurns, setWorkerTurns] = useState(initial?.workerTurns ?? "0");
  const [constructionCosts, setConstructionCosts] = useState<CostRowState[]>(
    initial?.constructionCosts ?? [],
  );
  const [upkeepCosts, setUpkeepCosts] = useState<CostRowState[]>(
    initial?.upkeepCosts ?? [],
  );
  const [effects, setEffects] = useState<EffectRowState[]>(
    initial?.effects ?? [],
  );
  const [fieldErrors, setFieldErrors] = useState<TierFormErrors>({});

  function validate(
    activeResources: readonly Resource[],
    activeJobs: readonly JobDefinition[],
    activeEducationLevels: readonly EducationLevel[],
  ): TierDraftFormData | null {
    setFieldErrors({});

    const constructionCostInputs = buildCostInputs(constructionCosts);
    const upkeepCostInputs = buildCostInputs(upkeepCosts);
    const effectInputs = buildEffectInputs(effects);

    const draftInput = {
      constructionCostsJson:
        constructionCostInputs.length > 0 ? constructionCostInputs : undefined,
      effectsJson: effectInputs.length > 0 ? effectInputs : undefined,
      tierNumber: tierNumber !== "" ? parseInt(tierNumber, 10) : 0,
      upkeepCostsJson:
        upkeepCostInputs.length > 0 ? upkeepCostInputs : undefined,
      workerTurnsRequired:
        workerTurns !== "" ? parseInt(workerTurns, 10) : undefined,
    };

    const parseResult = createTierInputSchema
      .omit({ blueprintId: true })
      .safeParse(draftInput);
    if (!parseResult.success) {
      setFieldErrors(extractFieldErrors(parseResult.error.issues));
      return null;
    }

    const refIssues = validateBlueprintTierReferencesAgainstWorld(
      {
        constructionCostsJson: constructionCostInputs,
        effectsJson: effectInputs,
        upkeepCostsJson: upkeepCostInputs,
      },
      activeResources,
      activeJobs,
      activeEducationLevels,
    );
    if (refIssues.length > 0) {
      setFieldErrors(extractRefErrors(refIssues));
      return null;
    }

    return {
      constructionCostsJson: parseResult.data.constructionCostsJson,
      effectsJson: parseResult.data.effectsJson,
      tierNumber: parseResult.data.tierNumber,
      upkeepCostsJson: parseResult.data.upkeepCostsJson,
      workerTurnsRequired: parseResult.data.workerTurnsRequired,
    };
  }

  return {
    tierNumber,
    setTierNumber,
    workerTurns,
    setWorkerTurns,
    constructionCosts,
    setConstructionCosts,
    upkeepCosts,
    setUpkeepCosts,
    effects,
    setEffects,
    fieldErrors,
    setFieldErrors,
    validate,
  };
}
