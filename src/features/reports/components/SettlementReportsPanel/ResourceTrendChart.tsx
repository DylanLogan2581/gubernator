import { useMemo, useState, type JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { NativeSelect } from "@/components/ui/native-select";

import type { ResourceSnapshotRow } from "../../types/snapshotTypes";

type ResourceTrendChartProps = {
  readonly rows: readonly ResourceSnapshotRow[];
  readonly turnLabel: (turn: number) => string;
};

const resourceChartConfig: ChartConfig = {
  adjustment_amount: { color: "var(--chart-5)", label: "Adjustment" },
  consumed_amount: { color: "var(--chart-1)", label: "Consumed" },
  produced_amount: { color: "var(--chart-2)", label: "Produced" },
  quantity_after: { color: "var(--chart-5)", label: "Stock (end)" },
  trade_in_amount: { color: "var(--chart-3)", label: "Trade in" },
  trade_out_amount: { color: "var(--chart-4)", label: "Trade out" },
};

export function ResourceTrendChart({
  rows,
  turnLabel,
}: ResourceTrendChartProps): JSX.Element {
  // Build unique resource list preserving first-seen order.
  const resources = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!seen.has(row.resource_id)) {
        seen.set(row.resource_id, row.resource_name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const [selectedResourceId, setSelectedResourceId] = useState<string>(
    resources[0]?.id ?? "",
  );

  const effectiveResourceId =
    resources.find((r) => r.id === selectedResourceId)?.id ??
    resources[0]?.id ??
    "";

  if (resources.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No resource snapshots in this turn range.
      </p>
    );
  }

  const selectedRows = rows.filter(
    (r) => r.resource_id === effectiveResourceId,
  );

  const chartData = selectedRows.map((r) => ({
    adjustment_amount: r.adjustment_amount,
    consumed_amount: r.consumed_amount,
    produced_amount: r.produced_amount,
    quantity_after: r.quantity_after,
    trade_in_amount: r.trade_in_amount,
    trade_out_amount: r.trade_out_amount,
    turn: r.turn_number,
    turnLabel: turnLabel(r.turn_number),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label
          htmlFor="resource-select"
          className="shrink-0 text-sm font-medium"
        >
          Resource
        </label>
        <NativeSelect
          id="resource-select"
          value={effectiveResourceId}
          onChange={(e) => setSelectedResourceId(e.target.value)}
          className="w-48"
          aria-label="Select resource"
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {chartData.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No data for this resource in the selected range.
        </p>
      ) : (
        <>
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stockpile (end of turn)
            </h4>
            <ChartContainer
              config={resourceChartConfig}
              className="h-40 w-full"
            >
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="turnLabel"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} width={52} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelKey="turnLabel"
                      labelFormatter={(_, payload) =>
                        (
                          payload[0]?.payload as
                            | { turnLabel: string }
                            | undefined
                        )?.turnLabel ?? ""
                      }
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="quantity_after"
                  stroke="var(--chart-5)"
                  fill="var(--chart-5)"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ChartContainer>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Flows per turn
            </h4>
            <ChartContainer
              config={resourceChartConfig}
              className="h-40 w-full"
            >
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="turnLabel"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} width={52} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelKey="turnLabel"
                      labelFormatter={(_, payload) =>
                        (
                          payload[0]?.payload as
                            | { turnLabel: string }
                            | undefined
                        )?.turnLabel ?? ""
                      }
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="produced_amount"
                  stroke="var(--chart-2)"
                  dot={false}
                  connectNulls
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="consumed_amount"
                  stroke="var(--chart-1)"
                  dot={false}
                  connectNulls
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="trade_in_amount"
                  stroke="var(--chart-3)"
                  dot={false}
                  connectNulls
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="trade_out_amount"
                  stroke="var(--chart-4)"
                  dot={false}
                  connectNulls
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="adjustment_amount"
                  stroke="var(--chart-5)"
                  dot={false}
                  connectNulls
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              {(
                [
                  "produced_amount",
                  "consumed_amount",
                  "trade_in_amount",
                  "trade_out_amount",
                  "adjustment_amount",
                ] as const
              ).map((key) => {
                const conf = resourceChartConfig[key];
                return (
                  <span key={key} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-5 rounded-sm"
                      style={{ background: conf.color as string }}
                    />
                    {conf.label as string}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
