import type { NationDiscoveryPair } from "../../types/nationTypes";

export function discoveryPairKey(nationId1: string, nationId2: string): string {
  return nationId1 < nationId2
    ? `${nationId1}_${nationId2}`
    : `${nationId2}_${nationId1}`;
}

export function buildDiscoveryPairMap(
  discoveries: readonly NationDiscoveryPair[],
): ReadonlyMap<string, NationDiscoveryPair> {
  return new Map(
    discoveries.map((pair) => [
      discoveryPairKey(pair.nationAId, pair.nationBId),
      pair,
    ]),
  );
}
