import type { SeededRng } from "@/lib/seededRng";
import type { WorldNamingConfig } from "@/lib/worldNamingConfigSchemas";
import {
  generateName,
  isGivenNamePoolEmpty,
  type NamingParent,
} from "@/shared/naming";

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

  return generateName({
    config,
    parentA: toParent(
      input.parentAGivenName,
      input.parentASex,
      input.parentASurname,
    ),
    parentB: toParent(
      input.parentBGivenName,
      input.parentBSex,
      input.parentBSurname,
    ),
    rng,
    sex,
  });
}

export function relevantPoolIsEmpty(
  config: WorldNamingConfig,
  sex?: string | null,
): boolean {
  return isGivenNamePoolEmpty(config, sex);
}

function toParent(
  givenName: string | null | undefined,
  sex: string | null | undefined,
  surname: string | null | undefined,
): NamingParent {
  return {
    givenName: givenName ?? null,
    sex: sex ?? null,
    surname: surname ?? null,
  };
}
