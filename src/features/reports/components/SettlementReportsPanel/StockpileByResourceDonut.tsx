import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Skeleton } from "@/components/ui/skeleton";
import { settlementStockpilesByIdQueryOptions } from "@/features/resources";
import {
  categoricalForegroundCssVar,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";
import { getErrorDescription } from "@/lib/errorUtils";

import { CompositionDonutChart } from "./CompositionDonutChart";

import type { JSX } from "react";

type StockpileByResourceDonutProps = {
  readonly settlementId: string;
};

/** Current stockpile composition by resource for a settlement. */
export function StockpileByResourceDonut({
  settlementId,
}: StockpileByResourceDonutProps): JSX.Element {
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );

  if (stockpilesQuery.isPending) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (stockpilesQuery.isError) {
    return (
      <ErrorState
        title="Failed to load stockpiles"
        description={getErrorDescription(stockpilesQuery.error)}
      />
    );
  }

  const slices = stockpilesQuery.data.map((stockpile) => ({
    color: categoricalForegroundCssVar(
      hashToCategoricalSlot(stockpile.resourceId),
    ),
    icon: resolveEntityIcon(stockpile.resourceIcon),
    id: stockpile.resourceId,
    label: stockpile.resourceName,
    value: stockpile.quantity,
  }));

  return (
    <CompositionDonutChart
      emptyMessage="No stockpiled resources in this settlement."
      slices={slices}
    />
  );
}
