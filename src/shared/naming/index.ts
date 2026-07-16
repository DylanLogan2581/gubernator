export { NAME_CONVENTIONS, namingGenerationCaps } from "./namingConfigTypes.ts";
export type {
  GeneratedNamingConfig,
  ListNamingConfig,
  NameConvention,
  NamePattern,
  NamePatternElement,
  NamingConfig,
} from "./namingConfigTypes.ts";

export {
  generateFromPattern,
  generateGivenName,
  generateName,
  isGivenNamePoolEmpty,
  resolveSurname,
} from "./nameGenerationEngine.ts";
export type {
  GeneratedName,
  GenerateNameInput,
  NamingParent,
  SeededRng,
} from "./nameGenerationEngine.ts";
