// Worlds feature — create, list, and manage simulation worlds.
// Implemented in Epic 2.
export {
  CONFIG_TABS,
  CONFIG_TAB_IDS,
  DEFAULT_CONFIG_TAB,
  getVisibleConfigTabs,
} from "./configTabs";
export type { ConfigTab, ConfigTabId } from "./configTabs";
export { LoreEntityConfigPanel } from "./components/loreEntity/LoreEntityConfigPanel";
export { LoreEntityDetailPage } from "./components/loreEntity/LoreEntityDetailPage";
export type {
  LoreEntityBase,
  LoreEntityDescriptor,
  LoreEntityLabels,
  LoreEntityLoreField,
  LoreEntityLoreSection,
  LoreEntityUpdatePatch,
  LoreEntityUsage,
} from "./components/loreEntity/LoreEntityTypes";
export { TemplateLibraryPage } from "./components/TemplateLibraryPage";
export { WorldAvatar } from "./components/WorldAvatar";
export { WorldConfigurationPage } from "./components/WorldConfigurationPage";
export { WorldEntryGate } from "./components/WorldEntryGate";
export { WorldListPage } from "./components/WorldListPage";
export { WorldShellPage } from "./components/WorldShellPage";
export { WorldSwitcher } from "./components/WorldSwitcher";
export {
  currentUserAdminWorldIdsQueryOptions,
  currentUserPlayerCharacterWorldIdsQueryOptions,
} from "./queries/worldAccessQueries";
export { worldAccessQueryKeys } from "./queries/worldAccessQueryKeys";
export {
  WorldNotFoundError,
  accessibleWorldsQueryOptions,
  isWorldNotFoundError,
  trashedWorldsQueryOptions,
  worldRouteAccessQueryOptions,
} from "./queries/worldQueries";
export { worldQueryKeys } from "./queries/worldQueryKeys";
export {
  WorldNamingConfigError,
  isWorldNamingConfigError,
  worldNamingConfigQueryOptions,
} from "./queries/worldNamingConfigQueries";
export {
  WorldNpcFlavorConfigError,
  isWorldNpcFlavorConfigError,
  worldNpcFlavorConfigQueryOptions,
} from "./queries/worldNpcFlavorConfigQueries";
export {
  WorldPopulationRulesError,
  isWorldPopulationRulesError,
  worldPopulationRulesQueryOptions,
} from "./queries/worldPopulationRulesQueries";
export {
  useWorldImageSignedUrl,
  worldImagesQueryOptions,
} from "./queries/worldImageQueries";
export type { WorldImagePaths } from "./queries/worldImageQueries";
export {
  SaveWorldNamingConfigError,
  isSaveWorldNamingConfigError,
  saveWorldNamingConfigMutationOptions,
} from "./mutations/worldNamingConfigMutations";
export {
  WorldImageError,
  isWorldImageError,
  removeWorldImageMutationOptions,
  uploadWorldImageMutationOptions,
  worldImagePath,
} from "./mutations/worldImageMutations";
export type {
  RemoveWorldImageInput,
  UploadWorldImageInput,
  WorldImageKind,
} from "./mutations/worldImageMutations";
export {
  SaveWorldNpcFlavorConfigError,
  isSaveWorldNpcFlavorConfigError,
  saveWorldNpcFlavorConfigMutationOptions,
} from "./mutations/worldNpcFlavorConfigMutations";
export {
  SaveWorldPopulationRulesError,
  isSaveWorldPopulationRulesError,
  saveWorldPopulationRulesMutationOptions,
} from "./mutations/worldPopulationRulesMutations";
export {
  WorldAdminError,
  createWorldMutationOptions,
  hardDeleteWorldMutationOptions,
  isWorldAdminError,
  restoreWorldMutationOptions,
  trashWorldMutationOptions,
} from "./mutations/worldAdminMutations";
export {
  WorldSettingsError,
  isWorldSettingsError,
  renameWorldMutationOptions,
  setWorldCurrentTurnNumberMutationOptions,
} from "./mutations/worldSettingsMutations";
export {
  WorldTemplateImportError,
  importWorldFromTemplateMutationOptions,
  isWorldTemplateImportError,
} from "./mutations/worldTemplateMutations";
export type {
  BundledScenario,
  TopologyGenerator,
} from "./scenarios/scenarioTypes";
export { BUNDLED_SCENARIOS } from "./scenarios/bundledScenarios";
export type { WorldNpcFlavorConfig } from "./schemas/worldNpcFlavorConfigSchemas";
export type { WorldPopulationRules } from "./schemas/worldPopulationRulesSchemas";
export type {
  AccessibleWorld,
  WorldPermissionContext,
  WorldRouteAccess,
} from "./types/worldTypes";
export { resolveWorldScope } from "./utils/resolveWorldScope";
export type {
  ResolveWorldScopeInput,
  WorldScopePin,
} from "./utils/resolveWorldScope";
export {
  nextWorldScopePin,
  readWorldScopePin,
  writeWorldScopePin,
} from "./utils/worldScopePin";
export type { NextWorldScopePinInput } from "./utils/worldScopePin";
export {
  clearLastWorldPin,
  readLastWorldPin,
  writeLastWorldPin,
} from "./utils/lastWorldPin";
