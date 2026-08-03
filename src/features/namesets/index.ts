// Namesets feature — named naming configurations with world/nation/settlement override hierarchy.
export { NamesetsConfigPanel } from "./components/NamesetsConfigPanel";
export { NamesetCreatePage } from "./components/NamesetPage/NamesetCreatePage";
export { NamesetEditPage } from "./components/NamesetPage/NamesetEditPage";
export {
  NationNamesetCard,
  SettlementNamesetCard,
} from "./components/EntityNamesetCard";
export {
  createNamesetMutationOptions,
  hardDeleteNamesetMutationOptions,
  restoreNamesetMutationOptions,
  setDefaultNamesetMutationOptions,
  setNationNamesetMutationOptions,
  setSettlementNamesetMutationOptions,
  softDeleteNamesetMutationOptions,
  updateNamesetMutationOptions,
  NamesetMutationError,
  isNamesetMutationError,
} from "./mutations/namesetsMutations";
export {
  activeNamesetsByWorldQueryOptions,
  namesetsByWorldQueryOptions,
} from "./queries/namesetsQueries";
export {
  resolveNameset,
  resolveNamingConfig,
} from "./utils/resolveNamingConfig";
export type { Nameset } from "./types/namesetTypes";
export {
  namesetLibraryIndex,
  loadNamesetLibraryDefinition,
} from "./library/namesetLibrary";
export type { NamesetLibraryIndexEntry } from "./library/namesetLibrary";
