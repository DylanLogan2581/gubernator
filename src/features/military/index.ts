// Military feature — Epic 13 foundation: world-admin-defined unit types
// (levy, spearman, knight...) with costs, upkeep, desertion rate, and
// recruitment requirements. Extended (#1112) with per-nation armies, a
// free-form group/unit organization tree, and recruit/discharge soldiers.

export { MilitaryConfigPanel } from "./components/MilitaryConfigPanel";
export { NationMilitarySection } from "./components/NationMilitarySection";
export {
  createUnitTypeMutationOptions,
  deleteUnitTypeMutationOptions,
  isUnitTypeMutationError,
  UnitTypeMutationError,
  updateUnitTypeMutationOptions,
} from "./mutations/unitTypesMutations";
export {
  ArmyMutationError,
  createArmyMutationOptions,
  deleteArmyMutationOptions,
  isArmyMutationError,
  moveArmyMutationOptions,
  renameArmyMutationOptions,
} from "./mutations/armiesMutations";
export {
  ArmyTreeMutationError,
  createArmyGroupMutationOptions,
  createArmyUnitMutationOptions,
  deleteArmyGroupMutationOptions,
  deleteArmyUnitMutationOptions,
  isArmyTreeMutationError,
  moveArmyGroupMutationOptions,
  moveArmyUnitMutationOptions,
  renameArmyGroupMutationOptions,
  renameArmyUnitMutationOptions,
} from "./mutations/armyTreeMutations";
export {
  dischargeSoldiersMutationOptions,
  isRecruitmentMutationError,
  recruitSoldiersMutationOptions,
  RecruitmentMutationError,
} from "./mutations/recruitmentMutations";
export { unitTypesByWorldQueryOptions } from "./queries/unitTypesQueries";
export { unitTypesQueryKeys } from "./queries/unitTypesQueryKeys";
export {
  armiesByNationQueryOptions,
  armyGroupsByArmyQueryOptions,
  armyLatestSnapshotsQueryOptions,
  armySoldierCountsQueryOptions,
  armyUnitsByArmyQueryOptions,
  soldierCitizenIdsByWorldQueryOptions,
  unitSoldiersByUnitQueryOptions,
} from "./queries/armiesQueries";
export { armiesQueryKeys } from "./queries/armiesQueryKeys";
export {
  createUnitTypeInputSchema,
  deleteUnitTypeInputSchema,
  updateUnitTypeInputSchema,
} from "./schemas/unitTypeSchemas";
export {
  createArmyInputSchema,
  deleteArmyInputSchema,
  moveArmyInputSchema,
  renameArmyInputSchema,
} from "./schemas/armySchemas";
export {
  createArmyGroupInputSchema,
  createArmyUnitInputSchema,
  deleteArmyGroupInputSchema,
  deleteArmyUnitInputSchema,
  moveArmyGroupInputSchema,
  moveArmyUnitInputSchema,
  renameArmyGroupInputSchema,
  renameArmyUnitInputSchema,
} from "./schemas/armyTreeSchemas";
export {
  dischargeSoldiersInputSchema,
  recruitSoldiersInputSchema,
} from "./schemas/recruitmentSchemas";
export {
  classifyRecruitCandidate,
  computeRecruitCostShortfalls,
  formatRecruitIneligibilityReason,
} from "./utils/recruitEligibility";
export { formatArmyFundingSource } from "./types/armyTypes";

export type { UnitTypeMutationIssue } from "./mutations/unitTypesMutations";
export type {
  ArmyMutationIssue,
  DeleteArmyResult,
} from "./mutations/armiesMutations";
export type {
  ArmyTreeMutationIssue,
  DeleteArmyGroupResult,
  DeleteArmyUnitResult,
} from "./mutations/armyTreeMutations";
export type {
  DischargeSoldiersResult,
  RecruitmentMutationIssue,
} from "./mutations/recruitmentMutations";
export type {
  CreateUnitTypeInput,
  CreateUnitTypeValues,
  DeleteUnitTypeInput,
  DeleteUnitTypeValues,
  UpdateUnitTypeInput,
  UpdateUnitTypeValues,
} from "./schemas/unitTypeSchemas";
export type {
  CreateArmyInput,
  CreateArmyValues,
  DeleteArmyInput,
  DeleteArmyValues,
  MoveArmyInput,
  MoveArmyValues,
  RenameArmyInput,
  RenameArmyValues,
} from "./schemas/armySchemas";
export type {
  CreateArmyGroupInput,
  CreateArmyGroupValues,
  CreateArmyUnitInput,
  CreateArmyUnitValues,
  DeleteArmyGroupInput,
  DeleteArmyGroupValues,
  DeleteArmyUnitInput,
  DeleteArmyUnitValues,
  MoveArmyGroupInput,
  MoveArmyGroupValues,
  MoveArmyUnitInput,
  MoveArmyUnitValues,
  RenameArmyGroupInput,
  RenameArmyGroupValues,
  RenameArmyUnitInput,
  RenameArmyUnitValues,
} from "./schemas/armyTreeSchemas";
export type {
  DischargeSoldiersInput,
  DischargeSoldiersValues,
  RecruitSoldiersInput,
  RecruitSoldiersValues,
} from "./schemas/recruitmentSchemas";
export type { DeleteUnitTypeResult, UnitType } from "./types/unitTypeTypes";
export type {
  Army,
  ArmyFundingSource,
  ArmyGroup,
  ArmyTurnSnapshot,
  ArmyUnit,
  UnitSoldier,
} from "./types/armyTypes";
export type {
  RecruitCandidateCitizen,
  RecruitCostShortfall,
  RecruitIneligibilityReason,
} from "./utils/recruitEligibility";
