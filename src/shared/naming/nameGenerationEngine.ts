// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts imports.
//
// Single implementation of name generation shared by the Deno simulation
// (births) and the browser client (manual NPC creation), so the two
// runtimes can never drift on convention/pattern semantics.

import type {
  GeneratedNamingConfig,
  NameConvention,
  NamingConfig,
} from "./namingConfigTypes.ts";

export type SeededRng = () => number;

export type NamingParent = {
  readonly givenName: string | null;
  readonly sex: string | null;
  readonly surname: string | null;
};

export type GenerateNameInput = {
  readonly config: NamingConfig;
  readonly parentA?: NamingParent | null;
  readonly parentB?: NamingParent | null;
  readonly rng: SeededRng;
  readonly sex?: string | null;
};

export type GeneratedName = {
  readonly givenName: string;
  readonly surname: string | null;
};

export function generateName(input: GenerateNameInput): GeneratedName {
  const { config, parentA = null, parentB = null, rng, sex } = input;

  const givenName = generateGivenName(rng, config, sex);
  if (givenName === "") return { givenName: "", surname: null };

  const surname = resolveSurname(
    rng,
    config,
    config.convention,
    parentA,
    parentB,
  );
  return { givenName, surname };
}

export function generateGivenName(
  rng: SeededRng,
  config: NamingConfig,
  sex?: string | null,
): string {
  const { isFemale, isMale } = normalizeSex(sex);

  if (config.type === "list") {
    const pool = isMale
      ? config.male_given_names
      : isFemale
        ? config.female_given_names
        : [...config.male_given_names, ...config.female_given_names];
    return pickFromList(rng, pool) ?? "";
  }

  const patternKey = isMale
    ? "male_given"
    : isFemale
      ? "female_given"
      : rng() < 0.5
        ? "male_given"
        : "female_given";
  return generateFromPattern(rng, config, patternKey);
}

export function resolveSurname(
  rng: SeededRng,
  config: NamingConfig,
  convention: NameConvention,
  parentA: NamingParent | null,
  parentB: NamingParent | null,
): string | null {
  const randomFromPool = (): string | null =>
    config.type === "list"
      ? pickFromList(rng, config.surnames)
      : nonEmpty(generateFromPattern(rng, config, "surname"));

  switch (convention) {
    case "pool":
      return randomFromPool();
    case "none":
      return null;
    case "patronymic":
      return parentGivenNameBySex(parentA, parentB, "male") ?? randomFromPool();
    case "matronymic":
      return (
        parentGivenNameBySex(parentA, parentB, "female") ?? randomFromPool()
      );
    case "family-name": {
      const aFirst = rng() < 0.5;
      const first = aFirst ? parentA?.surname : parentB?.surname;
      const second = aFirst ? parentB?.surname : parentA?.surname;
      return nonEmpty(first) ?? nonEmpty(second) ?? randomFromPool();
    }
  }
}

// Concatenates one random pick per referenced part list for each list-ref
// group in the pattern, interleaved with literal strings, in order.
export function generateFromPattern(
  rng: SeededRng,
  config: GeneratedNamingConfig,
  patternKey: keyof GeneratedNamingConfig["patterns"],
): string {
  const pattern = config.patterns[patternKey];
  let result = "";
  for (const element of pattern) {
    if (typeof element === "string") {
      result += element;
      continue;
    }
    for (const listKey of element) {
      const list = config.parts[listKey];
      if (list === undefined || list.length === 0) continue;
      result += pickFromList(rng, list) ?? "";
    }
  }
  return result;
}

export function isGivenNamePoolEmpty(
  config: NamingConfig,
  sex?: string | null,
): boolean {
  const { isFemale, isMale } = normalizeSex(sex);

  if (config.type === "list") {
    if (isMale) return config.male_given_names.length === 0;
    if (isFemale) return config.female_given_names.length === 0;
    return (
      config.male_given_names.length === 0 &&
      config.female_given_names.length === 0
    );
  }

  if (isMale) return patternProducesEmpty(config, "male_given");
  if (isFemale) return patternProducesEmpty(config, "female_given");
  return (
    patternProducesEmpty(config, "male_given") &&
    patternProducesEmpty(config, "female_given")
  );
}

function patternProducesEmpty(
  config: GeneratedNamingConfig,
  patternKey: keyof GeneratedNamingConfig["patterns"],
): boolean {
  const pattern = config.patterns[patternKey];
  if (pattern.length === 0) return true;
  return pattern.every((element) => {
    if (typeof element === "string") return element.length === 0;
    return element.every(
      (listKey) => (config.parts[listKey]?.length ?? 0) === 0,
    );
  });
}

function parentGivenNameBySex(
  parentA: NamingParent | null,
  parentB: NamingParent | null,
  sex: "female" | "male",
): string | null {
  const aMatches = normalizeParentSex(parentA?.sex) === sex;
  const bMatches = normalizeParentSex(parentB?.sex) === sex;
  if (aMatches) return nonEmpty(parentA?.givenName);
  if (bMatches) return nonEmpty(parentB?.givenName);
  return nonEmpty(parentA?.givenName) ?? nonEmpty(parentB?.givenName);
}

function normalizeParentSex(sex: string | null | undefined): string {
  const normalized = (sex ?? "").trim().toLowerCase();
  if (normalized === "m") return "male";
  if (normalized === "f") return "female";
  return normalized;
}

function normalizeSex(sex: string | null | undefined): {
  isFemale: boolean;
  isMale: boolean;
} {
  const normalized = (sex ?? "").trim().toLowerCase();
  return {
    isFemale: normalized === "f" || normalized === "female",
    isMale: normalized === "m" || normalized === "male",
  };
}

function pickFromList(rng: SeededRng, pool: readonly string[]): string | null {
  if (pool.length === 0) return null;
  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? null;
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
