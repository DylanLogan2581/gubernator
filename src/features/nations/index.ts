// Nations feature — query and mutation API for world-scoped nations.
// Implemented in Epic 3.
export { NationDetailPage } from "./components/NationDetailPage";
export { NationDiscoveryConfigPanel } from "./components/NationDiscoveryConfigPanel";
export { useNationDetailContext } from "./components/NationDetailPage/NationDetailContext";
export { NationSectionRedirect } from "./components/NationDetailPage/NationSectionRedirect";
export { NationDeleteSection } from "./components/NationDetailPage/DeleteSection";
export { NationDetailsSection } from "./components/NationDetailPage/DetailsSection";
export { NationFlagSection } from "./components/NationDetailPage/FlagSection";
export { NationHiddenToggleSection } from "./components/NationDetailPage/HiddenToggleSection";
export { NationIdentitySection } from "./components/NationDetailPage/IdentitySection";
export { NationOfficesSection } from "./components/NationDetailPage/OfficesSection";
export { NationReportsSection } from "./components/NationDetailPage/NationReportsSection";
export { NationReadinessSection } from "./components/NationDetailPage/ReadinessSection";
export { NationRelationshipsSection } from "./components/NationDetailPage/RelationshipsSection";
export { NationRoleAssignmentSection } from "./components/NationDetailPage/RoleAssignmentSection";
export { NationSettlementsSection } from "./components/NationDetailPage/SettlementsSection";
export { NationTreasurySection } from "./components/NationDetailPage/TreasurySection";
export { NationFlagAvatar } from "./components/NationFlagAvatar";
export { NationListPage } from "./components/NationListPage";
export { NationOverviewCharts } from "./components/NationOverviewCharts";
export { NationOverviewStatTiles } from "./components/NationOverviewStatTiles";
export {
  NationMutationError,
  createNationMutationOptions,
  deleteNationMutationOptions,
  isNationMutationError,
  setNationCapitalAndFoundedTurnMutationOptions,
  setNationGovernmentTypeMutationOptions,
  setNationHiddenMutationOptions,
  updateNationDetailsMutationOptions,
} from "./mutations/nationsMutations";
export {
  appointNationOfficeMutationOptions,
  dismissNationOfficeMutationOptions,
} from "./mutations/officesMutations";
export {
  grantNationResourcesMutationOptions,
  setNationTaxRateMutationOptions,
  subsidizeConstructionProjectMutationOptions,
} from "./mutations/treasuryMutations";
export {
  nationFlagPath,
  removeNationFlagMutationOptions,
  uploadNationFlagMutationOptions,
} from "./mutations/nationImageMutations";
export {
  NationRelationshipMutationError,
  isNationRelationshipMutationError,
  proposeBilateralMutationOptions,
  respondToBilateralMutationOptions,
  setUnilateralStanceMutationOptions,
  withdrawFromBilateralMutationOptions,
} from "./mutations/nationRelationshipMutations";
export {
  nationByIdQueryOptions,
  nationSettlementsQueryOptions,
  nationsListQueryOptions,
} from "./queries/nationsQueries";
export { nationOfficesRosterQueryOptions } from "./queries/officesQueries";
export {
  nationActiveConstructionProjectsQueryOptions,
  nationLatestTaxSnapshotQueryOptions,
  nationStockpileQueryOptions,
} from "./queries/treasuryQueries";
export { nationOfficesQueryKeys } from "./queries/nationOfficesQueryKeys";
export { nationReadinessListQueryOptions } from "./queries/nationReadinessQueries";
export { nationReadinessQueryKeys } from "./queries/nationReadinessQueryKeys";
export { nationReadinessVotersQueryOptions } from "./queries/nationReadinessVotersQueries";
export { castNationReadinessVoteMutationOptions } from "./mutations/nationReadinessVoteMutations";
export {
  NATION_IMAGES_BUCKET,
  useNationImageSignedUrl,
} from "./queries/nationImageQueries";
export {
  nationRelationshipPairQueryOptions,
  nationRelationshipsFromNationQueryOptions,
  nationRelationshipsToNationQueryOptions,
} from "./queries/nationRelationshipQueries";
export { nationDiscoveriesQueryOptions } from "./queries/nationDiscoveryQueries";
export { nationsQueryKeys } from "./queries/nationsQueryKeys";
export {
  setNationsMetMutationOptions,
  setNationsUnmetMutationOptions,
} from "./mutations/nationDiscoveryMutations";
export {
  createNationInputSchema,
  deleteNationInputSchema,
  setNationCapitalAndFoundedTurnInputSchema,
  setNationGovernmentTypeInputSchema,
  setNationHiddenInputSchema,
  updateNationDetailsInputSchema,
} from "./schemas/nationSchemas";
export {
  proposeBilateralInputSchema,
  respondToBilateralInputSchema,
  setUnilateralStanceInputSchema,
  withdrawFromBilateralInputSchema,
} from "./schemas/nationRelationshipSchemas";

