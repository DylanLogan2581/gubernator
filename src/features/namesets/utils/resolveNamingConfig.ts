import type { WorldNamingConfig } from "@/features/worlds";

import type { Nameset } from "../types/namesetTypes";

/**
 * Resolves the effective naming config for a settlement.
 *
 * Resolution: settlement.nameset_id ?? nation.nameset_id ?? world default nameset ?? worldFallback
 *
 * Only active (non-trashed) namesets are considered.
 */
export function resolveNamingConfig(
  namesets: readonly Nameset[],
  worldFallback: WorldNamingConfig,
  settlementNamesetId: string | null | undefined,
  nationNamesetId: string | null | undefined,
): WorldNamingConfig {
  const active = namesets.filter((ns) => !ns.isTrashed);

  const findById = (id: string | null | undefined): Nameset | undefined => {
    if (id === null || id === undefined) return undefined;
    return active.find((ns) => ns.id === id);
  };

  const resolved =
    findById(settlementNamesetId) ??
    findById(nationNamesetId) ??
    active.find((ns) => ns.isDefault);

  return resolved?.configJson ?? worldFallback;
}
