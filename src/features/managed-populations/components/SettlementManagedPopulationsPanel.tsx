import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
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
import {
  activeResourcesByWorldQueryOptions,
  type Resource,
} from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";

import { createManagedPopulationInstanceMutationOptions } from "../mutations/createManagedPopulationInstanceMutations";
import { removeManagedPopulationInstanceMutationOptions } from "../mutations/removeManagedPopulationInstanceMutations";
import { setConfiguredCullQuantityMutationOptions } from "../mutations/setConfiguredCullQuantityMutations";
import { managedPopulationInstancesBySettlementQueryOptions } from "../queries/managedPopulationInstancesQueries";
import { activeManagedPopulationTypesByWorldQueryOptions } from "../queries/managedPopulationsQueries";
import { createManagedPopulationInstanceInputSchema } from "../schemas/createManagedPopulationInstanceSchemas";

import type {
  ManagedPopulationInstance,
  ManagedPopulationInstanceStatus,
} from "../types/managedPopulationInstanceTypes";
import type { ManagedPopulationType } from "../types/managedPopulationTypes";

type SettlementManagedPopulationsPanelProps = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementManagedPopulationsPanel({
  canAdmin,
  canManage,
  isArchived,
  settlementId,
  worldId,
}: SettlementManagedPopulationsPanelProps): JSX.Element {
  const queryClient = useQueryClient();

  const instancesQuery = useQuery(
    managedPopulationInstancesBySettlementQueryOptions(settlementId),
  );
  const typesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );

  const typeById = new Map<string, ManagedPopulationType>();
  if (typesQuery.data !== undefined) {
    for (const t of typesQuery.data) {
      typeById.set(t.id, t);
    }
  }

  const resourceById = new Map<string, Resource>();
  if (resourcesQuery.data !== undefined) {
    for (const r of resourcesQuery.data) {
      resourceById.set(r.id, r);
    }
  }

  // Count husbandry assignments per managed population instance
  const husbandryCountByInstance = new Map<string, number>();
  if (assignmentsQuery.data !== undefined) {
    for (const a of assignmentsQuery.data) {
      if (
        a.assignmentType === "husbandry" &&
        a.managedPopulationInstanceId !== null
      ) {
        husbandryCountByInstance.set(
          a.managedPopulationInstanceId,
          (husbandryCountByInstance.get(a.managedPopulationInstanceId) ?? 0) +
            1,
        );
      }
    }
  }

  return (
    <section
      aria-labelledby="settlement-managed-populations-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <ManagedPopulationsPanelHeader
        canAdmin={canAdmin && !isArchived}
        instancesLoaded={!instancesQuery.isPending}
        queryClient={queryClient}
        settlementId={settlementId}
        worldId={worldId}
      />

      {instancesQuery.isPending ? (
        <LoadingState label="Loading managed populations…" />
      ) : instancesQuery.isError ? (
        <ErrorState
          description={getErrorDescription(instancesQuery.error)}
          title="Managed populations could not be loaded"
        />
      ) : instancesQuery.data.length === 0 ? (
        <EmptyState
          description="This settlement has no managed population instances."
          title="No managed populations"
        />
      ) : (
        <ManagedPopulationsGroups
          canAdmin={canAdmin && !isArchived}
          canManage={(canManage || canAdmin) && !isArchived}
          husbandryCountByInstance={husbandryCountByInstance}
          instances={instancesQuery.data}
          queryClient={queryClient}
          resourceById={resourceById}
          typeById={typeById}
        />
      )}
    </section>
  );
}

function ManagedPopulationsPanelHeader({
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
        <h2
          className="text-base font-medium"
          id="settlement-managed-populations-heading"
        >
          Managed Populations
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
            Add managed population
          </Button>
        ) : null}
      </div>
      {showAddDialog ? (
        <AddManagedPopulationDialog
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
  readonly status: ManagedPopulationInstanceStatus;
};

const STATUS_GROUPS: readonly StatusGroup[] = [
  { label: "Active", status: "active" },
  { label: "Extinct", status: "extinct" },
];

function ManagedPopulationsGroups({
  canAdmin,
  canManage,
  husbandryCountByInstance,
  instances,
  queryClient,
  resourceById,
  typeById,
}: {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly husbandryCountByInstance: ReadonlyMap<string, number>;
  readonly instances: readonly ManagedPopulationInstance[];
  readonly queryClient: QueryClient;
  readonly resourceById: ReadonlyMap<string, Resource>;
  readonly typeById: ReadonlyMap<string, ManagedPopulationType>;
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
        const groupInstances = instances.filter(
          (inst) => inst.status === group.status,
        );
        if (groupInstances.length === 0) return null;
        const isCollapsed = collapsedGroups.has(group.label);
        const panelId = `managed-populations-group-${group.label.toLowerCase()}`;
        return (
          <ManagedPopulationsStatusGroup
            key={group.label}
            canAdmin={canAdmin && group.status === "active"}
            canManage={canManage && group.status === "active"}
            husbandryCountByInstance={husbandryCountByInstance}
            instances={groupInstances}
            isCollapsed={isCollapsed}
            label={group.label}
            panelId={panelId}
            queryClient={queryClient}
            resourceById={resourceById}
            typeById={typeById}
            onToggle={() => {
              toggleGroup(group.label);
            }}
          />
        );
      })}
    </div>
  );
}

