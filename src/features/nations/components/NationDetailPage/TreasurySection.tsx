import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { MasterDetailLayout } from "@/components/shared/MasterDetailLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuthUiError } from "@/features/auth";
import { useNationManageAuthority } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  grantNationResourcesMutationOptions,
  setNationTaxRateMutationOptions,
  subsidizeConstructionProjectMutationOptions,
} from "../../mutations/treasuryMutations";
import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";
import {
  nationActiveConstructionProjectsQueryOptions,
  nationActiveSubsidiesQueryOptions,
  nationLatestTaxSnapshotQueryOptions,
  nationStockpileQueryOptions,
} from "../../queries/treasuryQueries";

import type {
  Nation,
  NationActiveConstructionProject,
  NationActiveSubsidy,
  NationSettlement,
  NationStockpileEntry,
} from "../../types/nationTypes";

const TAX_RATE_MAX_PERCENT = 50;

export function NationTreasurySection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { canManageNation: canManage } = useNationManageAuthority({
    canAdmin: canAdminWorld,
    nationId: nation.id,
  });

  const queryClient = useQueryClient();
  const stockpileQuery = useQuery(nationStockpileQueryOptions(nation.id));
  const snapshotQuery = useQuery(
    nationLatestTaxSnapshotQueryOptions(nation.id),
  );
  const subsidiesQuery = useQuery(nationActiveSubsidiesQueryOptions(nation.id));

  const canMoveResources = canManage && !isArchived;

  return (
    <Card aria-labelledby="nation-treasury-heading" className="grid gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="nation-treasury-heading" className="text-base font-medium">
          Treasury
        </h2>
      </div>

      <TaxRateControl
        canManage={canManage}
        isArchived={isArchived}
        nation={nation}
        queryClient={queryClient}
        snapshot={snapshotQuery.data ?? null}
        snapshotIsPending={snapshotQuery.isPending}
      />

      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Treasury resources</h3>
        {stockpileQuery.isPending ? (
          <LoadingState label="Loading nation stockpile…" />
        ) : stockpileQuery.isError ? (
          <ErrorState
            title="Stockpile could not be loaded"
            description={getErrorDescription(stockpileQuery.error)}
          />
        ) : stockpileQuery.data.length === 0 ? (
          <EmptyState
            title="No resources"
            description="This nation does not hold any resources yet."
          />
        ) : (
          <StockpileMasterDetail
            canManage={canMoveResources}
            nation={nation}
            queryClient={queryClient}
            stockpile={sortStockpile(stockpileQuery.data)}
          />
        )}
      </div>

      <ActiveSubsidiesSection
        error={subsidiesQuery.error}
        isError={subsidiesQuery.isError}
        isPending={subsidiesQuery.isPending}
        subsidies={subsidiesQuery.data ?? []}
      />
    </Card>
  );
}

function sortStockpile(
  stockpile: readonly NationStockpileEntry[],
): readonly NationStockpileEntry[] {
  return [...stockpile].sort((a, b) => {
    if (a.isSystemResource !== b.isSystemResource) {
      return a.isSystemResource ? -1 : 1;
    }
    return a.resourceName.localeCompare(b.resourceName);
  });
}

function StockpileMasterDetail({
  canManage,
  nation,
  queryClient,
  stockpile,
}: {
  readonly canManage: boolean;
  readonly nation: Nation;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly stockpile: readonly NationStockpileEntry[];
}): JSX.Element {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );
  const [isGranting, setIsGranting] = useState(false);
  const [isSubsidizing, setIsSubsidizing] = useState(false);

  const selected =
    stockpile.find((entry) => entry.resourceId === selectedResourceId) ?? null;

  const list = (
    <div className="overflow-x-auto rounded-md border">
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Resource</TableHead>
            <TableHead scope="col" className="text-right tabular-nums">
              Quantity
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockpile.map((entry) => (
            <TableRow
              key={entry.resourceId}
              aria-selected={entry.resourceId === selectedResourceId}
              className="cursor-pointer"
              data-state={
                entry.resourceId === selectedResourceId ? "selected" : undefined
              }
              tabIndex={0}
              onClick={() => setSelectedResourceId(entry.resourceId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedResourceId(entry.resourceId);
                }
              }}
            >
              <TableCell>{entry.resourceName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {entry.quantity.toLocaleString()}
              </TableCell>
            </TableRow>
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
          selected === null ? null : (
            <StockpileDetailPanel
              canManage={canManage}
              entry={selected}
              onGrant={() => setIsGranting(true)}
              onSubsidize={() => setIsSubsidizing(true)}
            />
          )
        }
        detailTitle={selected?.resourceName ?? ""}
        onCloseDetail={() => setSelectedResourceId(null)}
        emptyState={
          <EmptyState
            icon={Coins}
            title="Select a resource to view treasury actions"
          />
        }
      />

      {isGranting && selected !== null ? (
        <GrantResourcesDialog
          initialResourceId={selected.resourceId}
          nation={nation}
          onClose={() => setIsGranting(false)}
          queryClient={queryClient}
          stockpile={stockpile}
        />
      ) : null}

      {isSubsidizing ? (
        <SubsidizeConstructionDialog
          nation={nation}
          onClose={() => setIsSubsidizing(false)}
          queryClient={queryClient}
          stockpile={stockpile}
        />
      ) : null}
    </>
  );
}

