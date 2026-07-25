// Nations feature — query and mutation API for world-scoped nations.
// Implemented in Epic 3.
export { NationDetailPage } from "./components/NationDetailPage";
export { NationDiscoveryConfigPanel } from "./components/NationDiscoveryConfigPanel";
export { useNationDetailContext } from "./components/NationDetailPage/NationDetailContext";
export { NationSectionRedirect } from "./components/NationDetailPage/NationSectionRedirect";
export { NationDeleteSection } from "./components/NationDetailPage/DeleteSection";
export { NationDetailsSection } from "./components/NationDetailPage/DetailsSection";
export { NationFlagSection } from "./components/NationDetailPage/FlagSection";
export { NationSealSection } from "./components/NationDetailPage/SealSection";
export {
  NationIdentitySection,
  formatFoundedTurn,
} from "./components/NationDetailPage/IdentitySection";
export { NationCultureReligionSection } from "./components/NationDetailPage/CultureReligionSection";
export { NationBankSection } from "./components/NationDetailPage/BankSection";
export { NationCharterPage } from "./components/NationCharterPage";
export { NationOfficesSection } from "./components/NationDetailPage/OfficesSection";
export { OfficesSection } from "./components/offices/OfficesSectionCore";
export { NationReportsSection } from "./components/NationDetailPage/NationReportsSection";
export { NationReadinessSection } from "./components/NationDetailPage/ReadinessSection";
export { NationRelationshipsSection } from "./components/NationDetailPage/RelationshipsSection";
export { NationRoleAssignmentSection } from "./components/NationDetailPage/RoleAssignmentSection";
export { NationSettlementsSection } from "./components/NationDetailPage/SettlementsSection";
export { NationTradePolicySection } from "./components/NationDetailPage/TradePolicySection";
export { NationTreasurySection } from "./components/NationDetailPage/TreasurySection";
export { NationFlagAvatar } from "./components/NationFlagAvatar";
export { NationSealAvatar } from "./components/NationSealAvatar";
export { NationListPage } from "./components/NationListPage";
export { NationOverviewCharts } from "./components/NationOverviewCharts";
export { NationOverviewStatTiles } from "./components/NationOverviewStatTiles";
export {
  NationMutationError,
  createNationMutationOptions,
  deleteNationMutationOptions,
  isNationMutationError,
  setNationCapitalAndFoundedTurnMutationOptions,
  setNationCultureReligionMutationOptions,
  setNationGovernmentTypeMutationOptions,
  setNationTradePolicyMutationOptions,
  updateNationDetailsMutationOptions,
} from "./mutations/nationsMutations";
export {
  appointNationOfficeMutationOptions,
  appointSettlementOfficeMutationOptions,
  dismissNationOfficeMutationOptions,
  dismissSettlementOfficeMutationOptions,
  renewNationOfficeMutationOptions,
  renewSettlementOfficeMutationOptions,
} from "./mutations/officesMutations";
export {
  createOfficeTypeMutationOptions,
  deleteOfficeTypeMutationOptions,
  isOfficeTypeMutationError,
  OfficeTypeMutationError,
  updateOfficeTypeMutationOptions,
} from "./mutations/officeTypesMutations";
export {
  grantNationResourcesMutationOptions,
  setNationTaxRateMutationOptions,
  subsidizeConstructionProjectMutationOptions,
} from "./mutations/treasuryMutations";
export {
  burnCurrencyMutationOptions,
  depositReservesMutationOptions,
  establishNationCurrencyMutationOptions,
  mintCurrencyMutationOptions,
  redeemReservesMutationOptions,
} from "./mutations/currencyMutations";
export {
  nationFlagPath,
  nationSealPath,
  removeNationFlagMutationOptions,
  removeNationSealMutationOptions,
  uploadNationFlagMutationOptions,
  uploadNationSealMutationOptions,
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
  NationTreatyMutationError,
  breakTreatyMutationOptions,
  isNationTreatyMutationError,
  proposeTreatyMutationOptions,
  respondToTreatyMutationOptions,
  withdrawTreatyMutationOptions,
} from "./mutations/treatiesMutations";
export {
  nationByIdQueryOptions,
  nationSettlementsQueryOptions,
  nationsListQueryOptions,
} from "./queries/nationsQueries";
export {
  nationOfficeHistoryQueryOptions,
  nationOfficesRosterQueryOptions,
  settlementOfficeHistoryQueryOptions,
  settlementOfficesRosterQueryOptions,
} from "./queries/officesQueries";
export {
  nationOfficeTypesQueryOptions,
  settlementOfficeTypesQueryOptions,
  worldDefaultOfficeTypesQueryOptions,
} from "./queries/officeTypesQueries";
export {
  nationActiveConstructionProjectsQueryOptions,
  nationLatestTaxSnapshotQueryOptions,
  nationStockpileQueryOptions,
} from "./queries/treasuryQueries";
export {
  CURRENCY_LEDGER_PAGE_SIZE,
  nationCurrencyLedgerPageQueryOptions,
  nationCurrencyQueryOptions,
  nationCurrencySnapshotsQueryOptions,
  nationCurrencyTreasuryQueryOptions,
} from "./queries/currencyQueries";
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
export { nationTreatiesQueryOptions } from "./queries/treatiesQueries";
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
  setNationCultureReligionInputSchema,
  setNationGovernmentTypeInputSchema,
  setNationTradePolicyInputSchema,
  updateNationDetailsInputSchema,
} from "./schemas/nationSchemas";
export {
  proposeBilateralInputSchema,
  respondToBilateralInputSchema,
  setUnilateralStanceInputSchema,
  withdrawFromBilateralInputSchema,
} from "./schemas/nationRelationshipSchemas";
export {
  breakTreatyInputSchema,
  proposeTreatyInputSchema,
  respondToTreatyInputSchema,
  withdrawTreatyInputSchema,
} from "./schemas/treatiesSchemas";

