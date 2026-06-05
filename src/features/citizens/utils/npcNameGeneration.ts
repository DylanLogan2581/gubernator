import type { NameConvention, WorldNamingConfig } from "@/features/worlds";
import type { SeededRng } from "@/lib/seededRng";

export type NpcNameResult = {
  readonly givenName: string;
  readonly surname: string | null;
};

export type NpcNameGenerationInput = {
  readonly config: WorldNamingConfig;
  readonly rng: SeededRng;
  readonly sex?: string | null;
  readonly parentAGivenName?: string | null;
  readonly parentASurname?: string | null;
  readonly parentBGivenName?: string | null;
  readonly parentBSurname?: string | null;
};

export type NpcNameGenerationDisabledReason = "pool_empty" | "config_loading";

export function generateNpcName(input: NpcNameGenerationInput): NpcNameResult {
  const {
    config,
    rng,
    sex,
    parentAGivenName,
    parentASurname,
    parentBGivenName,
    parentBSurname,
  } = input;

  const pool = selectPool(config, sex);
  const givenName = pickRandom(pool, rng);
  if (givenName === "") return { givenName: "", surname: null };

  const surname = resolveSurname(
    config.convention,
    rng,
    config.surnames,
    parentAGivenName,
    parentASurname,
    parentBGivenName,
    parentBSurname,
  );
  return { givenName, surname };
}

export function relevantPoolIsEmpty(
  config: WorldNamingConfig,
  sex?: string | null,
): boolean {
  return selectPool(config, sex).length === 0;
}

function resolveSurname(
  convention: NameConvention,
  rng: SeededRng,
  surnamesPool: readonly string[],
  parentAGivenName: string | null | undefined,
  parentASurname: string | null | undefined,
  parentBGivenName: string | null | undefined,
  parentBSurname: string | null | undefined,
): string | null {
  switch (convention) {
    case "random":
      return nonEmpty(pickRandom(surnamesPool, rng));
    case "manual":
      return null;
    case "patronymic":
      return nonEmpty(parentAGivenName);
    case "matronymic":
      return nonEmpty(parentBGivenName);
    case "inherited family name":
      return nonEmpty(parentASurname) ?? nonEmpty(parentBSurname);
  }
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
