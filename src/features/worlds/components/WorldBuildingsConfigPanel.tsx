import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type JSX, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  blueprintsByWorldQueryOptions,
  buildCostInputs,
  buildEffectInputs,
  CostEditor,
  createBlueprintInputSchema,
  createBlueprintMutationOptions,
  createTierInputSchema,
  createTierMutationOptions,
  EffectsEditor,
  extractFieldErrors,
  extractRefErrors,
  hardDeleteBlueprintMutationOptions,
  restoreBlueprintMutationOptions,
  softDeleteBlueprintMutationOptions,
  updateBlueprintInputSchema,
  updateBlueprintMutationOptions,
  validateBlueprintTierReferencesAgainstWorld,
  type BuildingBlueprint,
  type CreateBlueprintInput,
  type CostRowState,
  type EffectRowState,
  type TierCostEntryInput,
  type TierEffectInput,
  type TierFormErrors,
  type UpdateBlueprintInput,
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
import { buildingInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { BlueprintTierEditor } from "./BlueprintTierEditor";

type WorldBuildingsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly selectedBlueprintId?: string;
  readonly worldId: string;
};

export function WorldBuildingsConfigPanel({
  canAdmin,
  isArchived,
  selectedBlueprintId,
  worldId,
}: WorldBuildingsConfigPanelProps): JSX.Element {
  if (selectedBlueprintId !== undefined) {
    return (
      <BlueprintTierEditor
        blueprintId={selectedBlueprintId}
        canAdmin={canAdmin}
        isArchived={isArchived}
        worldId={worldId}
      />
    );
  }

  return (
    <BlueprintListPanel
      canAdmin={canAdmin}
      isArchived={isArchived}
      worldId={worldId}
    />
  );
}

function BlueprintListPanel({
  canAdmin,
  isArchived,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));

  if (blueprintsQuery.isPending) {
    return (
      <section
        aria-labelledby="world-buildings-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading blueprints…" />
      </section>
    );
  }

  if (blueprintsQuery.isError) {
    return (
      <section
        aria-labelledby="world-buildings-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Blueprints could not be loaded"
          description={getErrorDescription(blueprintsQuery.error)}
        />
      </section>
    );
  }

  const allBlueprints = blueprintsQuery.data;
  const visibleBlueprints = showTrash
    ? allBlueprints.filter((bp) => !bp.isActive)
    : allBlueprints.filter((bp) => bp.isActive);

  return (
    <WorldBuildingsConfigPanelContent
      blueprints={visibleBlueprints}
      canAdmin={canAdmin}
      isArchived={isArchived}
      queryClient={queryClient}
      showTrash={showTrash}
      worldId={worldId}
      onToggleTrash={() => {
        setShowTrash((v) => !v);
      }}
    />
  );
}

type PendingTierDraft = {
  readonly id: string;
  readonly tierNumber: number;
  readonly workerTurnsRequired?: number;
  readonly constructionCostsJson?: TierCostEntryInput[];
  readonly upkeepCostsJson?: TierCostEntryInput[];
  readonly effectsJson?: TierEffectInput[];
};

