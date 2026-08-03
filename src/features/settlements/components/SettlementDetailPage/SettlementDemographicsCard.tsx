import { useQuery } from "@tanstack/react-query";

import { DemographicsCompositionCard } from "@/components/shared/DemographicsCompositionCard";
import { cultureReligionCompositionForSettlementQueryOptions } from "@/features/citizens";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { religionsByWorldQueryOptions } from "@/features/religions";

import type { JSX } from "react";

type SettlementDemographicsCardProps = {
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDemographicsCard({
  settlementId,
  worldId,
}: SettlementDemographicsCardProps): JSX.Element | null {
  const culturesQuery = useQuery(culturesByWorldQueryOptions(worldId));
  const religionsQuery = useQuery(religionsByWorldQueryOptions(worldId));
  const compositionQuery = useQuery(
    cultureReligionCompositionForSettlementQueryOptions(settlementId),
  );

  return (
    <DemographicsCompositionCard
      composition={compositionQuery.data}
      cultures={culturesQuery.data}
      error={
        culturesQuery.error ?? religionsQuery.error ?? compositionQuery.error
      }
      isError={
        culturesQuery.isError ||
        religionsQuery.isError ||
        compositionQuery.isError
      }
      isLoading={
        culturesQuery.isPending ||
        religionsQuery.isPending ||
        compositionQuery.isPending
      }
      religions={religionsQuery.data}
    />
  );
}
