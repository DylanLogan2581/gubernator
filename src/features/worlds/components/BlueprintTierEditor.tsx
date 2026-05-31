import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  blueprintByIdQueryOptions,
  buildCostInputs,
  buildEffectInputs,
  CostEditor,
  createTierInputSchema,
  createTierMutationOptions,
  deleteTierMutationOptions,
  EffectsEditor,
  extractFieldErrors,
  extractRefErrors,
  tierCostsToState,
  tierEffectsToState,
  tiersByBlueprintQueryOptions,
  updateTierInputSchema,
  updateTierMutationOptions,
  validateBlueprintTierReferencesAgainstWorld,
  type BuildingBlueprint,
  type BuildingBlueprintTier,
  type CostRowState,
  type CreateTierInput,
  type EffectRowState,
  type TierCostEntry,
  type TierEffect,
  type TierFormErrors,
  type UpdateTierInput,
} from "@/features/buildings";
import {
  activeJobsByWorldQueryOptions,
  type JobDefinition,
} from "@/features/jobs";
import {
  activeResourcesByWorldQueryOptions,
  type Resource,
} from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

type BlueprintTierEditorProps = {
  readonly blueprintId: string;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function BlueprintTierEditor({
  blueprintId,
  canAdmin,
  isArchived,
  worldId,
}: BlueprintTierEditorProps): JSX.Element {
  const queryClient = useQueryClient();
  const blueprintQuery = useQuery(blueprintByIdQueryOptions(blueprintId));
  const tiersQuery = useQuery(tiersByBlueprintQueryOptions(blueprintId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));

  const isLoading =
    blueprintQuery.isPending ||
    tiersQuery.isPending ||
    resourcesQuery.isPending ||
    jobsQuery.isPending;

  const isError =
    blueprintQuery.isError ||
    tiersQuery.isError ||
    resourcesQuery.isError ||
    jobsQuery.isError;

  if (isLoading) {
    return (
      <section
        aria-labelledby="blueprint-tiers-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading tiers…" />
      </section>
    );
  }

  if (isError) {
    const firstError =
      blueprintQuery.error ??
      tiersQuery.error ??
      resourcesQuery.error ??
      jobsQuery.error;
    return (
      <section
        aria-labelledby="blueprint-tiers-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Tiers could not be loaded"
          description={getErrorDescription(firstError)}
        />
      </section>
    );
  }

  const blueprint = blueprintQuery.data;

  if (blueprint === null) {
    return (
      <section
        aria-labelledby="blueprint-tiers-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Blueprint not found"
          description="The blueprint could not be found."
        />
      </section>
    );
  }

  return (
    <BlueprintTierEditorContent
      activeJobs={jobsQuery.data}
      activeResources={resourcesQuery.data}
      blueprint={blueprint}
      canAdmin={canAdmin}
      isArchived={isArchived}
      queryClient={queryClient}
      tiers={tiersQuery.data}
      worldId={worldId}
    />
  );
}

function BlueprintTierEditorContent({
  activeJobs,
  activeResources,
  blueprint,
  canAdmin,
  isArchived,
  queryClient,
  tiers,
  worldId,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly blueprint: BuildingBlueprint;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly tiers: readonly BuildingBlueprintTier[];
  readonly worldId: string;
}): JSX.Element {
  const canEdit = canAdmin && !isArchived;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [deletingTier, setDeletingTier] =
    useState<BuildingBlueprintTier | null>(null);

  const createMutation = useMutation(
    createTierMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteTierMutationOptions({ queryClient }),
  );

  const sortedTiers = [...tiers].sort((a, b) => a.tierNumber - b.tierNumber);

  return (
    <section
      aria-labelledby="blueprint-tiers-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <Link
            to="/worlds/$worldId/configuration"
            params={{ worldId }}
            search={{ tab: "buildings" }}
            className="text-xs text-primary hover:underline"
          >
            ← Blueprints
          </Link>
          <h2
            id="blueprint-tiers-title"
            className="text-lg font-semibold tracking-normal"
          >
            {blueprint.name}
          </h2>
          <span className="text-xs text-muted-foreground">
            {blueprint.slug}
          </span>
        </div>
        {canEdit && !showCreateForm && editingTierId === null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowCreateForm(true);
            }}
          >
            <Plus aria-hidden="true" />
            Add tier
          </Button>
        ) : null}
      </div>

      {sortedTiers.length > 0 ? (
        <ul aria-label="Tiers" className="grid gap-2">
          {sortedTiers.map((tier) =>
            editingTierId === tier.id ? (
              <li key={tier.id}>
                <EditTierForm
                  activeJobs={activeJobs}
                  activeResources={activeResources}
                  queryClient={queryClient}
                  tier={tier}
                  onClose={() => {
                    setEditingTierId(null);
                  }}
                />
              </li>
            ) : (
              <li key={tier.id}>
                <TierRow
                  activeJobs={activeJobs}
                  activeResources={activeResources}
                  canEdit={canEdit}
                  isDeleting={deleteMutation.isPending}
                  tier={tier}
                  onDelete={() => {
                    setDeletingTier(tier);
                  }}
                  onEdit={() => {
                    setShowCreateForm(false);
                    setEditingTierId(tier.id);
                  }}
                />
              </li>
            ),
          )}
        </ul>
      ) : !showCreateForm ? (
        <EmptyState
          title="No tiers yet"
          description="Add the first tier for this blueprint."
        />
      ) : null}

      {deletingTier !== null ? (
        <TierDeleteConfirmDialog
          isPending={deleteMutation.isPending}
          tier={deletingTier}
          onCancel={() => {
            setDeletingTier(null);
            deleteMutation.reset();
          }}
          onConfirm={() => {
            deleteMutation.mutate(
              { tierId: deletingTier.id },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to delete tier.",
                  );
                },
                onSuccess: () => {
                  setDeletingTier(null);
                  notifyMutationSuccess("Tier deleted.");
                },
              },
            );
          }}
        />
      ) : null}

      {canEdit && showCreateForm ? (
        <CreateTierForm
          activeJobs={activeJobs}
          activeResources={activeResources}
          blueprintId={blueprint.id}
          isPending={createMutation.isPending}
          tiers={tiers}
          onCancel={() => {
            setShowCreateForm(false);
          }}
          onSubmit={(input) => {
            createMutation.mutate(input, {
              onError: (error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to create tier.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Tier created.");
                setShowCreateForm(false);
              },
            });
          }}
        />
      ) : null}
    </section>
  );
}

