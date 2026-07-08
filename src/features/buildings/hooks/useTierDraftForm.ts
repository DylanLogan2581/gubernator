import { useState } from "react";

import type { EducationLevel } from "@/features/education";
import type { JobDefinition } from "@/features/jobs";
import type { Resource } from "@/features/resources";

import {
  createTierInputSchema,
  type TierCostEntryInput,
  type TierEducationConfigInput,
  type TierEffectInput,
} from "../schemas/buildingSchemas";
import {
  buildCostInputs,
  buildEducationConfigInput,
  buildEffectInputs,
  extractFieldErrors,
  extractRefErrors,
  type CostRowState,
  type EducationConfigRowState,
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
  educationConfig: EducationConfigRowState;
};

export type TierDraftFormData = {
  tierNumber: number;
  workerTurnsRequired?: number;
  constructionCostsJson?: TierCostEntryInput[];
  upkeepCostsJson?: TierCostEntryInput[];
  effectsJson?: TierEffectInput[];
  educationConfigJson: TierEducationConfigInput | null;
};

export function useTierDraftForm(): {
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
  educationConfig: EducationConfigRowState;
  setEducationConfig: (config: EducationConfigRowState) => void;
  fieldErrors: TierFormErrors;
  setFieldErrors: (errors: TierFormErrors) => void;
  validate: (
    activeResources: readonly Resource[],
    activeJobs: readonly JobDefinition[],
    activeEducationLevels: readonly EducationLevel[],
  ) => TierDraftFormData | null;
} {
  const [tierNumber, setTierNumber] = useState("");
  const [workerTurns, setWorkerTurns] = useState("0");
  const [constructionCosts, setConstructionCosts] = useState<CostRowState[]>(
    [],
  );
  const [upkeepCosts, setUpkeepCosts] = useState<CostRowState[]>([]);
  const [effects, setEffects] = useState<EffectRowState[]>([]);
  const [educationConfig, setEducationConfig] =
    useState<EducationConfigRowState>({
      isSchool: false,
      studentCapacity: "",
      studentsPerTeacher: "",
      teacherJobId: "",
      teachesUpToLevelId: "",
      turnsPerLevel: "",
    });
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
    const educationConfigInput = buildEducationConfigInput(educationConfig);

    const draftInput = {
      constructionCostsJson:
        constructionCostInputs.length > 0 ? constructionCostInputs : undefined,
      educationConfigJson: educationConfigInput,
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
        educationConfigJson: educationConfigInput,
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
      educationConfigJson: parseResult.data.educationConfigJson ?? null,
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
    educationConfig,
    setEducationConfig,
    fieldErrors,
    setFieldErrors,
    validate,
  };
}