function StockpileDetailPanel({
  canManage,
  entry,
  onGrant,
  onSubsidize,
}: {
  readonly canManage: boolean;
  readonly entry: NationStockpileEntry;
  readonly onGrant: () => void;
  readonly onSubsidize: () => void;
}): JSX.Element {
  return (
    <div className="grid gap-3 text-sm">
      <div className="grid grid-cols-2 gap-y-2">
        <span className="text-muted-foreground">On hand</span>
        <span className="text-right tabular-nums">
          {entry.quantity.toLocaleString()}
        </span>
      </div>
      {canManage ? (
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={onGrant}
          >
            Grant to settlement
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={onSubsidize}
          >
            Subsidize construction
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          You do not have permission to move treasury resources.
        </p>
      )}
    </div>
  );
}

function ActiveSubsidiesSection({
  error,
  isError,
  isPending,
  subsidies,
}: {
  readonly error: AuthUiError | null;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly subsidies: readonly NationActiveSubsidy[];
}): JSX.Element {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Active subsidies</h3>
      {isPending ? (
        <LoadingState label="Loading active subsidies…" />
      ) : isError ? (
        <ErrorState
          title="Active subsidies could not be loaded"
          description={getErrorDescription(error)}
        />
      ) : subsidies.length === 0 ? (
        <EmptyState
          title="No active subsidies"
          description="No queued, in-progress, or paused construction project has received a treasury subsidy yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Settlement</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Resources committed</TableHead>
              <TableHead className="text-right">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subsidies.map((subsidy) => {
              const totalRequired = subsidy.costs.reduce(
                (sum, cost) => sum + cost.amount,
                0,
              );
              const totalCommitted = subsidy.costs.reduce(
                (sum, cost) =>
                  sum + Math.min(cost.committedQuantity, cost.amount),
                0,
              );
              const progressPercent =
                totalRequired > 0
                  ? Math.round((totalCommitted / totalRequired) * 100)
                  : 0;

              return (
                <TableRow key={subsidy.projectId}>
                  <TableCell>{subsidy.settlementName}</TableCell>
                  <TableCell>
                    {subsidy.blueprintName} (tier {subsidy.tierNumber})
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {subsidy.costs
                      .map(
                        (cost) =>
                          `${cost.committedQuantity.toLocaleString()} / ${cost.amount.toLocaleString()} ${cost.resourceName}`,
                      )
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    {progressPercent}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function TaxRateControl({
  canManage,
  isArchived,
  nation,
  queryClient,
  snapshot,
  snapshotIsPending,
}: {
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly snapshot: { readonly totalTaxCollected: number } | null;
  readonly snapshotIsPending: boolean;
}): JSX.Element {
  const [draftPercent, setDraftPercent] = useState<number | null>(null);
  const taxRateMutation = useMutation(
    setNationTaxRateMutationOptions({ queryClient }),
  );

  const currentPercent = Math.round(nation.taxRate * 100);
  const sliderValue = draftPercent ?? currentPercent;

  function handleCommit(values: readonly number[]): void {
    const percent = values[0] ?? currentPercent;
    setDraftPercent(null);
    const rate = percent / 100;
    if (rate === nation.taxRate) return;
    taxRateMutation.mutate(
      { nationId: nation.id, rate, worldId: nation.worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update tax rate.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Tax rate updated.");
        },
      },
    );
  }

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="nation-tax-rate-slider">Production tax rate</Label>
        <span className="text-sm font-medium">{sliderValue}%</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Each turn the treasury collects this share (0–{TAX_RATE_MAX_PERCENT}%)
        of every settlement's gross resource production, taken in kind — the
        taxed resources themselves, not coin. This is not a currency tax;
        national coin is managed on the Bank page.
      </p>
      {/*
        Renders SliderPrimitive directly (instead of @/components/ui/slider)
        because that vendored wrapper doesn't forward an accessible name to
        SliderPrimitive.Thumb -- only the non-interactive Root receives
        id/aria-label, leaving the role="slider" node unnamed (#1152).
      */}
      <SliderPrimitive.Root
        id="nation-tax-rate-slider"
        min={0}
        max={TAX_RATE_MAX_PERCENT}
        step={1}
        value={[sliderValue]}
        disabled={!canManage || isArchived || taxRateMutation.isPending}
        onValueChange={(values) => setDraftPercent(values[0] ?? currentPercent)}
        onValueCommit={handleCommit}
        className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border">
          <SliderPrimitive.Range className="absolute h-full bg-primary select-none" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label="Tax rate"
          className="relative block size-4 shrink-0 rounded-full border-2 border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Root>
      <p className="text-xs text-muted-foreground">
        Estimated next-turn intake:{" "}
        {snapshotIsPending
          ? "…"
          : snapshot === null
            ? "No tax snapshot since the current rate was set"
            : snapshot.totalTaxCollected.toLocaleString()}
      </p>
    </div>
  );
}

function GrantResourcesDialog({
  initialResourceId,
  nation,
  onClose,
  queryClient,
  stockpile,
}: {
  readonly initialResourceId?: string;
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly stockpile: readonly NationStockpileEntry[];
}): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nation.id));
  const grantMutation = useMutation(
    grantNationResourcesMutationOptions({ queryClient }),
  );

  const grantable = stockpile.filter((entry) => entry.quantity > 0);

  const [settlementId, setSettlementId] = useState<string>("");
  const [resourceId, setResourceId] = useState<string>(() =>
    initialResourceId !== undefined &&
    grantable.some((entry) => entry.resourceId === initialResourceId)
      ? initialResourceId
      : "",
  );
  const [quantity, setQuantity] = useState<string>("");
  const selectedResource = grantable.find(
    (entry) => entry.resourceId === resourceId,
  );
  const maxQuantity = selectedResource?.quantity ?? 0;
  const parsedQuantity = Number(quantity);
  const isQuantityValid =
    quantity.trim() !== "" &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    parsedQuantity <= maxQuantity;

  function handleSubmit(): void {
    if (settlementId === "" || resourceId === "" || !isQuantityValid) return;
    grantMutation.mutate(
      {
        nationId: nation.id,
        quantity: parsedQuantity,
        resourceId,
        settlementId,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to grant resources.");
        },
        onSuccess: (result) => {
          notifyMutationSuccess(
            result.clamped
              ? `Granted ${result.grantedQuantity.toLocaleString()} (clamped by available stock or storage space).`
              : `Granted ${result.grantedQuantity.toLocaleString()}.`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant resources</DialogTitle>
          <DialogDescription>
            Move resources from the nation treasury into a settlement's
            stockpile. The grant is clamped to the nation's available stock and
            the settlement's remaining storage space.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="grant-settlement-select">Settlement</Label>
            {settlementsQuery.isPending ? (
              <LoadingState label="Loading settlements…" />
            ) : settlementsQuery.isError ? (
              <ErrorState
                title="Settlements could not be loaded"
                description={getErrorDescription(settlementsQuery.error)}
              />
            ) : (
              <Select value={settlementId} onValueChange={setSettlementId}>
                <SelectTrigger
                  id="grant-settlement-select"
                  aria-label="Settlement"
                >
                  <SelectValue placeholder="Select a settlement" />
                </SelectTrigger>
                <SelectContent>
                  {settlementsQuery.data.map((settlement: NationSettlement) => (
                    <SelectItem key={settlement.id} value={settlement.id}>
                      {settlement.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="grant-resource-select">Resource</Label>
            {grantable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The nation does not hold any resources to grant.
              </p>
            ) : (
              <Select
                value={resourceId}
                onValueChange={(value) => {
                  setResourceId(value);
                  setQuantity("");
                }}
              >
                <SelectTrigger id="grant-resource-select" aria-label="Resource">
                  <SelectValue placeholder="Select a resource" />
                </SelectTrigger>
                <SelectContent>
                  {grantable.map((entry) => (
                    <SelectItem key={entry.resourceId} value={entry.resourceId}>
                      {entry.resourceName} ({entry.quantity.toLocaleString()}{" "}
                      held)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {grantable.length === 0 ? null : (
            <div className="grid gap-1">
              <Label htmlFor="grant-quantity-input">
                Quantity{" "}
                {resourceId !== ""
                  ? `(max ${maxQuantity.toLocaleString()})`
                  : ""}
              </Label>
              <Input
                id="grant-quantity-input"
                type="number"
                min={0}
                max={maxQuantity}
                value={quantity}
                disabled={resourceId === ""}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              grantMutation.isPending ||
              settlementId === "" ||
              resourceId === "" ||
              !isQuantityValid
            }
          >
            {grantMutation.isPending ? "Granting…" : "Grant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubsidizeConstructionDialog({
  nation,
  onClose,
  queryClient,
  stockpile,
}: {
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly stockpile: readonly NationStockpileEntry[];
}): JSX.Element {
  const projectsQuery = useQuery(
    nationActiveConstructionProjectsQueryOptions(nation.id),
  );
  const subsidizeMutation = useMutation(
    subsidizeConstructionProjectMutationOptions({ queryClient }),
  );

  const [projectId, setProjectId] = useState<string>("");

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === projectId);
  const stockpileByResource = new Map(
    stockpile.map((entry) => [entry.resourceId, entry.quantity]),
  );
  const hasInsufficientStock =
    selectedProject !== undefined &&
    selectedProject.costs.some(
      (cost) => (stockpileByResource.get(cost.resourceId) ?? 0) < cost.amount,
    );
  const hasZeroTransfer =
    selectedProject !== undefined &&
    selectedProject.costs.every(
      (cost) => (stockpileByResource.get(cost.resourceId) ?? 0) <= 0,
    );

  function handleSubmit(): void {
    if (selectedProject === undefined) return;
    subsidizeMutation.mutate(
      {
        nationId: nation.id,
        projectId: selectedProject.id,
        settlementId: selectedProject.settlementId,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to subsidize project.");
        },
        onSuccess: (results) => {
          const anyClamped = results.some((line) => line.clamped);
          notifyMutationSuccess(
            anyClamped
              ? "Project subsidized (some inputs clamped by available stock or storage space)."
              : "Project subsidized.",
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subsidize construction</DialogTitle>
          <DialogDescription>
            Transfer a project's required input resources from the nation
            treasury into its settlement's stockpile. The transfer is clamped to
            the nation's available stock and the settlement's remaining storage
            space, so an insufficient stockpile only partially funds the
            project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {projectsQuery.isPending ? (
            <LoadingState label="Loading construction projects…" />
          ) : projectsQuery.isError ? (
            <ErrorState
              title="Construction projects could not be loaded"
              description={getErrorDescription(projectsQuery.error)}
            />
          ) : projects.length === 0 ? (
            <EmptyState
              title="No active construction projects"
              description="This nation's settlements have no queued, in-progress, or paused construction projects."
            />
          ) : (
            <div className="grid gap-1">
              <Label htmlFor="subsidize-project-select">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger
                  id="subsidize-project-select"
                  aria-label="Construction project"
                >
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: NationActiveConstructionProject) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.settlementName} — {project.blueprintName} (tier{" "}
                      {project.tierNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProject !== undefined ? (
                <SubsidizeProjectDetails
                  hasInsufficientStock={hasInsufficientStock}
                  hasZeroTransfer={hasZeroTransfer}
                  selectedProject={selectedProject}
                  stockpileByResource={stockpileByResource}
                />
              ) : null}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              subsidizeMutation.isPending ||
              selectedProject === undefined ||
              hasZeroTransfer
            }
          >
            {subsidizeMutation.isPending ? "Subsidizing…" : "Subsidize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubsidizeProjectDetails({
  hasInsufficientStock,
  hasZeroTransfer,
  selectedProject,
  stockpileByResource,
}: {
  readonly hasInsufficientStock: boolean;
  readonly hasZeroTransfer: boolean;
  readonly selectedProject: NationActiveConstructionProject;
  readonly stockpileByResource: ReadonlyMap<string, number>;
}): JSX.Element {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Resource</TableHead>
            <TableHead className="text-right">Required</TableHead>
            <TableHead className="text-right">Nation stockpile</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {selectedProject.costs.map((cost) => {
            const held = stockpileByResource.get(cost.resourceId) ?? 0;
            const insufficient = held < cost.amount;
            return (
              <TableRow key={cost.resourceId}>
                <TableCell>{cost.resourceName}</TableCell>
                <TableCell className="text-right">
                  {cost.amount.toLocaleString()}
                </TableCell>
                <TableCell
                  className={
                    insufficient ? "text-right text-destructive" : "text-right"
                  }
                >
                  {held.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {hasZeroTransfer ? (
        <p className="text-xs text-destructive">
          Nation stockpile holds none of the required resources, so this subsidy
          would transfer nothing.
        </p>
      ) : hasInsufficientStock ? (
        <p className="text-xs text-destructive">
          Nation stockpile is insufficient for one or more required resources.
          The subsidy will transfer as much as is available and clamp the rest.
        </p>
      ) : null}
    </>
  );
}
