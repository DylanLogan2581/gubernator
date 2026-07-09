/**
 * Voting body composition resolver (#1116).
 *
 * Cross-runtime module: no browser APIs, no @/ alias, explicit .ts
 * extensions. A public.government_bodies row's composition_json is a union
 * list of rules; a citizen is a member if they match ANY rule. This module
 * is the single source of truth for turning a body + supporting data into a
 * concrete, deduplicated, alive voter roster -- both the browser (member
 * preview in the composition rule builder) and any future Deno vote-tally
 * code must resolve through here so the two runtimes can never drift.
 */

export type BodyCompositionRule =
  | { readonly kind: "office_type"; readonly officeTypeId: string }
  | { readonly kind: "citizens"; readonly citizenIds: readonly string[] }
  | { readonly kind: "ruler" }
  | { readonly kind: "settlement_managers" };

export type GovernmentBodyComposition = {
  readonly composition: readonly BodyCompositionRule[];
};

export type BodyOfficeHolder = {
  readonly citizenId: string;
  readonly officeTypeId: string;
};

export type ResolveBodyMembersData = {
  /** Citizen ids already known to be alive; every other id is dropped. */
  readonly aliveCitizenIds: ReadonlySet<string> | readonly string[];
  readonly officeHolders: readonly BodyOfficeHolder[];
  /** The nation manager citizen (nation body) or settlement manager citizen
   * (settlement body), or null when the role is currently unfilled. */
  readonly rulerCitizenId: string | null;
  /** Settlement manager citizen ids of the nation's settlements. Only
   * meaningful for nation-scoped bodies; pass [] for settlement bodies. */
  readonly settlementManagerCitizenIds: readonly string[];
};

/**
 * Resolves a government body's composition rules to a deduplicated list of
 * alive citizen ids -- the concrete voter roster at vote time. Rule order
 * and duplicate matches across rules collapse to a single entry per
 * citizen; the return order is not significant.
 */
export function resolveBodyMembers(
  body: GovernmentBodyComposition,
  data: ResolveBodyMembersData,
): readonly string[] {
  const aliveCitizenIds =
    data.aliveCitizenIds instanceof Set
      ? data.aliveCitizenIds
      : new Set(data.aliveCitizenIds);

  const members = new Set<string>();

  for (const rule of body.composition) {
    switch (rule.kind) {
      case "office_type": {
        for (const holder of data.officeHolders) {
          if (holder.officeTypeId === rule.officeTypeId) {
            members.add(holder.citizenId);
          }
        }
        break;
      }
      case "citizens": {
        for (const citizenId of rule.citizenIds) {
          members.add(citizenId);
        }
        break;
      }
      case "ruler": {
        if (data.rulerCitizenId !== null) {
          members.add(data.rulerCitizenId);
        }
        break;
      }
      case "settlement_managers": {
        for (const citizenId of data.settlementManagerCitizenIds) {
          members.add(citizenId);
        }
        break;
      }
    }
  }

  return [...members].filter((citizenId) => aliveCitizenIds.has(citizenId));
}
