import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  blueprintByIdQueryOptions,
  createTierInputSchema,
  createTierMutationOptions,
  deleteTierMutationOptions,
  tiersByBlueprintQueryOptions,
  updateTierInputSchema,
  updateTierMutationOptions,
  validateBlueprintTierReferencesAgainstWorld,
  type BuildingBlueprint,
  type BuildingBlueprintTier,
  type CreateTierInput,
  type TierCostEntry,
  type TierCostEntryInput,
  type TierEffect,
  type TierEffectInput,
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
import { cn } from "@/lib/utils";

type EffectTypeName =
  | "job_capacity_increase"
  | "passive_resource_production"
  | "population_cap_increase"
  | "resource_storage_increase";

const EFFECT_TYPE_LABELS: Record<EffectTypeName, string> = {
  job_capacity_increase: "Job capacity increase",
  passive_resource_production: "Passive resource production",
  population_cap_increase: "Population cap increase",
  resource_storage_increase: "Resource storage increase",
};

const SELECT_CLASS = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base",
  "transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
  "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
);

type CostRowState = {
  id: string;
  resourceId: string;
  amount: string;
};

type EffectRowState = {
  id: string;
  effectType: string;
  jobId: string;
  resourceId: string;
  amount: string;
};

type TierFormErrors = {
  blueprintId?: string;
  constructionCostsJson?: string;
  effectsJson?: string;
  tierNumber?: string;
  upkeepCostsJson?: string;
  workerTurnsRequired?: string;
};

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
                    deleteMutation.mutate(
                      { tierId: tier.id },
                      {
                        onError: (error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Failed to delete tier.",
                          );
                        },
                        onSuccess: () => {
                          notifyMutationSuccess("Tier deleted.");
                        },
                      },
                    );
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

      {canEdit && showCreateForm ? (
        <CreateTierForm
          activeJobs={activeJobs}
          activeResources={activeResources}
          blueprintId={blueprint.id}
          isPending={createMutation.isPending}
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

function CreateTierForm({
  activeJobs,
  activeResources,
  blueprintId,
  isPending,
  onCancel,
  onSubmit,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly blueprintId: string;
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateTierInput) => void;
}): JSX.Element {
  const [tierNumber, setTierNumber] = useState("1");
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

function CostEditor({
  activeResources,
  disabled,
  error,
  label,
  rows,
  onChange,
}: {
  readonly activeResources: readonly Resource[];
  readonly disabled: boolean;
  readonly error?: string;
  readonly label: string;
  readonly rows: readonly CostRowState[];
  readonly onChange: (rows: CostRowState[]) => void;
}): JSX.Element {
  function addRow(): void {
    onChange([
      ...rows,
      { amount: "", id: crypto.randomUUID(), resourceId: "" },
    ]);
  }

  function removeRow(id: string): void {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<CostRowState>): void {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`cost-resource-${row.id}`}>
            Resource
          </label>
          <select
            aria-label="Resource"
            className={SELECT_CLASS}
            disabled={disabled}
            id={`cost-resource-${row.id}`}
            value={row.resourceId}
            onChange={(e) => {
              updateRow(row.id, { resourceId: e.currentTarget.value });
            }}
          >
            <option value="">Select resource</option>
            {activeResources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="Amount"
            className="w-24 shrink-0"
            disabled={disabled}
            inputMode="numeric"
            placeholder="0"
            value={row.amount}
            onChange={(e) => {
              updateRow(row.id, { amount: e.currentTarget.value });
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              removeRow(row.id);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      {error !== undefined ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={addRow}
      >
        <Plus aria-hidden="true" />
        Add cost
      </Button>
    </div>
  );
}

function EffectsEditor({
  activeJobs,
  activeResources,
  disabled,
  error,
  rows,
  onChange,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly disabled: boolean;
  readonly error?: string;
  readonly rows: readonly EffectRowState[];
  readonly onChange: (rows: EffectRowState[]) => void;
}): JSX.Element {
  function addRow(): void {
    onChange([
      ...rows,
      {
        amount: "",
        effectType: "",
        id: crypto.randomUUID(),
        jobId: "",
        resourceId: "",
      },
    ]);
  }

  function removeRow(id: string): void {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<EffectRowState>): void {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm text-muted-foreground">Effects</span>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-2 rounded-md border border-border p-3"
        >
          <div className="flex items-start gap-2">
            <div className="grid flex-1 gap-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Effect type</span>
                <select
                  aria-label="Effect type"
                  className={SELECT_CLASS}
                  disabled={disabled}
                  value={row.effectType}
                  onChange={(e) => {
                    updateRow(row.id, {
                      effectType: e.currentTarget.value,
                      jobId: "",
                      resourceId: "",
                    });
                  }}
                >
                  <option value="">Select type</option>
                  {(
                    Object.entries(EFFECT_TYPE_LABELS) as [
                      EffectTypeName,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {row.effectType === "job_capacity_increase" ? (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Job</span>
                    <select
                      aria-label="Job"
                      className={SELECT_CLASS}
                      disabled={disabled}
                      value={row.jobId}
                      onChange={(e) => {
                        updateRow(row.id, { jobId: e.currentTarget.value });
                      }}
                    >
                      <option value="">Select job</option>
                      {activeJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <Input
                      aria-label="Effect amount"
                      disabled={disabled}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => {
                        updateRow(row.id, { amount: e.currentTarget.value });
                      }}
                    />
                  </label>
                </>
              ) : null}

              {row.effectType === "passive_resource_production" ||
              row.effectType === "resource_storage_increase" ? (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Resource</span>
                    <select
                      aria-label="Effect resource"
                      className={SELECT_CLASS}
                      disabled={disabled}
                      value={row.resourceId}
                      onChange={(e) => {
                        updateRow(row.id, {
                          resourceId: e.currentTarget.value,
                        });
                      }}
                    >
                      <option value="">Select resource</option>
                      {activeResources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <Input
                      aria-label="Effect amount"
                      disabled={disabled}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => {
                        updateRow(row.id, { amount: e.currentTarget.value });
                      }}
                    />
                  </label>
                </>
              ) : null}

              {row.effectType === "population_cap_increase" ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <Input
                    aria-label="Effect amount"
                    disabled={disabled}
                    inputMode="numeric"
                    placeholder="0"
                    value={row.amount}
                    onChange={(e) => {
                      updateRow(row.id, { amount: e.currentTarget.value });
                    }}
                  />
                </label>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-6 shrink-0"
              disabled={disabled}
              onClick={() => {
                removeRow(row.id);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
      {error !== undefined ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={addRow}
      >
        <Plus aria-hidden="true" />
        Add effect
      </Button>
    </div>
  );
}

function buildCostInputs(rows: readonly CostRowState[]): TierCostEntryInput[] {
  return rows.map((r) => ({
    amount: r.amount !== "" ? parseFloat(r.amount) : 0,
    resourceId: r.resourceId,
  }));
}

function buildEffectInputs(rows: readonly EffectRowState[]): TierEffectInput[] {
  const result: TierEffectInput[] = [];
  for (const r of rows) {
    const amount = r.amount !== "" ? parseFloat(r.amount) : 0;
    if (r.effectType === "job_capacity_increase") {
      result.push({ amount, jobId: r.jobId, type: "job_capacity_increase" });
    } else if (r.effectType === "passive_resource_production") {
      result.push({
        amount,
        resourceId: r.resourceId,
        type: "passive_resource_production",
      });
    } else if (r.effectType === "resource_storage_increase") {
      result.push({
        amount,
        resourceId: r.resourceId,
        type: "resource_storage_increase",
      });
    } else if (r.effectType === "population_cap_increase") {
      result.push({ amount, type: "population_cap_increase" });
    }
  }
  return result;
}

function tierCostsToState(costs: readonly TierCostEntry[]): CostRowState[] {
  return costs.map((c) => ({
    amount: String(c.amount),
    id: crypto.randomUUID(),
    resourceId: c.resourceId,
  }));
}

function tierEffectsToState(effects: readonly TierEffect[]): EffectRowState[] {
  return effects.map((e) => {
    const base = { amount: String(e.amount), id: crypto.randomUUID() };
    switch (e.type) {
      case "job_capacity_increase":
        return {
          ...base,
          effectType: "job_capacity_increase",
          jobId: e.jobId,
          resourceId: "",
        };
      case "passive_resource_production":
        return {
          ...base,
          effectType: "passive_resource_production",
          jobId: "",
          resourceId: e.resourceId,
        };
      case "resource_storage_increase":
        return {
          ...base,
          effectType: "resource_storage_increase",
          jobId: "",
          resourceId: e.resourceId,
        };
      case "population_cap_increase":
        return {
          ...base,
          effectType: "population_cap_increase",
          jobId: "",
          resourceId: "",
        };
    }
  });
}

function extractFieldErrors(
  issues: Array<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): TierFormErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const first = issue.path[0];
    const field =
      typeof first === "string" || typeof first === "number"
        ? String(first)
        : "";
    if (field !== "" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function extractRefErrors(
  issues: readonly { field: string; message: string }[],
): TierFormErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.field in errors)) {
      errors[issue.field] = issue.message;
    }
  }
  return errors;
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
