import type { BodyCompositionRule } from "@/shared/government";

export type BodyScope = "nation" | "settlement";

// #1116: a named voting body ("The Senate", "Moot of Elders"). Exactly one of
// nationId / settlementId is set, matching the DB scope-exclusive check.
export type GovernmentBody = {
  readonly composition: readonly BodyCompositionRule[];
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nationId: string | null;
  readonly settlementId: string | null;
  readonly updatedAt: string;
  readonly worldId: string;
};

// Supporting data resolveBodyMembers needs to turn a body's composition into
// a concrete voter roster -- assembled from nation_offices, citizens role
// columns, and (for the "citizens" rule) explicit alive-status lookups.
export type BodyResolverContext = {
  readonly officeHolders: readonly {
    readonly citizenId: string;
    readonly officeTypeId: string;
  }[];
  readonly rulerCitizenId: string | null;
  readonly settlementManagerCitizenIds: readonly string[];
};