export type {
  CreateNationInput,
  CreateNationValues,
  DeleteNationInput,
  DeleteNationValues,
  SetNationCapitalAndFoundedTurnInput,
  SetNationCapitalAndFoundedTurnValues,
  SetNationGovernmentTypeInput,
  SetNationGovernmentTypeValues,
  SetNationHiddenInput,
  SetNationHiddenValues,
  UpdateNationDetailsInput,
  UpdateNationDetailsValues,
} from "./schemas/nationSchemas";
export type {
  ProposeBilateralInput,
  ProposeBilateralValues,
  RespondToBilateralInput,
  RespondToBilateralValues,
  SetUnilateralStanceInput,
  SetUnilateralStanceValues,
  WithdrawFromBilateralInput,
  WithdrawFromBilateralValues,
} from "./schemas/nationRelationshipSchemas";
export type { DeleteNationResult } from "./mutations/nationsMutations";
export type {
  AppointNationOfficeInput,
  DismissNationOfficeInput,
} from "./mutations/officesMutations";
export {
  formatNationOfficeType,
  type NationOfficeRosterEntry,
} from "./types/nationOfficeTypes";
export type { NationRelationshipMutationIssue } from "./mutations/nationRelationshipMutations";
export {
  NATION_GOVERNMENT_TYPES,
  formatNationGovernmentType,
} from "./types/nationTypes";
export type {
  Nation,
  NationActiveConstructionProject,
  NationConstructionProjectCost,
  NationGovernmentType,
  NationLatestTaxSnapshot,
  NationSettlement,
  NationStockpileEntry,
} from "./types/nationTypes";
export type {
  GrantNationResourcesInput,
  GrantNationResourcesResult,
  SetNationTaxRateInput,
  SubsidizeConstructionProjectInput,
  SubsidizeConstructionProjectLineResult,
} from "./mutations/treasuryMutations";
export type {
  NationReadinessListItem,
  NationReadinessMode,
  NationReadinessVoter,
} from "./types/nationReadinessTypes";
export type {
  CastNationReadinessVoteInput,
  CastNationReadinessVoteResult,
} from "./mutations/nationReadinessVoteMutations";
export {
  formatNationReadinessVoteProgress,
  getBlockingNations,
  getReadinessVoterLabel,
  isNationReadinessBlocking,
} from "./utils/nationReadinessSummary";
export type {
  NationBilateralResponse,
  NationBilateralStance,
  NationRelationship,
  NationRelationshipPendingStatus,
  NationRelationshipStance,
  NationUnilateralStance,
} from "./types/nationRelationshipTypes";
export type { NationDiscoveryPair } from "./types/nationTypes";
export type {
  SetNationsMetInput,
  SetNationsUnmetInput,
} from "./mutations/nationDiscoveryMutations";
