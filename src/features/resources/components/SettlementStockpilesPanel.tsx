import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { settlementForecastQueryOptions } from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import { updateSettlementStockpileMutationOptions } from "../mutations/settlementStockpilesMutations";
import { settlementStockpilesByIdQueryOptions } from "../queries/settlementStockpilesQueries";
import { updateSettlementStockpileInputSchema } from "../schemas/settlementStockpileSchemas";

import type { SettlementStockpile } from "../queries/settlementStockpilesQueries";

type ForecastDeltaMap = ReadonlyMap<string, number>;

function parseForecastDeltaMap(
  forecastSnapshot: unknown,
  settlementId: string,
): ForecastDeltaMap {
  if (
    typeof forecastSnapshot !== "object" ||
    forecastSnapshot === null ||
    !("bySettlement" in forecastSnapshot)
  ) {
    return new Map();
  }
  const bySettlement = (forecastSnapshot as Record<string, unknown>)
    .bySettlement;
  if (typeof bySettlement !== "object" || bySettlement === null) {
    return new Map();
  }
  const settlement = (bySettlement as Record<string, unknown>)[settlementId];
  if (
    typeof settlement !== "object" ||
    settlement === null ||
    !("resourceDeltas" in settlement)
  ) {
    return new Map();
  }
  const deltas = (settlement as Record<string, unknown>).resourceDeltas;
  if (!Array.isArray(deltas)) {
    return new Map();
  }
  const map = new Map<string, number>();
  for (const delta of deltas) {
    if (
      typeof delta === "object" &&
      delta !== null &&
      "resourceId" in delta &&
      "netDelta" in delta &&
      typeof (delta as Record<string, unknown>).resourceId === "string" &&
      typeof (delta as Record<string, unknown>).netDelta === "number"
    ) {
      map.set(
        (delta as Record<string, unknown>).resourceId as string,
        (delta as Record<string, unknown>).netDelta as number,
      );
    }
  }
  return map;
}

type SettlementStockpilesPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementStockpilesPanel({
  canAdmin,
  isArchived,
  settlementId,
  worldId,
}: SettlementStockpilesPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );
  const forecastQuery = useQuery(settlementForecastQueryOptions(worldId));

  const forecastDeltaMap = useMemo<ForecastDeltaMap>(() => {
    const snapshot = forecastQuery.data?.forecastSnapshot;
    if (snapshot === undefined || snapshot === null) {
      return new Map();
    }
    return parseForecastDeltaMap(snapshot, settlementId);
  }, [forecastQuery.data, settlementId]);

  return (
    <Card
      aria-labelledby="settlement-stockpiles-heading"
      className="grid gap-3"
    >
      <h2
        id="settlement-stockpiles-heading"
        className="text-base font-medium px-4 pt-4"
      >
        Stockpiles
      </h2>
      <CardContent>
        {stockpilesQuery.isPending ? (
          <TableSkeleton columnCount={6} rowCount={5} />
        ) : stockpilesQuery.isError ? (
          <ErrorState
            title="Stockpiles could not be loaded"
            description={getErrorDescription(stockpilesQuery.error)}
          />
        ) : stockpilesQuery.data.length === 0 ? (
          <EmptyState
            title="No stockpiles"
            description="This settlement has no resource stockpiles."
          />
        ) : (
          <StockpilesTable
            canAdmin={canAdmin}
            forecastDeltaMap={forecastDeltaMap}
            isForecastError={forecastQuery.isError}
            isForecastPending={forecastQuery.isPending}
            isArchived={isArchived}
            queryClient={queryClient}
            stockpiles={sortStockpiles(stockpilesQuery.data)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function sortStockpiles(
  stockpiles: readonly SettlementStockpile[],
): readonly SettlementStockpile[] {
  return [...stockpiles].sort((a, b) => {
    if (a.isSystemResource !== b.isSystemResource) {
      return a.isSystemResource ? -1 : 1;
    }
    return a.resourceName.localeCompare(b.resourceName);
  });
}

function StockpilesTable({
  canAdmin,
  forecastDeltaMap,
  isForecastError,
  isForecastPending,
  isArchived,
  queryClient,
  stockpiles,
}: {
  readonly canAdmin: boolean;
  readonly forecastDeltaMap: ForecastDeltaMap;
  readonly isForecastError: boolean;
  readonly isForecastPending: boolean;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly stockpiles: readonly SettlementStockpile[];
}): JSX.Element {
  const [editingStockpile, setEditingStockpile] =
    useState<SettlementStockpile | null>(null);
  const canEdit = canAdmin && !isArchived;

  return (
    <>
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Resource</TableHead>
            <TableHead scope="col" className="tabular-nums">
              Quantity
            </TableHead>
            <TableHead scope="col" className="tabular-nums">
              Cap
            </TableHead>
            <TableHead scope="col" className="tabular-nums">
              Forecast
            </TableHead>
            <TableHead scope="col" className="w-16" aria-label="Status" />
            <TableHead scope="col" className="w-24" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockpiles.map((stockpile) => (
            <StockpileRow
              key={stockpile.resourceId}
              canEdit={canEdit}
              forecastDelta={forecastDeltaMap.get(stockpile.resourceId)}
              isForecastError={isForecastError}
              isForecastPending={isForecastPending}
              stockpile={stockpile}
              onEdit={() => {
                setEditingStockpile(stockpile);
              }}
            />
          ))}
        </TableBody>
      </Table>

      {editingStockpile !== null ? (
        <EditStockpileDialog
          queryClient={queryClient}
          stockpile={editingStockpile}
          onClose={() => {
            setEditingStockpile(null);
          }}
        />
      ) : null}
    </>
  );
}

function StockpileRow({
  canEdit,
  forecastDelta,
  isForecastError,
  isForecastPending,
  stockpile,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly forecastDelta: number | undefined;
  readonly isForecastError: boolean;
  readonly isForecastPending: boolean;
  readonly onEdit: () => void;
  readonly stockpile: SettlementStockpile;
}): JSX.Element {
  const atCap = stockpile.quantity >= stockpile.effectiveCap;

  return (
    <TableRow>
      <TableCell className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <span>{stockpile.resourceName}</span>
          {stockpile.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        {stockpile.quantity.toLocaleString()}
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        {stockpile.effectiveCap.toLocaleString()}
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        {isForecastPending ? (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Loading forecast"
          />
        ) : isForecastError ? (
          <AlertTriangle
            className="h-3.5 w-3.5 text-destructive"
            aria-label="Forecast error"
          />
        ) : forecastDelta === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : forecastDelta > 0 ? (
          <span className="text-green-600 dark:text-green-500">
            +{forecastDelta.toLocaleString()}
          </span>
        ) : forecastDelta < 0 ? (
          <span className="text-red-600 dark:text-red-500">
            {forecastDelta.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell className="w-16 py-2 pr-2">
        {atCap ? (
          <Badge variant="destructive">at cap</Badge>
        ) : (
          <span className="inline-block w-[53px]" aria-hidden="true" />
        )}
      </TableCell>
      <TableCell className="w-24 py-2 text-right">
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Edit ${stockpile.resourceName} quantity`}
            onClick={onEdit}
          >
            Edit
          </Button>
        ) : (
          <Badge variant="secondary">read-only</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function EditStockpileDialog({
  onClose,
  queryClient,
  stockpile,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly stockpile: SettlementStockpile;
}): JSX.Element {
  const updateMutation = useMutation(
    updateSettlementStockpileMutationOptions({ queryClient }),
  );
  const [quantity, setQuantity] = useState(String(stockpile.quantity));
  const { fieldErrors, setFromZod, clear } = useFieldErrors<"quantity">();

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity,
      resourceId: stockpile.resourceId,
      settlementId: stockpile.settlementId,
    });

    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        quantity,
        resourceId: stockpile.resourceId,
        settlementId: stockpile.settlementId,
      });
      notifyMutationSuccess("Stockpile updated.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to update stockpile.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {stockpile.resourceName} quantity</DialogTitle>
            <DialogDescription>
              Update this settlement stockpile quantity.
            </DialogDescription>
          </DialogHeader>
          <Label className="grid gap-1 text-sm" htmlFor="edit-stockpile-qty">
            <span className="text-muted-foreground">Quantity</span>
            <Input
              aria-invalid={fieldErrors.quantity !== undefined}
              aria-label="Quantity"
              autoFocus
              disabled={updateMutation.isPending}
              id="edit-stockpile-qty"
              inputMode="decimal"
              placeholder="0"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.currentTarget.value);
              }}
            />
            {fieldErrors.quantity !== undefined ? (
              <p className="text-xs text-destructive">{fieldErrors.quantity}</p>
            ) : null}
          </Label>
          <DialogFooter>
            <Button
              disabled={updateMutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={updateMutation.isPending} type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