function TierRow({
  activeJobs,
  activeResources,
  canEdit,
  isDeleting,
  tier,
  onDelete,
  onEdit,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly canEdit: boolean;
  readonly isDeleting: boolean;
  readonly tier: BuildingBlueprintTier;
  readonly onDelete: () => void;
  readonly onEdit: () => void;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <span className="text-sm font-medium">Tier {tier.tierNumber}</span>
          <span className="text-xs text-muted-foreground">
            {tier.workerTurnsRequired} worker turn
            {tier.workerTurnsRequired !== 1 ? "s" : ""} required
          </span>
          {tier.constructionCostsJson.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              Construction:{" "}
              {formatCosts(tier.constructionCostsJson, activeResources)}
            </div>
          ) : null}
          {tier.upkeepCostsJson.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              Upkeep: {formatCosts(tier.upkeepCostsJson, activeResources)}
            </div>
          ) : null}
          {tier.effectsJson.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              Effects:{" "}
              {formatEffects(tier.effectsJson, activeResources, activeJobs)}
            </div>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={onDelete}
            >
              <X aria-hidden="true" className="text-destructive" />
              <span className="sr-only">Delete tier {tier.tierNumber}</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TierDeleteConfirmDialog({
  isPending,
  tier,
  onCancel,
  onConfirm,
}: {
  readonly isPending: boolean;
  readonly tier: BuildingBlueprintTier;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="tier-delete-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="tier-delete-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Delete tier
          </h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">Tier {tier.tierNumber}</span>? This
            action cannot be undone.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            <Trash2 aria-hidden="true" />
            {isPending ? "Deleting…" : "Delete tier"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateTierForm({
  activeJobs,
  activeResources,
  blueprintId,
  isPending,
  tiers,
  onCancel,
  onSubmit,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly blueprintId: string;
  readonly isPending: boolean;
  readonly tiers: readonly BuildingBlueprintTier[];
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateTierInput) => void;
}): JSX.Element {
  const nextTierNumber =
    tiers.length > 0 ? Math.max(...tiers.map((t) => t.tierNumber)) + 1 : 1;
  const [tierNumber, setTierNumber] = useState(String(nextTierNumber));
  const [workerTurns, setWorkerTurns] = useState("0");
  const [constructionCosts, setConstructionCosts] = useState<CostRowState[]>(
    [],
  );
  const [upkeepCosts, setUpkeepCosts] = useState<CostRowState[]>([]);
  const [effects, setEffects] = useState<EffectRowState[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TierFormErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    const constructionCostInputs = buildCostInputs(constructionCosts);
    const upkeepCostInputs = buildCostInputs(upkeepCosts);
    const effectInputs = buildEffectInputs(effects);

    const input: CreateTierInput = {
      blueprintId,
      constructionCostsJson:
        constructionCostInputs.length > 0 ? constructionCostInputs : undefined,
      effectsJson: effectInputs.length > 0 ? effectInputs : undefined,
      tierNumber: tierNumber !== "" ? parseInt(tierNumber, 10) : 0,
      upkeepCostsJson:
        upkeepCostInputs.length > 0 ? upkeepCostInputs : undefined,
      workerTurnsRequired:
        workerTurns !== "" ? parseInt(workerTurns, 10) : undefined,
    };

    const parseResult = createTierInputSchema.safeParse(input);
    if (!parseResult.success) {
      setFieldErrors(extractFieldErrors(parseResult.error.issues));
      return;
    }

    const refIssues = validateBlueprintTierReferencesAgainstWorld(
      {
        constructionCostsJson: constructionCostInputs,
        effectsJson: effectInputs,
        upkeepCostsJson: upkeepCostInputs,
      },
      activeResources,
      activeJobs,
    );
    if (refIssues.length > 0) {
      setFieldErrors(extractRefErrors(refIssues));
      return;
    }

    onSubmit(input);
  }

  return (
    <form
      aria-label="Create tier"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 className="text-sm font-medium">New tier</h3>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Tier number</span>
          <Input
            aria-invalid={fieldErrors.tierNumber !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="1"
            value={tierNumber}
            onChange={(e) => {
              setTierNumber(e.currentTarget.value);
            }}
          />
          {fieldErrors.tierNumber !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.tierNumber}</p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Worker turns required</span>
          <Input
            aria-invalid={fieldErrors.workerTurnsRequired !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="0"
            value={workerTurns}
            onChange={(e) => {
              setWorkerTurns(e.currentTarget.value);
            }}
          />
          {fieldErrors.workerTurnsRequired !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.workerTurnsRequired}
            </p>
          ) : null}
        </label>
        <CostEditor
          activeResources={activeResources}
          disabled={isPending}
          error={fieldErrors.constructionCostsJson}
          label="Construction costs"
          rows={constructionCosts}
          onChange={setConstructionCosts}
        />
        <CostEditor
          activeResources={activeResources}
          disabled={isPending}
          error={fieldErrors.upkeepCostsJson}
          label="Upkeep costs"
          rows={upkeepCosts}
          onChange={setUpkeepCosts}
        />
        <EffectsEditor
          activeJobs={activeJobs}
          activeResources={activeResources}
          disabled={isPending}
          error={fieldErrors.effectsJson}
          rows={effects}
          onChange={setEffects}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Create
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditTierForm({
  activeJobs,
  activeResources,
  queryClient,
  tier,
  onClose,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly queryClient: QueryClient;
  readonly tier: BuildingBlueprintTier;
  readonly onClose: () => void;
}): JSX.Element {
  const updateMutation = useMutation(
    updateTierMutationOptions({ queryClient }),
  );

  const [workerTurns, setWorkerTurns] = useState(
    String(tier.workerTurnsRequired),
  );
  const [constructionCosts, setConstructionCosts] = useState<CostRowState[]>(
    () => tierCostsToState(tier.constructionCostsJson),
  );
  const [upkeepCosts, setUpkeepCosts] = useState<CostRowState[]>(() =>
    tierCostsToState(tier.upkeepCostsJson),
  );
  const [effects, setEffects] = useState<EffectRowState[]>(() =>
    tierEffectsToState(tier.effectsJson),
  );
  const [fieldErrors, setFieldErrors] = useState<TierFormErrors>({});

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldErrors({});

    const constructionCostInputs = buildCostInputs(constructionCosts);
    const upkeepCostInputs = buildCostInputs(upkeepCosts);
    const effectInputs = buildEffectInputs(effects);

    const input: UpdateTierInput = {
      constructionCostsJson: constructionCostInputs,
      effectsJson: effectInputs,
      tierId: tier.id,
      upkeepCostsJson: upkeepCostInputs,
      workerTurnsRequired:
        workerTurns !== "" ? parseInt(workerTurns, 10) : undefined,
    };

    const parseResult = updateTierInputSchema.safeParse(input);
    if (!parseResult.success) {
      setFieldErrors(extractFieldErrors(parseResult.error.issues));
      return;
    }

    const refIssues = validateBlueprintTierReferencesAgainstWorld(
      {
        constructionCostsJson: constructionCostInputs,
        effectsJson: effectInputs,
        upkeepCostsJson: upkeepCostInputs,
      },
      activeResources,
      activeJobs,
    );
    if (refIssues.length > 0) {
      setFieldErrors(extractRefErrors(refIssues));
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Tier saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save tier.",
      );
    }
  }

  return (
    <form
      aria-label="Edit tier"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit tier {tier.tierNumber}</h3>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Worker turns required</span>
          <Input
            aria-invalid={fieldErrors.workerTurnsRequired !== undefined}
            disabled={updateMutation.isPending}
            inputMode="numeric"
            placeholder="0"
            value={workerTurns}
            onChange={(e) => {
              setWorkerTurns(e.currentTarget.value);
            }}
          />
          {fieldErrors.workerTurnsRequired !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.workerTurnsRequired}
            </p>
          ) : null}
        </label>
        <CostEditor
          activeResources={activeResources}
          disabled={updateMutation.isPending}
          error={fieldErrors.constructionCostsJson}
          label="Construction costs"
          rows={constructionCosts}
          onChange={setConstructionCosts}
        />
        <CostEditor
          activeResources={activeResources}
          disabled={updateMutation.isPending}
          error={fieldErrors.upkeepCostsJson}
          label="Upkeep costs"
          rows={upkeepCosts}
          onChange={setUpkeepCosts}
        />
        <EffectsEditor
          activeJobs={activeJobs}
          activeResources={activeResources}
          disabled={updateMutation.isPending}
          error={fieldErrors.effectsJson}
          rows={effects}
          onChange={setEffects}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={updateMutation.isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function resolveResourceName(
  resourceId: string,
  resources: readonly Resource[],
): string {
  return resources.find((r) => r.id === resourceId)?.name ?? "[unknown]";
}

function resolveJobName(jobId: string, jobs: readonly JobDefinition[]): string {
  return jobs.find((j) => j.id === jobId)?.name ?? "[unknown]";
}

function formatCosts(
  costs: readonly TierCostEntry[],
  resources: readonly Resource[],
): string {
  return costs
    .map((c) => `${c.amount} ${resolveResourceName(c.resourceId, resources)}`)
    .join(", ");
}

function formatEffects(
  effects: readonly TierEffect[],
  resources: readonly Resource[],
  jobs: readonly JobDefinition[],
): string {
  return effects
    .map((e) => {
      switch (e.type) {
        case "job_capacity_increase":
          return `+${e.amount} ${resolveJobName(e.jobId, jobs)} capacity`;
        case "passive_resource_production":
          return `+${e.amount} ${resolveResourceName(e.resourceId, resources)}/turn`;
        case "resource_storage_increase":
          return `+${e.amount} ${resolveResourceName(e.resourceId, resources)} storage`;
        case "population_cap_increase":
          return `+${e.amount} pop cap`;
      }
    })
    .join(", ");
}