function WorldBuildingsConfigPanelContent({
  blueprints,
  canAdmin,
  isArchived,
  queryClient,
  showTrash,
  worldId,
  onToggleTrash,
}: {
  readonly blueprints: readonly BuildingBlueprint[];
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly onToggleTrash: () => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  const createBlueprintMutation = useMutation(
    createBlueprintMutationOptions({ queryClient }),
  );
  const createTierMutation = useMutation(
    createTierMutationOptions({ queryClient }),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBlueprintId, setEditingBlueprintId] = useState<string | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const canEdit = canAdmin && !isArchived;

  async function handleCreateWithTiers(
    blueprintInput: CreateBlueprintInput,
    pendingTiers: readonly PendingTierDraft[],
  ): Promise<void> {
    setIsCreating(true);
    try {
      const blueprint =
        await createBlueprintMutation.mutateAsync(blueprintInput);
      const failures: number[] = [];
      for (const draft of pendingTiers) {
        try {
          await createTierMutation.mutateAsync({
            blueprintId: blueprint.id,
            constructionCostsJson: draft.constructionCostsJson,
            effectsJson: draft.effectsJson,
            tierNumber: draft.tierNumber,
            upkeepCostsJson: draft.upkeepCostsJson,
            workerTurnsRequired: draft.workerTurnsRequired,
          });
        } catch {
          failures.push(draft.tierNumber);
        }
      }
      if (failures.length > 0) {
        toast.error(
          `Blueprint created, but tier${failures.length > 1 ? "s" : ""} ${failures.join(", ")} failed — use "Manage tiers →" to add them.`,
        );
      } else {
        notifyMutationSuccess(
          pendingTiers.length > 0
            ? "Blueprint and tiers created."
            : "Blueprint created.",
        );
      }
      setShowCreateForm(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create blueprint.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section
      aria-labelledby="world-buildings-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-center justify-between">
        <h2
          id="world-buildings-title"
          className="text-lg font-semibold tracking-normal"
        >
          Buildings
        </h2>
        <div className="flex items-center gap-2">
          {canEdit && !showCreateForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add blueprint
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showTrash ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={showTrash ? "Hide trash" : "Show trash"}
            aria-pressed={showTrash}
            title={showTrash ? "Hide trash" : "Show trash"}
            onClick={onToggleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      {blueprints.length > 0 ? (
        <BlueprintList
          blueprints={blueprints}
          canEdit={canEdit}
          editingBlueprintId={editingBlueprintId}
          queryClient={queryClient}
          showTrash={showTrash}
          worldId={worldId}
          onEditingChange={setEditingBlueprintId}
        />
      ) : showTrash ? (
        <p className="text-sm text-muted-foreground">No trashed blueprints.</p>
      ) : !showCreateForm ? (
        <EmptyState
          title="No blueprints yet"
          description="Add the first building blueprint for this world."
        />
      ) : null}

      {canEdit && showCreateForm && !showTrash ? (
        <CreateBlueprintForm
          isPending={isCreating}
          worldId={worldId}
          onCancel={() => {
            setShowCreateForm(false);
          }}
          onSubmit={(input, pendingTiers) => {
            void handleCreateWithTiers(input, pendingTiers);
          }}
        />
      ) : null}
    </section>
  );
}

function BlueprintList({
  blueprints,
  canEdit,
  editingBlueprintId,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly blueprints: readonly BuildingBlueprint[];
  readonly canEdit: boolean;
  readonly editingBlueprintId: string | null;
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  return (
    <ul aria-label="Blueprints" className="grid gap-2">
      {blueprints.map((blueprint) => {
        if (showTrash) {
          return (
            <TrashedBlueprintRow
              key={blueprint.id}
              blueprint={blueprint}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingBlueprintId === blueprint.id ? (
          <li key={blueprint.id}>
            <EditBlueprintForm
              blueprint={blueprint}
              queryClient={queryClient}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <BlueprintRow
            key={blueprint.id}
            blueprint={blueprint}
            canEdit={canEdit}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(blueprint.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function BlueprintRow({
  blueprint,
  canEdit,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly blueprint: BuildingBlueprint;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteBlueprintMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { blueprintId: blueprint.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move blueprint to trash.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Blueprint moved to trash.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{blueprint.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/worlds/$worldId/configuration"
          params={{ worldId }}
          search={{ blueprint: blueprint.id, tab: "buildings" }}
          className="text-xs text-primary hover:underline"
        >
          Manage tiers →
        </Link>
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${blueprint.name} to trash`}
            title="Move to trash"
            disabled={softDeleteMutation.isPending}
            onClick={handleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function TrashedBlueprintRow({
  blueprint,
  queryClient,
  worldId,
}: {
  readonly blueprint: BuildingBlueprint;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreBlueprintMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteBlueprintMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { blueprintId: blueprint.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to restore blueprint.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Blueprint restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { blueprintId: blueprint.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to permanently delete blueprint.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Blueprint permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{blueprint.name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleRestore}
        >
          Restore
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleHardDelete}
        >
          Delete permanently
        </Button>
      </div>
    </li>
  );
}

type BlueprintFieldErrors = {
  readonly description?: string;
  readonly gracePeriodTurns?: string;
  readonly maxInstancesPerSettlement?: string;
  readonly name?: string;
  readonly slug?: string;
};

function CreateBlueprintForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (
    input: CreateBlueprintInput,
    pendingTiers: readonly PendingTierDraft[],
  ) => void;
  readonly worldId: string;
}): JSX.Element {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [gracePeriodTurns, setGracePeriodTurns] = useState("0");
  const [maxInstances, setMaxInstances] = useState("");
  const [fieldErrors, setFieldErrors] = useState<BlueprintFieldErrors>({});
  const [pendingTiers, setPendingTiers] = useState<PendingTierDraft[]>([]);
  const [showAddTierForm, setShowAddTierForm] = useState(false);

  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const tiersReady = resourcesQuery.isSuccess && jobsQuery.isSuccess;

  function handleNameChange(value: string): void {
    setName(value);
    if (!slugEdited) {
      setSlug(toSlug(value));
    }
  }

  function handleSlugChange(value: string): void {
    setSlug(value);
    setSlugEdited(value.length > 0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    const input: CreateBlueprintInput = {
      description: description.length > 0 ? description : undefined,
      gracePeriodTurns:
        gracePeriodTurns !== "" ? parseInt(gracePeriodTurns, 10) : undefined,
      maxInstancesPerSettlement:
        maxInstances !== "" ? parseInt(maxInstances, 10) : undefined,
      name,
      slug,
      worldId,
    };

    const result = createBlueprintInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        description: errors.description,
        gracePeriodTurns: errors.gracePeriodTurns,
        maxInstancesPerSettlement: errors.maxInstancesPerSettlement,
        name: errors.name,
        slug: errors.slug,
      });
      return;
    }

    onSubmit(input, pendingTiers);
  }

  const nextTierNumber =
    pendingTiers.length > 0
      ? Math.max(...pendingTiers.map((t) => t.tierNumber)) + 1
      : 1;

  return (
    <form
      aria-label="Create blueprint"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 className="text-sm font-medium">New blueprint</h3>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            aria-invalid={fieldErrors.name !== undefined}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintNameMax}
            value={name}
            onChange={(e) => {
              handleNameChange(e.currentTarget.value);
            }}
          />
          {fieldErrors.name !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Slug</span>
          <Input
            aria-invalid={fieldErrors.slug !== undefined}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintSlugMax}
            value={slug}
            onChange={(e) => {
              handleSlugChange(e.currentTarget.value);
            }}
          />
          {fieldErrors.slug !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.slug}</p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea
            aria-invalid={fieldErrors.description !== undefined}
            className={cn(
              "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              "min-h-[80px] resize-y",
            )}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintDescriptionMax}
            value={description}
            onChange={(e) => {
              setDescription(e.currentTarget.value);
            }}
          />
          {fieldErrors.description !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.description}
            </p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Grace period (turns)</span>
          <Input
            aria-invalid={fieldErrors.gracePeriodTurns !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="0"
            value={gracePeriodTurns}
            onChange={(e) => {
              setGracePeriodTurns(e.currentTarget.value);
            }}
          />
          {fieldErrors.gracePeriodTurns !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.gracePeriodTurns}
            </p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">
            Max instances per settlement
          </span>
          <Input
            aria-invalid={fieldErrors.maxInstancesPerSettlement !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="Unlimited"
            value={maxInstances}
            onChange={(e) => {
              setMaxInstances(e.currentTarget.value);
            }}
          />
          {fieldErrors.maxInstancesPerSettlement !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.maxInstancesPerSettlement}
            </p>
          ) : null}
        </label>
      </div>

      <div className="grid gap-2 border-t border-border pt-3">
        <span className="text-sm font-medium">Initial tiers (optional)</span>

        {pendingTiers.length > 0 ? (
          <ul aria-label="Pending tiers" className="grid gap-2">
            {pendingTiers.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm">
                  Tier {draft.tierNumber}
                  {draft.workerTurnsRequired !== undefined
                    ? ` — ${String(draft.workerTurnsRequired)} worker turn${draft.workerTurnsRequired !== 1 ? "s" : ""}`
                    : ""}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setPendingTiers((prev) =>
                      prev.filter((t) => t.id !== draft.id),
                    );
                  }}
                >
                  <X aria-hidden="true" className="text-destructive" />
                  <span className="sr-only">
                    Remove tier {draft.tierNumber}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {!showAddTierForm ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={isPending || !tiersReady}
            onClick={() => {
              setShowAddTierForm(true);
            }}
          >
            <Plus aria-hidden="true" />
            Add tier
          </Button>
        ) : null}

        {showAddTierForm && tiersReady ? (
          <InlineTierDraftForm
            activeJobs={jobsQuery.data}
            activeResources={resourcesQuery.data}
            defaultTierNumber={nextTierNumber}
            disabled={isPending}
            onAdd={(draft) => {
              setPendingTiers((prev) => [...prev, draft]);
              setShowAddTierForm(false);
            }}
            onCancel={() => {
              setShowAddTierForm(false);
            }}
          />
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || showAddTierForm}>
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

function InlineTierDraftForm({
  activeJobs,
  activeResources,
  defaultTierNumber,
  disabled,
  onAdd,
  onCancel,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly defaultTierNumber: number;
  readonly disabled: boolean;
  readonly onAdd: (draft: PendingTierDraft) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [tierNumber, setTierNumber] = useState(String(defaultTierNumber));
  const [workerTurns, setWorkerTurns] = useState("0");
  const [constructionCosts, setConstructionCosts] = useState<CostRowState[]>(
    [],
  );
  const [upkeepCosts, setUpkeepCosts] = useState<CostRowState[]>([]);
  const [effects, setEffects] = useState<EffectRowState[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TierFormErrors>({});

  function handleAdd(): void {
    setFieldErrors({});

    const constructionCostInputs = buildCostInputs(constructionCosts);
    const upkeepCostInputs = buildCostInputs(upkeepCosts);
    const effectInputs = buildEffectInputs(effects);

    const draftInput = {
      constructionCostsJson:
        constructionCostInputs.length > 0 ? constructionCostInputs : undefined,
      effectsJson: effectInputs.length > 0 ? effectInputs : undefined,
      tierNumber: tierNumber !== "" ? parseInt(tierNumber, 10) : 0,
      upkeepCostsJson:
        upkeepCostInputs.length > 0 ? upkeepCostInputs : undefined,
      workerTurnsRequired:
        workerTurns !== "" ? parseInt(workerTurns, 10) : undefined,
    };

    const parseResult = createTierInputSchema
      .omit({ blueprintId: true })
      .safeParse(draftInput);
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

    onAdd({
      constructionCostsJson: parseResult.data.constructionCostsJson,
      effectsJson: parseResult.data.effectsJson,
      id: crypto.randomUUID(),
      tierNumber: parseResult.data.tierNumber,
      upkeepCostsJson: parseResult.data.upkeepCostsJson,
      workerTurnsRequired: parseResult.data.workerTurnsRequired,
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div
      aria-label="Add tier draft"
      className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
      role="group"
    >
      <span className="text-sm font-medium">New tier</span>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Tier number</span>
        <Input
          aria-invalid={fieldErrors.tierNumber !== undefined}
          disabled={disabled}
          inputMode="numeric"
          placeholder="1"
          value={tierNumber}
          onChange={(e) => {
            setTierNumber(e.currentTarget.value);
          }}
          onKeyDown={handleKeyDown}
        />
        {fieldErrors.tierNumber !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.tierNumber}</p>
        ) : null}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Worker turns required</span>
        <Input
          aria-invalid={fieldErrors.workerTurnsRequired !== undefined}
          disabled={disabled}
          inputMode="numeric"
          placeholder="0"
          value={workerTurns}
          onChange={(e) => {
            setWorkerTurns(e.currentTarget.value);
          }}
          onKeyDown={handleKeyDown}
        />
        {fieldErrors.workerTurnsRequired !== undefined ? (
          <p className="text-xs text-destructive">
            {fieldErrors.workerTurnsRequired}
          </p>
        ) : null}
      </label>
      <CostEditor
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.constructionCostsJson}
        label="Construction costs"
        rows={constructionCosts}
        onChange={setConstructionCosts}
      />
      <CostEditor
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.upkeepCostsJson}
        label="Upkeep costs"
        rows={upkeepCosts}
        onChange={setUpkeepCosts}
      />
      <EffectsEditor
        activeJobs={activeJobs}
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.effectsJson}
        rows={effects}
        onChange={setEffects}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={handleAdd}>
          Add
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EditBlueprintForm({
  blueprint,
  onClose,
  queryClient,
  worldId,
}: {
  readonly blueprint: BuildingBlueprint;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateBlueprintMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteBlueprintMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(blueprint.name);
  const [slug, setSlug] = useState(blueprint.slug);
  const [description, setDescription] = useState(blueprint.description ?? "");
  const [gracePeriodTurns, setGracePeriodTurns] = useState(
    String(blueprint.gracePeriodTurns),
  );
  const [maxInstances, setMaxInstances] = useState(
    blueprint.maxInstancesPerSettlement !== null
      ? String(blueprint.maxInstancesPerSettlement)
      : "",
  );
  const [fieldErrors, setFieldErrors] = useState<BlueprintFieldErrors>({});

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldErrors({});

    const updateInput: UpdateBlueprintInput = {
      blueprintId: blueprint.id,
      description: description.length > 0 ? description : undefined,
      gracePeriodTurns:
        gracePeriodTurns !== "" ? parseInt(gracePeriodTurns, 10) : undefined,
      maxInstancesPerSettlement:
        maxInstances !== "" ? parseInt(maxInstances, 10) : undefined,
      name,
      slug,
      worldId,
    };

    const result = updateBlueprintInputSchema.safeParse(updateInput);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        description: errors.description,
        gracePeriodTurns: errors.gracePeriodTurns,
        maxInstancesPerSettlement: errors.maxInstancesPerSettlement,
        name: errors.name,
        slug: errors.slug,
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Blueprint saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save blueprint.",
      );
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({
        blueprintId: blueprint.id,
        worldId,
      });
      notifyMutationSuccess("Blueprint moved to trash.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to move blueprint to trash.",
      );
    }
  }

  return (
    <form
      aria-label="Edit blueprint"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit blueprint</h3>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            aria-invalid={fieldErrors.name !== undefined}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintNameMax}
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
            }}
          />
          {fieldErrors.name !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Slug</span>
          <Input
            aria-invalid={fieldErrors.slug !== undefined}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintSlugMax}
            value={slug}
            onChange={(e) => {
              setSlug(e.currentTarget.value);
            }}
          />
          {fieldErrors.slug !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.slug}</p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea
            aria-invalid={fieldErrors.description !== undefined}
            className={cn(
              "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              "min-h-[80px] resize-y",
            )}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintDescriptionMax}
            value={description}
            onChange={(e) => {
              setDescription(e.currentTarget.value);
            }}
          />
          {fieldErrors.description !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.description}
            </p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Grace period (turns)</span>
          <Input
            aria-invalid={fieldErrors.gracePeriodTurns !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="0"
            value={gracePeriodTurns}
            onChange={(e) => {
              setGracePeriodTurns(e.currentTarget.value);
            }}
          />
          {fieldErrors.gracePeriodTurns !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.gracePeriodTurns}
            </p>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">
            Max instances per settlement
          </span>
          <Input
            aria-invalid={fieldErrors.maxInstancesPerSettlement !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="Unlimited"
            value={maxInstances}
            onChange={(e) => {
              setMaxInstances(e.currentTarget.value);
            }}
          />
          {fieldErrors.maxInstancesPerSettlement !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.maxInstancesPerSettlement}
            </p>
          ) : null}
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            void handleTrash();
          }}
        >
          <Trash2 aria-hidden="true" />
          Move to trash
        </Button>
      </div>
    </form>
  );
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, buildingInputLimits.blueprintSlugMax);
}
