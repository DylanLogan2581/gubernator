import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  depositInstancesBySettlementQueryOptions,
  type DepositInstance,
} from "@/features/deposits";
import {
  managedPopulationInstancesBySettlementQueryOptions,
  type ManagedPopulationInstance,
} from "@/features/managed-populations";
import {
  tradeRoutesForSettlementQueryOptions,
  type TradeRoute,
} from "@/features/trade";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetAssignmentMutationOptions } from "../../mutations/perTargetAssignmentMutations";
import { citizensInSettlementQueryOptions } from "../../queries/citizensQueries";
import { settlementTargetAssignmentsQueryOptions } from "../../queries/settlementTargetAssignmentsQueries";

import type { Citizen } from "../../types/citizenTypes";

type PerTargetJobsTabProps = {
  readonly canEdit: boolean;
  readonly settlementId: string;
};

export function PerTargetJobsTab({
  canEdit,
  settlementId,
}: PerTargetJobsTabProps): JSX.Element {
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const depositsQuery = useQuery(
    depositInstancesBySettlementQueryOptions(settlementId),
  );
  const populationsQuery = useQuery(
    managedPopulationInstancesBySettlementQueryOptions(settlementId),
  );
  const tradeRoutesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );

  if (
    assignmentsQuery.isPending ||
    depositsQuery.isPending ||
    populationsQuery.isPending ||
    tradeRoutesQuery.isPending ||
    citizensQuery.isPending
  ) {
    return <LoadingState label="Loading per-target assignments…" />;
  }

  const firstError =
    assignmentsQuery.error ??
    depositsQuery.error ??
    populationsQuery.error ??
    tradeRoutesQuery.error ??
    citizensQuery.error;
  if (firstError !== null && firstError !== undefined) {
    return (
      <ErrorState
        title="Per-target assignments could not be loaded"
        description={getErrorDescription(firstError)}
      />
    );
  }

  const assignments = assignmentsQuery.data ?? [];
  const deposits = (depositsQuery.data ?? []).filter(
    (d) => d.status === "active",
  );
  const populations = (populationsQuery.data ?? []).filter(
    (p) => p.status === "active",
  );
  const tradeRoutes = (tradeRoutesQuery.data ?? []).filter(
    (r) => r.status === "active",
  );
  const citizens = citizensQuery.data ?? [];

  const assignedByDeposit = new Map<string, string[]>();
  const assignedByHusbandry = new Map<string, string[]>();
  const assignedByCulling = new Map<string, string[]>();
  const assignedByTradeRouteEnd = new Map<string, string[]>();

  for (const a of assignments) {
    if (a.assignmentType === "deposit" && a.depositInstanceId !== null) {
      const ids = assignedByDeposit.get(a.depositInstanceId) ?? [];
      ids.push(a.citizenId);
      assignedByDeposit.set(a.depositInstanceId, ids);
    } else if (
      a.assignmentType === "husbandry" &&
      a.managedPopulationInstanceId !== null
    ) {
      const ids = assignedByHusbandry.get(a.managedPopulationInstanceId) ?? [];
      ids.push(a.citizenId);
      assignedByHusbandry.set(a.managedPopulationInstanceId, ids);
    } else if (
      a.assignmentType === "culling" &&
      a.managedPopulationInstanceId !== null
    ) {
      const ids = assignedByCulling.get(a.managedPopulationInstanceId) ?? [];
      ids.push(a.citizenId);
      assignedByCulling.set(a.managedPopulationInstanceId, ids);
    } else if (
      a.assignmentType === "trade_route" &&
      a.tradeRouteId !== null &&
      a.tradeRouteEnd !== null
    ) {
      const key = `${a.tradeRouteId}:${a.tradeRouteEnd}`;
      const ids = assignedByTradeRouteEnd.get(key) ?? [];
      ids.push(a.citizenId);
      assignedByTradeRouteEnd.set(key, ids);
    }
  }

  const citizenMap = new Map(citizens.map((c) => [c.id, c]));
  const aliveCitizens = citizens.filter(
    (c) => c.status === "alive" && c.citizenType === "npc",
  );

  return (
    <div className="grid gap-4">
      <DepositsSection
        aliveCitizens={aliveCitizens}
        assignedByDeposit={assignedByDeposit}
        canEdit={canEdit}
        citizenMap={citizenMap}
        deposits={deposits}
        queryClient={queryClient}
        settlementId={settlementId}
      />
      <HusbandrySection
        aliveCitizens={aliveCitizens}
        assignedByHusbandry={assignedByHusbandry}
        canEdit={canEdit}
        citizenMap={citizenMap}
        populations={populations}
        queryClient={queryClient}
        settlementId={settlementId}
      />
      <CullingSection
        aliveCitizens={aliveCitizens}
        assignedByCulling={assignedByCulling}
        canEdit={canEdit}
        citizenMap={citizenMap}
        populations={populations}
        queryClient={queryClient}
        settlementId={settlementId}
      />
      <TradeRoutesSection
        aliveCitizens={aliveCitizens}
        assignedByTradeRouteEnd={assignedByTradeRouteEnd}
        canEdit={canEdit}
        citizenMap={citizenMap}
        queryClient={queryClient}
        settlementId={settlementId}
        tradeRoutes={tradeRoutes}
      />
    </div>
  );
}

