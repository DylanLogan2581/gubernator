import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import {
  latestSettlementTransitionOutcomeQueryOptions,
  type TurnTransitionOutcome,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";
import { depositInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";

import { createDepositInstanceMutationOptions } from "../mutations/createDepositInstanceMutations";
import { removeDepositInstanceMutationOptions } from "../mutations/removeDepositInstanceMutations";
import { setDepositInstanceMaxWorkersMutationOptions } from "../mutations/setDepositInstanceMaxWorkersMutations";
import { depositInstancesBySettlementQueryOptions } from "../queries/depositInstancesQueries";
import { activeDepositTypesByWorldQueryOptions } from "../queries/depositsQueries";
import { createDepositInstanceInputSchema } from "../schemas/createDepositInstanceSchemas";

import type {
  DepositInstance,
  DepositInstanceStatus,
} from "../types/depositInstanceTypes";
import type { DepositType } from "../types/depositTypes";

type SettlementDepositsPanelProps = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDepositsPanel({
  canAdmin,
  canManage,
  isArchived,
  settlementId,
  worldId,
}: SettlementDepositsPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const instancesQuery = useQuery(
    depositInstancesBySettlementQueryOptions(settlementId),
  );
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const latestOutcomeQuery = useQuery(
    latestSettlementTransitionOutcomeQueryOptions(settlementId),
  );

  const assignedCountByInstance = new Map<string, number>();
  if (assignmentsQuery.data !== undefined) {
    for (const a of assignmentsQuery.data) {
      if (a.assignmentType === "deposit" && a.depositInstance !== null) {
        const id = a.depositInstance.id;
        assignedCountByInstance.set(
          id,
          (assignedCountByInstance.get(id) ?? 0) + 1,
        );
      }
    }
  }

  return (
    <section
      aria-labelledby="settlement-deposits-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <DepositsPanelHeader
        canAdmin={canAdmin && !isArchived}
        instancesLoaded={!instancesQuery.isPending}
        queryClient={queryClient}
        settlementId={settlementId}
        worldId={worldId}
      />

      {instancesQuery.isPending ? (
        <LoadingState label="Loading deposits…" />
      ) : instancesQuery.isError ? (
        <ErrorState
          title="Deposits could not be loaded"
          description={getErrorDescription(instancesQuery.error)}
        />
      ) : instancesQuery.data.length === 0 ? (
        <EmptyState
          title="No deposits"
          description="This settlement has no deposit instances."
        />
      ) : (
        <DepositsGroups
          assignedCountByInstance={assignedCountByInstance}
          canAdmin={canAdmin && !isArchived}
          canManage={(canManage || canAdmin) && !isArchived}
          instances={instancesQuery.data}
          latestOutcome={latestOutcomeQuery.data ?? null}
          queryClient={queryClient}
          settlementId={settlementId}
        />
      )}
    </section>
  );
}

function DepositsPanelHeader({
  canAdmin,
  instancesLoaded,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly instancesLoaded: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 id="settlement-deposits-heading" className="text-base font-medium">
          Deposits
        </h2>
        {canAdmin && instancesLoaded ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              setShowAddDialog(true);
            }}
          >
            <Plus aria-hidden="true" />
            Add deposit instance
          </Button>
        ) : null}
      </div>
      {showAddDialog ? (
        <AddDepositInstanceDialog
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setShowAddDialog(false);
          }}
        />
      ) : null}
    </>
  );
}

type StatusGroup = {
  readonly label: string;
  readonly statuses: readonly DepositInstanceStatus[];
};

const STATUS_GROUPS: readonly StatusGroup[] = [
  { label: "Active", statuses: ["active"] },
  { label: "Depleted", statuses: ["depleted"] },
  { label: "Removed", statuses: ["removed"] },
];

