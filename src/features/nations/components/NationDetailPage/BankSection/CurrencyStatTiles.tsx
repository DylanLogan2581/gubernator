import { Coins, Landmark, PiggyBank, ShieldCheck } from "lucide-react";
import { type JSX } from "react";

import { StatTile } from "@/components/shared/StatTile";
import {
  ForecastResourceSparkline,
  type ForecastSparklinePoint,
} from "@/features/settlements";
import {
  computeResourceBackedHealth,
  FIAT_CONFIDENCE_COLLAPSE_WARNING_THRESHOLD,
  isResourceBackedInDefault,
} from "@/shared/economy";

import type {
  NationCurrency,
  NationCurrencySnapshot,
} from "../../../types/currencyTypes";

type StatTileTone = "default" | "success" | "warning" | "destructive";

function confidenceTone(confidence: number): StatTileTone {
  if (confidence < FIAT_CONFIDENCE_COLLAPSE_WARNING_THRESHOLD) {
    return "destructive";
  }
  if (confidence < 0.5) return "warning";
  return "success";
}

function toSparklinePoints(
  snapshots: readonly NationCurrencySnapshot[],
  pick: (snapshot: NationCurrencySnapshot) => number,
): readonly ForecastSparklinePoint[] {
  return snapshots.map((snapshot) => ({
    quantity: pick(snapshot),
    turn: snapshot.turnNumber,
  }));
}

export function CurrencyStatTiles({
  currency,
  isSnapshotsPending,
  isTreasuryPending,
  snapshots,
  treasuryCurrency,
}: {
  readonly currency: NationCurrency;
  readonly isSnapshotsPending: boolean;
  readonly isTreasuryPending: boolean;
  readonly snapshots: readonly NationCurrencySnapshot[];
  readonly treasuryCurrency: number | null;
}): JSX.Element {
  const backingCapacity =
    currency.currencyType === "resource_backed"
      ? currency.reserveQuantity * (currency.backingRatio ?? 0)
      : null;

  const isInDefault =
    currency.currencyType === "resource_backed" &&
    isResourceBackedInDefault({
      backingRatio: currency.backingRatio ?? 0,
      moneySupply: currency.moneySupply,
      reserveQuantity: currency.reserveQuantity,
    });
  const backingHealthPercent = isInDefault
    ? Math.round(
        computeResourceBackedHealth({
          backingRatio: currency.backingRatio ?? 0,
          moneySupply: currency.moneySupply,
          reserveQuantity: currency.reserveQuantity,
        }) * 100,
      )
    : null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatTile
        icon={Coins}
        label="Money supply"
        value={currency.moneySupply.toLocaleString()}
        context={`${currency.symbol} in circulation`}
      >
        {isSnapshotsPending ? null : (
          <ForecastResourceSparkline
            points={toSparklinePoints(snapshots, (s) => s.moneySupply)}
          />
        )}
      </StatTile>
      <StatTile
        icon={Landmark}
        label="Government treasury"
        value={treasuryCurrency?.toLocaleString() ?? "—"}
        context={`${currency.symbol} held by the government`}
        isLoading={isTreasuryPending}
      />
      {currency.currencyType === "resource_backed" ? (
        <StatTile
          icon={PiggyBank}
          label="Reserves"
          value={currency.reserveQuantity.toLocaleString()}
          context={
            backingCapacity !== null
              ? `Backs up to ${backingCapacity.toLocaleString()} ${currency.symbol}`
              : undefined
          }
        >
          {isSnapshotsPending ? null : (
            <ForecastResourceSparkline
              points={toSparklinePoints(snapshots, (s) => s.reserveQuantity)}
            />
          )}
        </StatTile>
      ) : null}
      <StatTile
        icon={ShieldCheck}
        label="Confidence"
        value={
          isInDefault
            ? "In default"
            : `${Math.round(currency.confidence * 100)}%`
        }
        context={
          isInDefault
            ? `Reserves cover only ${backingHealthPercent}% of money supply — under-reserved`
            : "Trust in this currency"
        }
        tone={confidenceTone(currency.confidence)}
      >
        {isSnapshotsPending ? null : (
          <ForecastResourceSparkline
            points={toSparklinePoints(snapshots, (s) =>
              Math.round(s.confidence * 100),
            )}
          />
        )}
      </StatTile>
    </div>
  );
}