function ManagedPopulationsStatusGroup({
  canAdmin,
  canManage,
  husbandryCountByInstance,
  instances,
  isCollapsed,
  label,
  onToggle,
  panelId,
  queryClient,
  resourceById,
  typeById,
}: {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly husbandryCountByInstance: ReadonlyMap<string, number>;
  readonly instances: readonly ManagedPopulationInstance[];
  readonly isCollapsed: boolean;
  readonly label: string;
  readonly onToggle: () => void;
  readonly panelId: string;
  readonly queryClient: QueryClient;
  readonly resourceById: ReadonlyMap<string, Resource>;
  readonly typeById: ReadonlyMap<string, ManagedPopulationType>;
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
                  Count
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Cull qty
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Husbandry / workers
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Maintenance/turn
                </th>
                {canAdmin ? (
                  <th aria-label="Actions" className="w-32 pb-2" scope="col" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <ManagedPopulationInstanceRow
                  key={instance.id}
                  canAdmin={canAdmin}
                  canManage={canManage}
                  husbandryCount={
                    husbandryCountByInstance.get(instance.id) ?? 0
                  }
                  instance={instance}
                  queryClient={queryClient}
                  resourceById={resourceById}
                  type={typeById.get(instance.managedPopulationTypeId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ManagedPopulationInstanceRow({
  canAdmin,
  canManage,
  husbandryCount,
  instance,
  queryClient,
  resourceById,
  type,
}: {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly husbandryCount: number;
  readonly instance: ManagedPopulationInstance;
  readonly queryClient: QueryClient;
  readonly resourceById: ReadonlyMap<string, Resource>;
  readonly type: ManagedPopulationType | undefined;
}): JSX.Element {
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
        <td className="py-2 pr-4 font-medium">{instance.name}</td>
        <td className="py-2 pr-4 text-muted-foreground">
          {instance.managedPopulationTypeName}
        </td>
        <td className="py-2 pr-4">
          <span className="flex items-center gap-1">
            {instance.currentCount.toLocaleString()}
            {trendValue !== null ? (
              trendValue > 0 ? (
                <TrendingUp
                  aria-label="Growing"
                  className="h-3.5 w-3.5 text-green-600"
                />
              ) : (
                <TrendingDown
                  aria-label="Declining"
                  className="h-3.5 w-3.5 text-red-600"
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

function CullQuantityEditor({
  instance,
  onClose,
  queryClient,
}: {
  readonly instance: ManagedPopulationInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
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

function MarkExtinctConfirmDialog({
  instance,
  onClose,
  queryClient,
}: {
  readonly instance: ManagedPopulationInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const mutation = useMutation(
    removeManagedPopulationInstanceMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({
        managedPopulationInstanceId: instance.id,
      });
      notifyMutationSuccess(`${instance.name} marked extinct.`);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to mark population extinct.");
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
          <DialogTitle>Mark {instance.name} extinct?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will mark{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          as extinct. This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
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
            Mark extinct
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddManagedPopulationDialog({
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
  const typesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );
  const mutation = useMutation(
    createManagedPopulationInstanceMutationOptions({ queryClient }),
  );

  const types = typesQuery.data ?? [];

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [initialCount, setInitialCount] = useState("");
  const [initialCullQuantity, setInitialCullQuantity] = useState("0");

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [typeError, setTypeError] = useState<string | undefined>(undefined);
  const [initialCountError, setInitialCountError] = useState<
    string | undefined
  >(undefined);
  const [initialCullError, setInitialCullError] = useState<string | undefined>(
    undefined,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    setTypeError(undefined);
    setInitialCountError(undefined);
    setInitialCullError(undefined);

    const parsedCount = parseFloat(initialCount);
    const parsedCull = parseFloat(initialCullQuantity);

    const input = {
      initialCount: parsedCount,
      initialCullQuantity: parsedCull,
      name,
      settlementId,
      typeId,
    };

    const result = createManagedPopulationInstanceInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      if (errors.name !== undefined) setNameError(errors.name);
      if (errors.typeId !== undefined) setTypeError(errors.typeId);
      if (errors.initialCount !== undefined)
        setInitialCountError(errors.initialCount);
      if (errors.initialCullQuantity !== undefined)
        setInitialCullError(errors.initialCullQuantity);
      return;
    }

    mutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to create managed population.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Managed population created.");
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
      <DialogContent>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add managed population</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={nameError !== undefined}
                aria-label="Name"
                disabled={mutation.isPending}
                maxLength={
                  managedPopulationInputLimits.populationInstanceNameMax
                }
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
              <span className="text-muted-foreground">Population type</span>
              {types.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active population types available.
                </p>
              ) : (
                <NativeSelect
                  aria-invalid={typeError !== undefined}
                  aria-label="Population type"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={typeId}
                  onChange={(e) => {
                    setTypeId(e.currentTarget.value);
                  }}
                >
                  <option value="">Select a population type…</option>
                  {sortByName(types).map((t: ManagedPopulationType) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {typeError !== undefined ? (
                <p className="text-xs text-destructive">{typeError}</p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Initial count</span>
              <Input
                aria-invalid={initialCountError !== undefined}
                aria-label="Initial count"
                disabled={mutation.isPending}
                inputMode="numeric"
                min={1}
                type="number"
                value={initialCount}
                onChange={(e) => {
                  setInitialCount(e.currentTarget.value);
                }}
              />
              {initialCountError !== undefined ? (
                <p className="text-xs text-destructive">{initialCountError}</p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Initial cull quantity
              </span>
              <Input
                aria-invalid={initialCullError !== undefined}
                aria-label="Initial cull quantity"
                disabled={mutation.isPending}
                inputMode="numeric"
                min={0}
                type="number"
                value={initialCullQuantity}
                onChange={(e) => {
                  setInitialCullQuantity(e.currentTarget.value);
                }}
              />
              {initialCullError !== undefined ? (
                <p className="text-xs text-destructive">{initialCullError}</p>
              ) : null}
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              type="button"
              variant="outline"
              onClick={onClose}
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
