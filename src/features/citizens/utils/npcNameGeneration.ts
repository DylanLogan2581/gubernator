import type { NameConvention, WorldNamingConfig } from "@/features/worlds";
import { textInputLimits } from "@/lib/inputLimits";
import type { SeededRng } from "@/lib/seededRng";

export type NpcNameGenerationInput = {
  readonly config: WorldNamingConfig;
  readonly rng: SeededRng;
  readonly sex?: string | null;
  readonly parentAName?: string | null;
  readonly parentBName?: string | null;
};

export type NpcNameGenerationDisabledReason = "pool_empty" | "config_loading";

export function generateNpcName(input: NpcNameGenerationInput): string {
  const { config, rng, sex, parentAName, parentBName } = input;

  const pool = selectPool(config, sex);
  const givenName = pickRandom(pool, rng);
  if (givenName === "") return "";

  const surname = resolveSurname(config.convention, parentAName, parentBName);
  const full = surname !== "" ? `${givenName} ${surname}` : givenName;
  return full.slice(0, textInputLimits.citizenNameMax);
}

export function relevantPoolIsEmpty(
  config: WorldNamingConfig,
  sex?: string | null,
): boolean {
  return selectPool(config, sex).length === 0;
}

function resolveSurname(
  convention: NameConvention,
  parentAName: string | null | undefined,
  parentBName: string | null | undefined,
): string {
  switch (convention) {
    case "random":
    case "manual":
      return "";
    case "patronymic":
      return firstWord(parentAName ?? "");
    case "matronymic":
      return firstWord(parentBName ?? "");
    case "inherited family name": {
      const fromA = lastWord(parentAName ?? "");
      return fromA !== "" ? fromA : lastWord(parentBName ?? "");
    }
  }
}

function selectPool(
  config: WorldNamingConfig,
  sex?: string | null,
): readonly string[] {
  const normalized = (sex ?? "").trim().toLowerCase();
  if (normalized === "m" || normalized === "male") return config.male_names;
  if (normalized === "f" || normalized === "female") return config.female_names;
  return [...config.male_names, ...config.female_names];
}

function pickRandom(pool: readonly string[], rng: SeededRng): string {
  if (pool.length === 0) return "";
  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? "";
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function lastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}
