import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Pencil, TrendingDown, TrendingUp, X } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Resource } from "@/features/resources";
import { type TurnTransitionOutcome } from "@/features/turns";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { parseManagedPopulationExtinctPayload } from "@/shared/simulation";

import { setConfiguredCullQuantityMutationOptions } from "../../mutations/setConfiguredCullQuantityMutations";

import { MarkExtinctConfirmDialog } from "./MarkExtinctConfirmDialog";

import type { ManagedPopSnapshotCounts } from "../../queries/managedPopulationSnapshotsQueries";
import type { ManagedPopulationInstance } from "../../types/managedPopulationInstanceTypes";
import type { ManagedPopulationType } from "../../types/managedPopulationTypes";

function extinctBadgeTooltip(
  instanceId: string,
  latestOutcome: TurnTransitionOutcome | null,
): string | undefined {
  if (latestOutcome === null) return undefined;
  const entry = latestOutcome.logEntries.find(
    (e) =>
      e.logCategory === "managed_population.extinct" &&
      parseManagedPopulationExtinctPayload(e.payloadJsonb)
        ?.managedPopulationInstanceId === instanceId,
  );
  if (entry === undefined) return undefined;
  return `Turn ${latestOutcome.toTurnNumber.toString()}`;
}

type CullQuantityEditorProps = {
  readonly instance: ManagedPopulationInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

function CullQuantityEditor({
  instance,
  onClose,
  queryClient,
}: CullQuantityEditorProps): JSX.Element {
  const inputId = useId();
  const [value, setValue] = useState(String(instance.configuredCullQuantity));
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const mutation = useMutation(
    setConfiguredCullQuantityMutationOptions({ queryClient }),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);

    const parsed = parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      setFieldError("Cull quantity must be a number.");
      return;
    }
    if (parsed < 0) {
      setFieldError("Cull quantity must be at least 0.");
      return;
    }
    if (parsed > instance.currentCount) {
      setFieldError(
        `Cull quantity cannot exceed current count (${instance.currentCount.toLocaleString()}).`,
      );
      return;
    }

    mutation.mutate(
      {
        managedPopulationInstanceId: instance.id,
        quantity: parsed,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update cull quantity.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Cull quantity updated.");
          onClose();
        },
      },
    );
  }

  return (
    <form
      className="flex items-center gap-1"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-0.5">
        <label className="sr-only" htmlFor={inputId}>
          Cull quantity for {instance.name}
        </label>
        <Input
          aria-describedby={
            fieldError !== undefined ? `${inputId}-error` : undefined
          }
          aria-invalid={fieldError !== undefined}
          className="h-7 w-24 text-sm"
          disabled={mutation.isPending}
          id={inputId}
          inputMode="numeric"
          max={instance.currentCount}
          min={0}
          type="number"
          value={value}
          onChange={(e) => {
            setValue(e.currentTarget.value);
          }}
        />
        {fieldError !== undefined ? (
          <p className="text-xs text-destructive" id={`${inputId}-error`}>
            {fieldError}
          </p>
        ) : null}
      </div>
      <Button
        className="h-7 px-2 text-xs"
        disabled={mutation.isPending}
        size="sm"
        type="submit"
      >
        Save
      </Button>
      <Button
        className="h-7 px-2 text-xs"
        disabled={mutation.isPending}
        size="sm"
        type="button"
        variant="ghost"
        onClick={onClose}
      >
        <X aria-hidden="true" className="h-3 w-3" />
      </Button>
    </form>
  );
}

type ManagedPopulationInstanceRowProps = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly husbandryCount: number;
  readonly instance: ManagedPopulationInstance;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceById: ReadonlyMap<string, Resource>;
  readonly snapshotCounts: ManagedPopSnapshotCounts;
  readonly type: ManagedPopulationType | undefined;
};