function DepositsGroups({
  assignedCountByInstance,
  canAdmin,
  canManage,
  instances,
  latestOutcome,
  queryClient,
  settlementId,
}: {
  readonly assignedCountByInstance: ReadonlyMap<string, number>;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly instances: readonly DepositInstance[];
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function toggleGroup(label: string): void {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      {STATUS_GROUPS.map((group) => {
        const groupInstances = instances.filter((inst) =>
          (group.statuses as readonly string[]).includes(inst.status),
        );
        if (groupInstances.length === 0) return null;
        const isCollapsed = collapsedGroups.has(group.label);
        const panelId = `deposits-group-${group.label.toLowerCase()}`;
        return (
          <DepositsStatusGroup
            key={group.label}
            assignedCountByInstance={assignedCountByInstance}
            canAdmin={canAdmin && group.statuses.includes("active")}
            canManage={canManage && group.statuses.includes("active")}
            instances={groupInstances}
            isCollapsed={isCollapsed}
            label={group.label}
            latestOutcome={latestOutcome}
            panelId={panelId}
            queryClient={queryClient}
            settlementId={settlementId}
            onToggle={() => {
              toggleGroup(group.label);
            }}
          />
        );
      })}
    </div>
  );
}

function DepositsStatusGroup({
  assignedCountByInstance,
  canAdmin,
  canManage,
  instances,
  isCollapsed,
  label,
  latestOutcome,
  onToggle,
  panelId,
  queryClient,
  settlementId,
}: {
  readonly assignedCountByInstance: ReadonlyMap<string, number>;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly instances: readonly DepositInstance[];
  readonly isCollapsed: boolean;
  readonly label: string;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly onToggle: () => void;
  readonly panelId: string;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  return (
    <div className="grid gap-1">
      <button
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        className="flex cursor-pointer items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        onClick={onToggle}
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        )}
        {label} ({instances.length})
      </button>
      {!isCollapsed ? (
        <div id={panelId}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium" scope="col">
                  Name
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Type
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Resources
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Workers
                </th>
                {canAdmin || canManage ? (
                  <th className="w-36 pb-2" scope="col" aria-label="Actions" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <DepositInstanceRow
                  key={instance.id}
                  assignedCount={assignedCountByInstance.get(instance.id) ?? 0}
                  canAdmin={canAdmin}
                  canManage={canManage}
                  instance={instance}
                  latestOutcome={latestOutcome}
                  queryClient={queryClient}
                  settlementId={settlementId}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

type DepositDepletedPayload = {
  readonly depositId: string;
};

function parseDepositDepletedPayload(
  payload: unknown,
): DepositDepletedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.depositId !== "string") return null;
  return { depositId: p.depositId };
}

function depositDepletedTooltip(
  depositId: string,
  latestOutcome: TurnTransitionOutcome | null,
): string | undefined {
  if (latestOutcome === null) return undefined;
  const entry = latestOutcome.logEntries.find(
    (e) =>
      e.logCategory === "deposit.depleted" &&
      parseDepositDepletedPayload(e.payloadJsonb)?.depositId === depositId,
  );
  if (entry === undefined) return undefined;
  return `Turn ${latestOutcome.toTurnNumber.toString()}`;
}

function DepositInstanceRow({
  assignedCount,
  canAdmin,
  canManage,
  instance,
  latestOutcome,
  queryClient,
  settlementId,
}: {
  readonly assignedCount: number;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly instance: DepositInstance;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [showMaxWorkersEdit, setShowMaxWorkersEdit] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const isDepletion = instance.status === "depleted";
  const depletedTooltip = isDepletion
    ? depositDepletedTooltip(instance.id, latestOutcome)
    : undefined;

  const workersDisplay =
    instance.maxWorkers === null
      ? `${assignedCount.toString()} assigned`
      : `${assignedCount.toString()}/${instance.maxWorkers.toString()}`;

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4 font-medium">
          <span className="flex items-center gap-2">
            {instance.name}
            {isDepletion ? (
              <Badge
                aria-label="Depleted"
                title={depletedTooltip}
                variant="secondary"
              >
                Depleted
              </Badge>
            ) : null}
          </span>
        </td>
        <td className="py-2 pr-4 text-muted-foreground">
          {instance.depositTypeName}
        </td>
        <td className="py-2 pr-4 text-muted-foreground text-xs">
          {instance.resources.length === 0 ? (
            "—"
          ) : (
            <span className="flex flex-wrap gap-x-1">
              {instance.resources.map((r, idx) => {
                const text = `${r.resourceName}: ${r.remainingQuantity.toLocaleString()}/${r.initialQuantity.toLocaleString()}`;
                const isZero = isDepletion && r.remainingQuantity === 0;
                return (
                  <span key={r.id} className={isZero ? "line-through" : ""}>
                    {text}
                    {idx < instance.resources.length - 1 ? "," : ""}
                  </span>
                );
              })}
            </span>
          )}
        </td>
        <td className="py-2 pr-4">
          <span className="text-sm">{workersDisplay}</span>
        </td>
        {canAdmin || canManage ? (
          <td className="w-36 py-2 text-right">
            <div className="flex items-center justify-end gap-2">
              {canManage ? (
                <Button
                  aria-label={`Edit max workers for ${instance.name}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowMaxWorkersEdit(true);
                  }}
                >
                  <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                  Max
                </Button>
              ) : null}
              {canAdmin ? (
                assignedCount > 0 ? (
                  <span title="Cannot remove: deposit has assigned workers.">
                    <Button
                      aria-label={`Remove ${instance.name}`}
                      disabled
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      Remove
                    </Button>
                  </span>
                ) : (
                  <Button
                    aria-label={`Remove ${instance.name}`}
                    size="sm"
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setShowRemoveConfirm(true);
                    }}
                  >
                    Remove
                  </Button>
                )
              ) : null}
            </div>
          </td>
        ) : null}
      </tr>
      {showMaxWorkersEdit ? (
        <MaxWorkersEditDialog
          assignedCount={assignedCount}
          instance={instance}
          queryClient={queryClient}
          settlementId={settlementId}
          onClose={() => {
            setShowMaxWorkersEdit(false);
          }}
        />
      ) : null}
      {showRemoveConfirm ? (
        <RemoveDepositConfirmDialog
          instance={instance}
          queryClient={queryClient}
          onClose={() => {
            setShowRemoveConfirm(false);
          }}
        />
      ) : null}
    </>
  );
}

function MaxWorkersEditDialog({
  assignedCount,
  instance,
  onClose,
  queryClient,
  settlementId,
}: {
  readonly assignedCount: number;
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [maxWorkers, setMaxWorkers] = useState(
    instance.maxWorkers !== null ? String(instance.maxWorkers) : "",
  );
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [showShrinkConfirm, setShowShrinkConfirm] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<
    "npc_first" | "random"
  >("npc_first");

  const mutation = useMutation(
    setDepositInstanceMaxWorkersMutationOptions({ queryClient }),
  );

  const parsedMax = maxWorkers !== "" ? parseInt(maxWorkers, 10) : null;
  const cascadeCount =
    parsedMax !== null && !Number.isNaN(parsedMax) && parsedMax < assignedCount
      ? assignedCount - parsedMax
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);

    if (
      maxWorkers !== "" &&
      (Number.isNaN(parsedMax) || (parsedMax !== null && parsedMax < 1))
    ) {
      setFieldError("Max workers must be at least 1.");
      return;
    }

    const newMax = maxWorkers !== "" ? parsedMax : null;

    if (newMax !== null && newMax < assignedCount) {
      setShowShrinkConfirm(true);
      return;
    }

    void submitMaxWorkers(newMax, null);
  }

  async function submitMaxWorkers(
    newMax: number | null,
    strategy: "npc_first" | "random" | null,
  ): Promise<void> {
    try {
      const result = await mutation.mutateAsync({
        depositInstanceId: instance.id,
        maxWorkers: newMax,
        removalStrategy: strategy,
        settlementId,
      });
      const count = result.unassignedCitizenIds.length;
      if (count > 0) {
        notifyMutationSuccess(
          `Max workers updated. ${count.toString()} ${count === 1 ? "citizen was" : "citizens were"} unassigned.`,
        );
      } else {
        notifyMutationSuccess("Max workers updated.");
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to update max workers.");
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
        {showShrinkConfirm ? (
          <>
            <DialogHeader>
              <DialogTitle>Unassign workers?</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Reducing max workers to{" "}
              <span className="font-medium text-foreground">
                {String(parsedMax)}
              </span>{" "}
              will cascade-unassign{" "}
              <span className="font-medium text-foreground">
                {String(cascadeCount)}
              </span>{" "}
              {cascadeCount === 1 ? "citizen" : "citizens"}.
            </DialogDescription>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Removal strategy</span>
              <NativeSelect
                aria-label="Removal strategy"
                className="w-full"
                disabled={mutation.isPending}
                value={pendingStrategy}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  if (val === "npc_first" || val === "random") {
                    setPendingStrategy(val);
                  }
                }}
              >
                <option value="npc_first">NPC first</option>
                <option value="random">Random</option>
              </NativeSelect>
            </label>
            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={mutation.isPending}
                type="button"
                variant="destructive"
                onClick={() => {
                  void submitMaxWorkers(parsedMax, pendingStrategy);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form className="contents" noValidate onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit max workers — {instance.name}</DialogTitle>
            </DialogHeader>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Max workers (leave blank for unlimited)
              </span>
              <Input
                aria-invalid={fieldError !== undefined}
                aria-label="Max workers"
                disabled={mutation.isPending}
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxWorkers}
                onChange={(e) => {
                  setMaxWorkers(e.currentTarget.value);
                }}
              />
              {fieldError !== undefined ? (
                <p className="text-xs text-destructive">{fieldError}</p>
              ) : null}
            </label>
            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={mutation.isPending} type="submit">
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RemoveDepositConfirmDialog({
  instance,
  onClose,
  queryClient,
}: {
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const mutation = useMutation(
    removeDepositInstanceMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({ depositInstanceId: instance.id });
      notifyMutationSuccess(`${instance.name} removed.`);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to remove deposit instance.");
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
        <DialogHeader>
          <DialogTitle>Remove {instance.name}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently remove{" "}
          <span className="font-medium text-foreground">{instance.name}</span>.
          This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDepositInstanceDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const depositTypesQuery = useQuery(
    activeDepositTypesByWorldQueryOptions(worldId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const mutation = useMutation(
    createDepositInstanceMutationOptions({ queryClient }),
  );

  const depositTypes = depositTypesQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];

  const [name, setName] = useState("");
  const [depositTypeId, setDepositTypeId] = useState("");
  const [maxWorkers, setMaxWorkers] = useState("");
  const [resourceEntries, setResourceEntries] = useState<ResourceAmountEntry[]>(
    [],
  );
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [depositTypeError, setDepositTypeError] = useState<string | undefined>(
    undefined,
  );
  const [maxWorkersError, setMaxWorkersError] = useState<string | undefined>(
    undefined,
  );
  const [resourcesError, setResourcesError] = useState<string | undefined>(
    undefined,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    setDepositTypeError(undefined);
    setMaxWorkersError(undefined);
    setResourcesError(undefined);

    const parsedMax = maxWorkers !== "" ? parseInt(maxWorkers, 10) : undefined;

    const input = {
      depositTypeId,
      maxWorkers: parsedMax,
      name,
      resources: resourceEntries.map((e) => ({
        initialQuantity: parseFloat(e.amount),
        resourceId: e.resourceId,
      })),
      settlementId,
    };

    const result = createDepositInstanceInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      if (errors.name !== undefined) setNameError(errors.name);
      if (errors.depositTypeId !== undefined)
        setDepositTypeError(errors.depositTypeId);
      if (errors.maxWorkers !== undefined)
        setMaxWorkersError(errors.maxWorkers);
      if (errors.resources !== undefined) setResourcesError(errors.resources);
      return;
    }

    mutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to create deposit instance.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Deposit instance created.");
        onClose();
      },
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add deposit instance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={nameError !== undefined}
                aria-label="Name"
                disabled={mutation.isPending}
                maxLength={depositInputLimits.depositInstanceNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {nameError !== undefined ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Deposit type</span>
              {depositTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active deposit types available.
                </p>
              ) : (
                <NativeSelect
                  aria-invalid={depositTypeError !== undefined}
                  aria-label="Deposit type"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={depositTypeId}
                  onChange={(e) => {
                    setDepositTypeId(e.currentTarget.value);
                  }}
                >
                  <option value="">Select a deposit type…</option>
                  {sortByName(depositTypes).map((dt: DepositType) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {depositTypeError !== undefined ? (
                <p className="text-xs text-destructive">{depositTypeError}</p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Max workers (leave blank for unlimited)
              </span>
              <Input
                aria-invalid={maxWorkersError !== undefined}
                aria-label="Max workers"
                disabled={mutation.isPending}
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxWorkers}
                onChange={(e) => {
                  setMaxWorkers(e.currentTarget.value);
                }}
              />
              {maxWorkersError !== undefined ? (
                <p className="text-xs text-destructive">{maxWorkersError}</p>
              ) : null}
            </label>
            <ResourceAmountListEditor
              addLabel="Add resource"
              amountLabel="initial quantity"
              disabled={mutation.isPending}
              entries={resourceEntries}
              fieldError={resourcesError}
              label="Resources"
              resources={resources}
              onChange={setResourceEntries}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
