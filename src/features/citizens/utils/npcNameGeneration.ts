import type { SeededRng } from "@/lib/seededRng";
import type {
  NameConvention,
  WorldNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

export type NpcNameResult = {
  readonly givenName: string;
  readonly surname: string | null;
};

export type NpcNameGenerationInput = {
  readonly config: WorldNamingConfig;
  readonly rng: SeededRng;
  readonly sex?: string | null;
  readonly parentAGivenName?: string | null;
  readonly parentASex?: string | null;
  readonly parentASurname?: string | null;
  readonly parentBGivenName?: string | null;
  readonly parentBSex?: string | null;
  readonly parentBSurname?: string | null;
};

export type NpcNameGenerationDisabledReason = "pool_empty" | "config_loading";

export function generateNpcName(input: NpcNameGenerationInput): NpcNameResult {
  const { config, rng, sex } = input;

  const pool = selectPool(config, sex);
  const givenName = pickRandom(pool, rng);
  if (givenName === "") return { givenName: "", surname: null };

  const surname = resolveSurname(
    config.convention,
    rng,
    config.surnames,
    input,
  );
  return { givenName, surname };
}

export function relevantPoolIsEmpty(
  config: WorldNamingConfig,
  sex?: string | null,
): boolean {
  return selectPool(config, sex).length === 0;
}

type ParentNameFields = {
  readonly parentAGivenName?: string | null;
  readonly parentASex?: string | null;
  readonly parentASurname?: string | null;
  readonly parentBGivenName?: string | null;
  readonly parentBSex?: string | null;
  readonly parentBSurname?: string | null;
};

function resolveSurname(
  convention: NameConvention,
  rng: SeededRng,
  surnamesPool: readonly string[],
  parents: ParentNameFields,
): string | null {
  const randomFromPool = (): string | null =>
    nonEmpty(pickRandom(surnamesPool, rng));

  switch (convention) {
    case "pool":
      return randomFromPool();
    case "none":
      return null;
    case "patronymic":
      return parentGivenNameBySex(parents, "male") ?? randomFromPool();
    case "matronymic":
      return parentGivenNameBySex(parents, "female") ?? randomFromPool();
    case "family-name": {
      const aFirst = rng() < 0.5;
      const first = aFirst ? parents.parentASurname : parents.parentBSurname;
      const second = aFirst ? parents.parentBSurname : parents.parentASurname;
      return nonEmpty(first) ?? nonEmpty(second) ?? randomFromPool();
    }
  }
}

function parentGivenNameBySex(
  parents: ParentNameFields,
  sex: "male" | "female",
): string | null {
  const aMatches = normalizeSex(parents.parentASex) === sex;
  const bMatches = normalizeSex(parents.parentBSex) === sex;
  if (aMatches) return nonEmpty(parents.parentAGivenName);
  if (bMatches) return nonEmpty(parents.parentBGivenName);
  return (
    nonEmpty(parents.parentAGivenName) ?? nonEmpty(parents.parentBGivenName)
  );
}

function normalizeSex(sex: string | null | undefined): string {
  const normalized = (sex ?? "").trim().toLowerCase();
  if (normalized === "m") return "male";
  if (normalized === "f") return "female";
  return normalized;
}

function selectPool(
  config: WorldNamingConfig,
  sex?: string | null,
): readonly string[] {
  const normalized = (sex ?? "").trim().toLowerCase();
  if (normalized === "m" || normalized === "male")
    return config.male_given_names;
  if (normalized === "f" || normalized === "female")
    return config.female_given_names;
  return [...config.male_given_names, ...config.female_given_names];
}

function pickRandom(pool: readonly string[], rng: SeededRng): string {
  if (pool.length === 0) return "";
  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? "";
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
