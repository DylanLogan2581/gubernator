import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { useMemo, useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { MasterDetailLayout } from "@/components/shared/MasterDetailLayout";
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
import { hashToCategoricalSlot } from "@/lib/categoricalPalette";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import { updateSettlementStockpileMutationOptions } from "../mutations/settlementStockpilesMutations";
import { settlementStockpilesByIdQueryOptions } from "../queries/settlementStockpilesQueries";
import { updateSettlementStockpileInputSchema } from "../schemas/settlementStockpileSchemas";

import type { SettlementStockpile } from "../queries/settlementStockpilesQueries";

type ForecastDeltaMap = ReadonlyMap<string, number>;

type SettlementStockpilesPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementStockpilesPanel({
  canAdmin,
  isArchived,
  nationId,
  settlementId,
  worldId,
}: SettlementStockpilesPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );
  const forecastQuery = useQuery(settlementForecastQueryOptions(worldId));

  const forecastDeltaMap = useMemo<ForecastDeltaMap>(() => {
    const settlement =
      forecastQuery.data?.forecastSnapshot.bySettlement[settlementId];
    if (settlement === undefined) return new Map();
    return new Map(
      settlement.resourceDeltas.map((d) => [d.resourceId, d.netDelta]),
    );
  }, [forecastQuery.data, settlementId]);

  return (
    <Card
      aria-labelledby="settlement-stockpiles-heading"
      className="grid min-w-0 grid-cols-1 gap-3"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h2
          id="settlement-stockpiles-heading"
          className="text-base font-medium"
        >
          Stockpiles
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Stockpiles are simulation-managed
        </span>
      </div>
      <CardContent>
        {stockpilesQuery.isPending ? (
          <TableSkeleton columnCount={5} rowCount={5} />
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
            nationId={nationId}
            queryClient={queryClient}
            stockpiles={sortStockpiles(stockpilesQuery.data)}
            worldId={worldId}
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
  nationId,
  queryClient,
  stockpiles,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly forecastDeltaMap: ForecastDeltaMap;
  readonly isForecastError: boolean;
  readonly isForecastPending: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly queryClient: QueryClient;
  readonly stockpiles: readonly SettlementStockpile[];
  readonly worldId: string;
}): JSX.Element {
  const [editingStockpile, setEditingStockpile] =
    useState<SettlementStockpile | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );
  const canEdit = canAdmin && !isArchived;
  const selectedStockpile =
    stockpiles.find((s) => s.resourceId === selectedResourceId) ?? null;

  const list = (
    <div className="overflow-x-auto rounded-md border">
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Resource</TableHead>
            <TableHead scope="col" className="whitespace-nowrap tabular-nums">
              Capacity
            </TableHead>
            <TableHead scope="col" className="whitespace-nowrap tabular-nums">
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
              isSelected={stockpile.resourceId === selectedResourceId}
              nationId={nationId}
              stockpile={stockpile}
              worldId={worldId}
              onEdit={() => {
                setEditingStockpile(stockpile);
              }}
              onSelect={() => {
                setSelectedResourceId(stockpile.resourceId);
              }}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <MasterDetailLayout
        list={list}
        detail={
          selectedStockpile === null ? null : (
            <StockpileDetailPanel
              canEdit={canEdit}
              forecastDelta={forecastDeltaMap.get(selectedStockpile.resourceId)}
              isForecastError={isForecastError}
              isForecastPending={isForecastPending}
              nationId={nationId}
              stockpile={selectedStockpile}
              worldId={worldId}
              onEdit={() => {
                setEditingStockpile(selectedStockpile);
              }}
            />
          )
        }
        detailTitle={selectedStockpile?.resourceName ?? ""}
        onCloseDetail={() => {
          setSelectedResourceId(null);
        }}
      />

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
  isSelected,
  nationId,
  stockpile,
  worldId,
  onEdit,
  onSelect,
}: {
  readonly canEdit: boolean;
  readonly forecastDelta: number | undefined;
  readonly isForecastError: boolean;
  readonly isForecastPending: boolean;
  readonly isSelected: boolean;
  readonly nationId: string;
  readonly onEdit: () => void;
  readonly onSelect: () => void;
  readonly stockpile: SettlementStockpile;
  readonly worldId: string;
}): JSX.Element {
  const atCap = stockpile.quantity >= stockpile.effectiveCap;
  const formatInt = (n: number): string =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <TableRow
      aria-selected={isSelected}
      className="cursor-pointer"
      data-state={isSelected ? "selected" : undefined}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <TableCell className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <IconChip
            icon={resolveEntityIcon(stockpile.resourceIcon)}
            tone={hashToCategoricalSlot(stockpile.resourceId)}
          />
          <span>{stockpile.resourceName}</span>
          {stockpile.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        <div className="grid gap-1">
          <span>
            {formatInt(stockpile.quantity)} /{" "}
            {stockpile.effectiveCap.toLocaleString()}
          </span>
          <CapacityBar
            cap={stockpile.effectiveCap}
            quantity={stockpile.quantity}
          />
        </div>
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        <ForecastValue
          forecastDelta={forecastDelta}
          isForecastError={isForecastError}
          isForecastPending={isForecastPending}
          nationId={nationId}
          settlementId={stockpile.settlementId}
          worldId={worldId}
        />
      </TableCell>
      <TableCell className="w-16 py-2 pr-2">
        {atCap ? (
          <Badge variant="destructive">at cap</Badge>
        ) : (
          <span className="inline-block w-[53px]" aria-hidden="true" />
        )}
      </TableCell>
      <TableCell
        className="w-24 py-2 text-right"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
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
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function CapacityBar({
  cap,
  quantity,
}: {
  readonly cap: number;
  readonly quantity: number;
}): JSX.Element {
  const ratio = cap > 0 ? quantity / cap : 0;
  const fillPercent = Math.min(100, Math.max(0, ratio * 100));
  const fillColorClass =
    ratio >= 1
      ? "bg-red-600 dark:bg-red-500"
      : ratio > 0.8
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-primary";

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label="Capacity"
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-valuenow={Math.min(quantity, cap)}
    >
      <div
        className={`h-full rounded-full ${fillColorClass}`}
        style={{ width: `${fillPercent}%` }}
      />
    </div>
  );
}

function ForecastValue({
  forecastDelta,
  isForecastError,
  isForecastPending,
  nationId,
  settlementId,
  worldId,
}: {
  readonly forecastDelta: number | undefined;
  readonly isForecastError: boolean;
  readonly isForecastPending: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const formatInt = (n: number): string =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  if (isForecastPending) {
    return (
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-muted-foreground"
        aria-label="Loading forecast"
      />
    );
  }
  if (isForecastError) {
    return (
      <AlertTriangle
        className="h-3.5 w-3.5 text-destructive"
        aria-label="Forecast error"
      />
    );
  }
  if (forecastDelta === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (forecastDelta > 0) {
    return (
      <span className="text-green-700 dark:text-green-500">
        +{formatInt(forecastDelta)}
      </span>
    );
  }
  if (forecastDelta < 0) {
    return (
      <Link
        className="text-red-700 underline underline-offset-2 hover:no-underline dark:text-red-500"
        params={{ nationId, settlementId, worldId }}
        to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {formatInt(forecastDelta)}
      </Link>
    );
  }
  return <span className="text-muted-foreground">0</span>;
}

function StockpileDetailPanel({
  canEdit,
  forecastDelta,
  isForecastError,
  isForecastPending,
  nationId,
  stockpile,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly forecastDelta: number | undefined;
  readonly isForecastError: boolean;
  readonly isForecastPending: boolean;
  readonly nationId: string;
  readonly onEdit: () => void;
  readonly stockpile: SettlementStockpile;
  readonly worldId: string;
}): JSX.Element {
  const formatInt = (n: number): string =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="grid gap-3 text-sm">
      <div className="grid grid-cols-2 gap-y-2">
        <span className="text-muted-foreground">On hand</span>
        <span className="tabular-nums">{formatInt(stockpile.quantity)}</span>
        <span className="text-muted-foreground">Capacity</span>
        <span className="tabular-nums">
          {stockpile.effectiveCap.toLocaleString()}
        </span>
        <span className="text-muted-foreground">Per-turn delta</span>
        <span className="tabular-nums">
          <ForecastValue
            forecastDelta={forecastDelta}
            isForecastError={isForecastError}
            isForecastPending={isForecastPending}
            nationId={nationId}
            settlementId={stockpile.settlementId}
            worldId={worldId}
          />
        </span>
      </div>
      <CapacityBar cap={stockpile.effectiveCap} quantity={stockpile.quantity} />
      <div className="grid gap-1">
        <span className="text-muted-foreground">Contributing buildings</span>
        <span className="text-muted-foreground">Not tracked yet</span>
      </div>
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          aria-label={`Edit ${stockpile.resourceName} quantity`}
          onClick={onEdit}
        >
          Edit quantity
        </Button>
      ) : null}
    </div>
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
