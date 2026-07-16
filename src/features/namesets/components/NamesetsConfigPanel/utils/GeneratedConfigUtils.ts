import {
  worldGeneratedNamingConfigSchema,
  type WorldGeneratedNamingConfig,
} from "@/lib/worldNamingConfigSchemas";
import { namingGenerationCaps } from "@/shared/naming";

export const MAX_PART_LISTS = namingGenerationCaps.maxPartLists;

export const EMPTY_GENERATED_CONFIG: WorldGeneratedNamingConfig = {
  type: "generated",
  convention: "pool",
  parts: {},
  patterns: { female_given: [], male_given: [], surname: [] },
};

// Duplicates are the weighting mechanism for a fragment list, so unlike
// sanitizePoolEntries this only trims and drops blank lines.
export function sanitizePartListEntries(entries: readonly string[]): string[] {
  return entries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function sanitizeGeneratedConfig(
  config: WorldGeneratedNamingConfig,
): WorldGeneratedNamingConfig {
  const parts = Object.fromEntries(
    Object.entries(config.parts).map(([key, entries]) => [
      key,
      sanitizePartListEntries(entries),
    ]),
  );
  return { ...config, parts };
}

export function validateGeneratedConfig(
  config: WorldGeneratedNamingConfig,
): readonly string[] {
  const result = worldGeneratedNamingConfigSchema.safeParse(
    sanitizeGeneratedConfig(config),
  );
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => issue.message))];
}

export function isListReferenced(
  config: WorldGeneratedNamingConfig,
  listName: string,
): boolean {
  return Object.values(config.patterns).some((pattern) =>
    pattern.some(
      (element) => Array.isArray(element) && element.includes(listName),
    ),
  );
}

export function renameListRefInPatterns(
  patterns: WorldGeneratedNamingConfig["patterns"],
  oldName: string,
  newName: string,
): WorldGeneratedNamingConfig["patterns"] {
  const renameOne = (
    pattern: WorldGeneratedNamingConfig["patterns"]["female_given"],
  ): WorldGeneratedNamingConfig["patterns"]["female_given"] =>
    pattern.map((element) =>
      Array.isArray(element)
        ? element.map((key) => (key === oldName ? newName : key))
        : element,
    );
  return {
    female_given: renameOne(patterns.female_given),
    male_given: renameOne(patterns.male_given),
    surname: renameOne(patterns.surname),
  };
}
