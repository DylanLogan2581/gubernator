// Public surface of the src/shared/education module.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export { parseTierEducationConfig } from "./tierEducationConfig.ts";
export type {
  TierEducationConfig,
  TierEducationLevelTransition,
} from "./tierEducationConfig.ts";
