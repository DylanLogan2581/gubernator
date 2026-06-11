import { useMemo } from "react";

import type { Citizen } from "@/features/citizens";

export function usePartnerCandidates({
  allCandidates,
  excludeCitizenId,
  focalSettlementId,
  includeOtherSettlements,
}: {
  readonly allCandidates: readonly Citizen[] | undefined;
  readonly excludeCitizenId: string;
  readonly focalSettlementId: string | null;
  readonly includeOtherSettlements: boolean;
}): readonly Citizen[] {
  return useMemo(() => {
    if (allCandidates === undefined) {
      return [];
    }
    return allCandidates.filter((candidate) => {
      if (candidate.id === excludeCitizenId) {
        return false;
      }
      if (includeOtherSettlements) {
        return true;
      }
      return candidate.settlementId === focalSettlementId;
    });
  }, [
    allCandidates,
    excludeCitizenId,
    focalSettlementId,
    includeOtherSettlements,
  ]);
}