function CollapsibleSection({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}): JSX.Element {
  return (
    <Collapsible defaultOpen className="grid gap-2">
      <CollapsibleTrigger className="group flex items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 -rotate-90 transition-transform group-data-[state=open]:rotate-0"
        />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function CitizenTags({
  assignedIds,
  canEdit,
  citizenMap,
  isPending,
  labelPrefix,
  onRemove,
}: {
  readonly assignedIds: readonly string[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly isPending: boolean;
  readonly labelPrefix: string;
  readonly onRemove: (citizenId: string) => void;
}): JSX.Element {
  if (assignedIds.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        No citizens assigned.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assignedIds.map((id) => {
        const name = citizenMap.get(id)?.name ?? id;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {name}
            {canEdit ? (
              <button
                aria-label={`Remove ${name} from ${labelPrefix}`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={isPending}
                type="button"
                onClick={() => {
                  onRemove(id);
                }}
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function AssignDialog({
  aliveCitizens,
  currentCitizenIds,
  isPending,
  onClose,
  onSubmit,
  title,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly currentCitizenIds: readonly string[];
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (citizenIds: string[]) => void;
  readonly title: string;
}): JSX.Element {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(currentCitizenIds),
  );

  function handleToggle(citizenId: string, checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(citizenId);
      } else {
        next.delete(citizenId);
      }
      return next;
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto">
          {aliveCitizens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alive citizens in this settlement.
            </p>
          ) : (
            <ul className="grid gap-0.5">
              {aliveCitizens.map((citizen) => (
                <li key={citizen.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input
                      checked={selected.has(citizen.id)}
                      className="accent-foreground"
                      disabled={isPending}
                      type="checkbox"
                      onChange={(e) => {
                        handleToggle(citizen.id, e.currentTarget.checked);
                      }}
                    />
                    {citizen.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            onClick={() => {
              onSubmit([...selected]);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetRowShell({
  assignButton,
  capacityHint,
  children,
  label,
}: {
  readonly assignButton?: ReactNode;
  readonly capacityHint?: string;
  readonly children: ReactNode;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {capacityHint !== undefined ? (
            <span className="text-xs text-muted-foreground">
              {capacityHint}
            </span>
          ) : null}
        </div>
        {assignButton}
      </div>
      {children}
    </div>
  );
}

function DepositsSection({
  aliveCitizens,
  assignedByDeposit,
  canEdit,
  citizenMap,
  deposits,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedByDeposit: ReadonlyMap<string, readonly string[]>;
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly deposits: readonly DepositInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  return (
    <CollapsibleSection title="Deposits">
      {deposits.length === 0 ? (
        <EmptyState
          title="No active deposits"
          description="This settlement has no active deposit instances."
        />
      ) : (
        deposits.map((deposit) => (
          <DepositTargetRow
            key={deposit.id}
            aliveCitizens={aliveCitizens}
            assignedIds={assignedByDeposit.get(deposit.id) ?? []}
            canEdit={canEdit}
            citizenMap={citizenMap}
            deposit={deposit}
            queryClient={queryClient}
            settlementId={settlementId}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function DepositTargetRow({
  aliveCitizens,
  assignedIds,
  canEdit,
  citizenMap,
  deposit,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedIds: readonly string[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly deposit: DepositInstance;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [showDialog, setShowDialog] = useState(false);
  const mutation = useMutation(
    setPerTargetAssignmentMutationOptions({ queryClient }),
  );

  const label = `${deposit.name} — ${deposit.depositTypeJobName}`;
  const capacityHint =
    deposit.maxWorkers !== null
      ? `${assignedIds.length.toString()} / ${deposit.maxWorkers.toString()}`
      : `${assignedIds.length.toString()} assigned`;

  async function handleAssign(citizenIds: string[]): Promise<void> {
    try {
      await mutation.mutateAsync({
        assignmentType: "deposit",
        citizenIds,
        settlementId,
        targetId: deposit.id,
      });
      setShowDialog(false);
      notifyMutationSuccess("Deposit assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update deposit assignment.");
    }
  }

  function handleRemove(citizenId: string): void {
    const newIds = assignedIds.filter((id) => id !== citizenId);
    void mutation
      .mutateAsync({
        assignmentType: "deposit",
        citizenIds: newIds,
        settlementId,
        targetId: deposit.id,
      })
      .then(() => {
        notifyMutationSuccess("Deposit assignment updated.");
      })
      .catch((error: unknown) => {
        notifyMutationError(error, "Failed to update deposit assignment.");
      });
  }

  return (
    <>
      <TargetRowShell
        assignButton={
          canEdit ? (
            <Button
              disabled={mutation.isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(true);
              }}
            >
              Assign citizens
            </Button>
          ) : undefined
        }
        capacityHint={capacityHint}
        label={label}
      >
        <CitizenTags
          assignedIds={assignedIds}
          canEdit={canEdit}
          citizenMap={citizenMap}
          isPending={mutation.isPending}
          labelPrefix={label}
          onRemove={handleRemove}
        />
      </TargetRowShell>
      {showDialog ? (
        <AssignDialog
          aliveCitizens={aliveCitizens}
          currentCitizenIds={assignedIds}
          isPending={mutation.isPending}
          title={`Assign workers to ${label}`}
          onClose={() => {
            setShowDialog(false);
          }}
          onSubmit={(ids) => {
            void handleAssign(ids);
          }}
        />
      ) : null}
    </>
  );
}

function HusbandrySection({
  aliveCitizens,
  assignedByHusbandry,
  canEdit,
  citizenMap,
  populations,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedByHusbandry: ReadonlyMap<string, readonly string[]>;
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly populations: readonly ManagedPopulationInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  return (
    <CollapsibleSection title="Husbandry">
      {populations.length === 0 ? (
        <EmptyState
          title="No active populations"
          description="This settlement has no active managed population instances."
        />
      ) : (
        populations.map((pop) => (
          <PopulationTargetRow
            key={pop.id}
            aliveCitizens={aliveCitizens}
            assignedIds={assignedByHusbandry.get(pop.id) ?? []}
            assignmentType="husbandry"
            canEdit={canEdit}
            citizenMap={citizenMap}
            jobName={pop.husbandryJobName}
            population={pop}
            queryClient={queryClient}
            settlementId={settlementId}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function CullingSection({
  aliveCitizens,
  assignedByCulling,
  canEdit,
  citizenMap,
  populations,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedByCulling: ReadonlyMap<string, readonly string[]>;
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly populations: readonly ManagedPopulationInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  return (
    <CollapsibleSection title="Culling">
      {populations.length === 0 ? (
        <EmptyState
          title="No active populations"
          description="This settlement has no active managed population instances."
        />
      ) : (
        populations.map((pop) => (
          <PopulationTargetRow
            key={pop.id}
            aliveCitizens={aliveCitizens}
            assignedIds={assignedByCulling.get(pop.id) ?? []}
            assignmentType="culling"
            canEdit={canEdit}
            citizenMap={citizenMap}
            jobName={pop.cullingJobName}
            population={pop}
            queryClient={queryClient}
            settlementId={settlementId}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function PopulationTargetRow({
  aliveCitizens,
  assignedIds,
  assignmentType,
  canEdit,
  citizenMap,
  jobName,
  population,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedIds: readonly string[];
  readonly assignmentType: "culling" | "husbandry";
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly jobName: string;
  readonly population: ManagedPopulationInstance;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [showDialog, setShowDialog] = useState(false);
  const mutation = useMutation(
    setPerTargetAssignmentMutationOptions({ queryClient }),
  );

  const label = `${population.name} — ${jobName}`;
  const capacityHint = `${assignedIds.length.toString()} assigned`;

  async function handleAssign(citizenIds: string[]): Promise<void> {
    try {
      await mutation.mutateAsync({
        assignmentType,
        citizenIds,
        settlementId,
        targetId: population.id,
      });
      setShowDialog(false);
      notifyMutationSuccess("Assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update assignment.");
    }
  }

  function handleRemove(citizenId: string): void {
    const newIds = assignedIds.filter((id) => id !== citizenId);
    void mutation
      .mutateAsync({
        assignmentType,
        citizenIds: newIds,
        settlementId,
        targetId: population.id,
      })
      .then(() => {
        notifyMutationSuccess("Assignment updated.");
      })
      .catch((error: unknown) => {
        notifyMutationError(error, "Failed to update assignment.");
      });
  }

  return (
    <>
      <TargetRowShell
        assignButton={
          canEdit ? (
            <Button
              disabled={mutation.isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(true);
              }}
            >
              Assign citizens
            </Button>
          ) : undefined
        }
        capacityHint={capacityHint}
        label={label}
      >
        <CitizenTags
          assignedIds={assignedIds}
          canEdit={canEdit}
          citizenMap={citizenMap}
          isPending={mutation.isPending}
          labelPrefix={label}
          onRemove={handleRemove}
        />
      </TargetRowShell>
      {showDialog ? (
        <AssignDialog
          aliveCitizens={aliveCitizens}
          currentCitizenIds={assignedIds}
          isPending={mutation.isPending}
          title={`Assign workers to ${label}`}
          onClose={() => {
            setShowDialog(false);
          }}
          onSubmit={(ids) => {
            void handleAssign(ids);
          }}
        />
      ) : null}
    </>
  );
}

function TradeRoutesSection({
  aliveCitizens,
  assignedByTradeRouteEnd,
  canEdit,
  citizenMap,
  queryClient,
  settlementId,
  tradeRoutes,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedByTradeRouteEnd: ReadonlyMap<string, readonly string[]>;
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly tradeRoutes: readonly TradeRoute[];
}): JSX.Element {
  return (
    <CollapsibleSection title="Trade routes">
      {tradeRoutes.length === 0 ? (
        <EmptyState
          title="No active trade routes"
          description="This settlement has no active trade routes."
        />
      ) : (
        tradeRoutes.map((route) => {
          const localEnd =
            route.originSettlementId === settlementId
              ? "origin"
              : "destination";
          const remoteEnd = localEnd === "origin" ? "destination" : "origin";
          const remoteSettlementName =
            localEnd === "origin"
              ? route.destinationSettlementName
              : route.originSettlementName;
          const localLabel =
            localEnd === "origin"
              ? `${route.resourceName} → ${route.destinationSettlementName} — Trader (origin)`
              : `${route.originSettlementName} → ${route.resourceName} — Trader (destination)`;
          const localKey = `${route.id}:${localEnd}`;
          const remoteKey = `${route.id}:${remoteEnd}`;

          return (
            <div key={route.id} className="grid gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {route.resourceName}: {route.originSettlementName} →{" "}
                {route.destinationSettlementName}
              </p>
              <TradeRouteLocalEndRow
                aliveCitizens={aliveCitizens}
                assignedIds={assignedByTradeRouteEnd.get(localKey) ?? []}
                canEdit={canEdit}
                citizenMap={citizenMap}
                label={localLabel}
                queryClient={queryClient}
                routeId={route.id}
                settlementId={settlementId}
                tradeRouteEnd={localEnd}
              />
              <TradeRouteRemoteEndRow
                assignedCount={
                  (assignedByTradeRouteEnd.get(remoteKey) ?? []).length
                }
                remoteSettlementName={remoteSettlementName}
                tradeRouteEnd={remoteEnd}
              />
            </div>
          );
        })
      )}
    </CollapsibleSection>
  );
}

function TradeRouteLocalEndRow({
  aliveCitizens,
  assignedIds,
  canEdit,
  citizenMap,
  label,
  queryClient,
  routeId,
  settlementId,
  tradeRouteEnd,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedIds: readonly string[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly label: string;
  readonly queryClient: QueryClient;
  readonly routeId: string;
  readonly settlementId: string;
  readonly tradeRouteEnd: "destination" | "origin";
}): JSX.Element {
  const [showDialog, setShowDialog] = useState(false);
  const mutation = useMutation(
    setPerTargetAssignmentMutationOptions({ queryClient }),
  );

  const capacityHint = `${assignedIds.length.toString()} assigned`;

  async function handleAssign(citizenIds: string[]): Promise<void> {
    try {
      await mutation.mutateAsync({
        assignmentType: "trade_route",
        citizenIds,
        settlementId,
        targetId: routeId,
        tradeRouteEnd,
      });
      setShowDialog(false);
      notifyMutationSuccess("Trade route assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update trade route assignment.");
    }
  }

  function handleRemove(citizenId: string): void {
    const newIds = assignedIds.filter((id) => id !== citizenId);
    void mutation
      .mutateAsync({
        assignmentType: "trade_route",
        citizenIds: newIds,
        settlementId,
        targetId: routeId,
        tradeRouteEnd,
      })
      .then(() => {
        notifyMutationSuccess("Trade route assignment updated.");
      })
      .catch((error: unknown) => {
        notifyMutationError(error, "Failed to update trade route assignment.");
      });
  }

  return (
    <>
      <TargetRowShell
        assignButton={
          canEdit ? (
            <Button
              disabled={mutation.isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(true);
              }}
            >
              Assign citizens
            </Button>
          ) : undefined
        }
        capacityHint={capacityHint}
        label={label}
      >
        <CitizenTags
          assignedIds={assignedIds}
          canEdit={canEdit}
          citizenMap={citizenMap}
          isPending={mutation.isPending}
          labelPrefix={label}
          onRemove={handleRemove}
        />
      </TargetRowShell>
      {showDialog ? (
        <AssignDialog
          aliveCitizens={aliveCitizens}
          currentCitizenIds={assignedIds}
          isPending={mutation.isPending}
          title={`Assign traders — ${label}`}
          onClose={() => {
            setShowDialog(false);
          }}
          onSubmit={(ids) => {
            void handleAssign(ids);
          }}
        />
      ) : null}
    </>
  );
}

function TradeRouteRemoteEndRow({
  assignedCount,
  remoteSettlementName,
  tradeRouteEnd,
}: {
  readonly assignedCount: number;
  readonly remoteSettlementName: string;
  readonly tradeRouteEnd: "destination" | "origin";
}): JSX.Element {
  const endLabel = tradeRouteEnd === "origin" ? "Origin" : "Destination";
  return (
    <div className="rounded border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <span className="font-medium">
        {endLabel}: {remoteSettlementName} — Trader
      </span>
      <span className="ml-2 text-xs">
        {assignedCount.toString()} assigned (remote)
      </span>
    </div>
  );
}