export function ManagedPopulationInstanceRow({
  canAdmin,
  canManage,
  husbandryCount,
  instance,
  latestOutcome,
  queryClient,
  resourceById,
  snapshotCounts,
  type,
}: ManagedPopulationInstanceRowProps): JSX.Element {
  const [editingCull, setEditingCull] = useState(false);
  const [showExtinctConfirm, setShowExtinctConfirm] = useState(false);

  // required workers = 1 worker per N animals (N = husbandryWorkersPerNAnimals)
  const requiredWorkers =
    type !== undefined
      ? Math.ceil(instance.currentCount / type.husbandryWorkersPerNAnimals)
      : null;

  const trendValue =
    type !== undefined && requiredWorkers !== null && requiredWorkers > 0
      ? type.growthRate * (husbandryCount / requiredWorkers)
      : null;

  // Actual count delta from the last two snapshots (takes priority over trendValue)
  const latestCount = snapshotCounts.latestCounts?.get(instance.id) ?? null;
  const prevCount = snapshotCounts.prevCounts?.get(instance.id) ?? null;
  const snapshotDelta =
    latestCount !== null && prevCount !== null && prevCount > 0
      ? ((latestCount - prevCount) / prevCount) * 100
      : null;

  const extinctTooltip =
    instance.status === "extinct"
      ? extinctBadgeTooltip(instance.id, latestOutcome)
      : undefined;

  const maintenanceSummary =
    type !== undefined && type.maintenanceRulesJson.length > 0
      ? type.maintenanceRulesJson
          .map((entry) => {
            const resourceName =
              resourceById.get(entry.resourceId)?.name ?? entry.resourceId;
            const amount = instance.currentCount * entry.amountPerNAnimals;
            return `${resourceName}: ${amount.toFixed(1)}`;
          })
          .join(", ")
      : "—";

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4 font-medium">
          <span className="flex items-center gap-2">
            {instance.name}
            {instance.status === "extinct" ? (
              <Badge
                aria-label="Extinct"
                title={extinctTooltip}
                variant="secondary"
              >
                Extinct
              </Badge>
            ) : null}
          </span>
        </td>
        <td className="py-2 pr-4 text-muted-foreground">
          {instance.managedPopulationTypeName}
        </td>
        <td className="py-2 pr-4">
          <span className="flex items-center gap-1">
            {instance.currentCount.toLocaleString()}
            {snapshotDelta !== null ? (
              snapshotDelta !== 0 ? (
                <span
                  aria-label={snapshotDelta > 0 ? "Growing" : "Declining"}
                  className={`text-xs ${snapshotDelta > 0 ? "text-success-foreground" : "text-destructive"}`}
                >
                  {snapshotDelta > 0 ? "↑" : "↓"}
                  {Math.abs(snapshotDelta).toFixed(1)}%
                </span>
              ) : null
            ) : trendValue !== null ? (
              trendValue > 0 ? (
                <TrendingUp
                  aria-label="Growing"
                  className="h-3.5 w-3.5 text-success-foreground"
                />
              ) : (
                <TrendingDown
                  aria-label="Declining"
                  className="h-3.5 w-3.5 text-destructive"
                />
              )
            ) : null}
          </span>
        </td>
        <td className="py-2 pr-4">
          {editingCull ? (
            <CullQuantityEditor
              instance={instance}
              queryClient={queryClient}
              onClose={() => {
                setEditingCull(false);
              }}
            />
          ) : (
            <span className="flex items-center gap-2">
              {instance.configuredCullQuantity.toLocaleString()}
              {canManage ? (
                <Button
                  aria-label={`Edit cull quantity for ${instance.name}`}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingCull(true);
                  }}
                >
                  <Pencil aria-hidden="true" className="h-3 w-3" />
                </Button>
              ) : null}
            </span>
          )}
        </td>
        <td className="py-2 pr-4 text-muted-foreground">
          {instance.husbandryJobName}
          {requiredWorkers !== null ? (
            <span className="ml-1 text-xs">
              ({husbandryCount}/{requiredWorkers})
            </span>
          ) : null}
        </td>
        <td className="py-2 pr-4 text-muted-foreground text-xs">
          {maintenanceSummary}
        </td>
        {canAdmin ? (
          <td className="w-32 py-2 text-right">
            {husbandryCount > 0 ? (
              <span title="Cannot mark extinct: active worker assignments exist.">
                <Button
                  aria-label={`Mark ${instance.name} extinct`}
                  disabled
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  Mark extinct
                </Button>
              </span>
            ) : (
              <Button
                aria-label={`Mark ${instance.name} extinct`}
                size="sm"
                type="button"
                variant="destructive"
                onClick={() => {
                  setShowExtinctConfirm(true);
                }}
              >
                Mark extinct
              </Button>
            )}
          </td>
        ) : null}
      </tr>
      {showExtinctConfirm ? (
        <MarkExtinctConfirmDialog
          instance={instance}
          queryClient={queryClient}
          onClose={() => {
            setShowExtinctConfirm(false);
          }}
        />
      ) : null}
    </>
  );
}