export type {
  CreateNationInput,
  CreateNationValues,
  DeleteNationInput,
  DeleteNationValues,
  SetNationCapitalAndFoundedTurnInput,
  SetNationCapitalAndFoundedTurnValues,
  SetNationCultureReligionInput,
  SetNationCultureReligionValues,
  SetNationGovernmentTypeInput,
  SetNationGovernmentTypeValues,
  SetNationTradePolicyInput,
  SetNationTradePolicyValues,
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
export type {
  BreakTreatyInput,
  BreakTreatyValues,
  ProposeTreatyInput,
  ProposeTreatyValues,
  RespondToTreatyInput,
  RespondToTreatyValues,
  WithdrawTreatyInput,
  WithdrawTreatyValues,
} from "./schemas/treatiesSchemas";
export type { NationTreatyMutationIssue } from "./mutations/treatiesMutations";
export {
  formatNationTreatyStatus,
  formatNationTreatyType,
} from "./types/nationTreatyTypes";
export type {
  NationTreaty,
  NationTreatyStatus,
  NationTreatyTerms,
  NationTreatyType,
} from "./types/nationTreatyTypes";
export type { DeleteNationResult } from "./mutations/nationsMutations";
export type {
  AppointNationOfficeInput,
  AppointSettlementOfficeInput,
  DismissNationOfficeInput,
  DismissSettlementOfficeInput,
  RenewNationOfficeInput,
  RenewSettlementOfficeInput,
} from "./mutations/officesMutations";
export type {
  CreateOfficeTypeInput,
  DeleteOfficeTypeInput,
  OfficeTypeMutationIssue,
  UpdateOfficeTypeInput,
} from "./mutations/officeTypesMutations";
export {
  formatNationOfficeType,
  type NationOfficeHistoryEntry,
  type NationOfficeRosterEntry,
  type OfficeType,
  type OfficeTypeScope,
  type SettlementOfficeHistoryEntry,
  type SettlementOfficeRosterEntry,
} from "./types/nationOfficeTypes";
export type { NationRelationshipMutationIssue } from "./mutations/nationRelationshipMutations";
export {
  NATION_GOVERNMENT_TYPES,
  NATION_TRADE_POLICIES,
  describeNationTradePolicy,
  formatNationGovernmentType,
  formatNationTradePolicy,
} from "./types/nationTypes";
export type {
  Nation,
  NationActiveConstructionProject,
  NationConstructionProjectCost,
  NationGovernmentType,
  NationLatestTaxSnapshot,
  NationSettlement,
  NationStockpileEntry,
  NationTradePolicy,
} from "./types/nationTypes";
export type {
  GrantNationResourcesInput,
  GrantNationResourcesResult,
  SetNationTaxRateInput,
  SubsidizeConstructionProjectInput,
  SubsidizeConstructionProjectLineResult,
} from "./mutations/treasuryMutations";
export type {
  BurnCurrencyInput,
  DepositReservesInput,
  EstablishNationCurrencyInput,
  MintCurrencyInput,
  RedeemReservesInput,
} from "./mutations/currencyMutations";
export {
  formatNationCurrencyLedgerAction,
  formatNationCurrencyType,
  NATION_CURRENCY_LEDGER_ACTIONS,
  NATION_CURRENCY_TYPES,
} from "./types/currencyTypes";
export type {
  NationCurrency,
  NationCurrencyLedgerAction,
  NationCurrencyLedgerEntry,
  NationCurrencySnapshot,
  NationCurrencyType,
} from "./types/currencyTypes";
export type { NationCurrencyLedgerPage } from "./queries/currencyQueries";
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
