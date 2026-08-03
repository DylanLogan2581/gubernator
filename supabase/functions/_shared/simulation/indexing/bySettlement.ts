// Settlement-scoped grouping indexes, built once per turn and shared across
// phases so hot loops stop re-scanning the full citizen/partnership arrays
// once per settlement.
//
// Determinism: every grouping is a single forward pass, so each group keeps the
// input iteration order. Phases that depend on the RNG stream (partnerships,
// fertility) rely on this.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimCitizen, SimPartnership } from "../simulationTypes.ts";

/**
 * Groups items by settlement id, preserving input order within each group.
 * Items whose settlement id is null/undefined are omitted.
 */
export function groupBySettlementId<T>(
  items: readonly T[],
  getSettlementId: (item: T) => string | null | undefined,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const settlementId = getSettlementId(item);
    if (settlementId === null || settlementId === undefined) continue;
    const group = grouped.get(settlementId);
    if (group === undefined) grouped.set(settlementId, [item]);
    else group.push(item);
  }
  return grouped;
}

/**
 * Groups citizens by settlement. `getSettlementId` lets callers group by an
 * effective settlement (e.g. a soldier's stationed settlement) instead of the
 * home settlement.
 */
export function groupCitizensBySettlement(
  citizens: readonly SimCitizen[],
  getSettlementId: (citizen: SimCitizen) => string | null | undefined = (c) => c.settlementId,
): Map<string, SimCitizen[]> {
  return groupBySettlementId(citizens, getSettlementId);
}

/**
 * Groups partnerships by the settlement of citizen A. Partnerships whose
 * citizen A is unknown are omitted — consumers skip those anyway.
 */
export function groupPartnershipsBySettlement(
  partnerships: readonly SimPartnership[],
  citizenById: ReadonlyMap<string, SimCitizen>,
): Map<string, SimPartnership[]> {
  return groupBySettlementId(
    partnerships,
    (p) => citizenById.get(p.citizenAId)?.settlementId,
  );
}

/** Indexes citizens by id, preserving the first entry for duplicate ids. */
export function indexCitizensById(
  citizens: readonly SimCitizen[],
): Map<string, SimCitizen> {
  const byId = new Map<string, SimCitizen>();
  for (const citizen of citizens) {
    if (!byId.has(citizen.id)) byId.set(citizen.id, citizen);
  }
  return byId;
}
