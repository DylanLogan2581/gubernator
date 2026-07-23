import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { jobsByWorldQueryOptions } from "@/features/jobs";
import { nationsListQueryOptions } from "@/features/nations";
import type { AccessContext } from "@/features/permissions";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { worldRouteAccessQueryOptions } from "@/features/worlds";
import { generateLocalId } from "@/lib/uid";

import {
  createEventGroupMutationOptions,
  editEventGroupMutationOptions,
  isEventMutationError,
} from "../mutations/eventMutations";
import { eventQueryKeys } from "../queries/eventQueryKeys";

import { EventCreateEffectsStep } from "./steps/EventCreateEffectsStep";
import { EventCreateForecastStep } from "./steps/EventCreateForecastStep";
import { EventCreateNameDescriptionStep } from "./steps/EventCreateNameDescriptionStep";
import { EventCreateStep1 } from "./steps/EventCreateStep1";
import { EventCreateStep2 } from "./steps/EventCreateStep2";
import { EventCreateStep3 } from "./steps/EventCreateStep3";
import { EventScopeReadOnly } from "./steps/EventScopeReadOnly";

import type { CreateEventGroupInput } from "../schemas/eventSchemas";
import type { EventMemoryDraft } from "./steps/EventCreateForecastStep";

// Import EffectData type for expandMultiResourceEffects
type EffectData = {
  effectType: string;
  isPercent: boolean;
  amountValue: number | null;
  multiplierValue: number | null;
  resourceId: string | null;
  resourceIds?: string[];
  resourceMode?: "all" | "select";
  populationType?: "boost" | "loss";
  jobId: string | null;
  jobIds?: string[];
  jobMode?: "all" | "select";
  managedPopulationInstanceId: string | null;
  managedPopulationTypeId: string | null;
  managedPopulationMode?: "all" | "type" | "instance";
  depositInstanceId: string | null;
  depositInstanceIds?: string[];
  depositTypeId?: string | null;
  depositDestroyedMode?: "instance" | "type";
  settlementBuildingId: string | null;
  settlementBuildingIds?: string[];
  buildingBlueprintMode?: "all" | "select" | "instance";
  buildingBlueprintIds?: string[];
  buildingInstanceIds?: string[];
  _id?: string;
};

type EditEventData = {
  readonly groupId: string;
  readonly groupName: string;
  readonly groupDescription: string | null;
  readonly icon: string | null;
  readonly scopeType: string;
  readonly scopeNationId: string | null;
  readonly scopeSettlementId: string | null;
  readonly durationType: string;
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly memories: Array<{
    readonly turnOffset: number;
    readonly memoryText: string;
  }>;
  readonly effects: Array<{
    readonly effectType: string;
    readonly isPercent: boolean;
    readonly amountValue: number | null;
    readonly multiplierValue: number | null;
    readonly resourceId: string | null;
    readonly jobId: string | null;
    readonly managedPopulationInstanceId: string | null;
    readonly managedPopulationTypeId: string | null;
    readonly depositInstanceId: string | null;
    readonly settlementBuildingId: string | null;
    readonly extraDataJsonb: unknown;
  }>;
};

type EventCreateWizardProps = {
  readonly accessContext: AccessContext;
  readonly worldId: string;
  readonly onClose: () => void;
  readonly isEditMode?: boolean;
  readonly editGroupId?: string;
  readonly editEventData?: EditEventData;
  readonly isAlreadyActivated?: boolean;
};

export type EventCreateWizardState = {
  step: 1 | 2 | 3;
  scopeType: "world" | "nation" | "settlement" | null;
  selectedIds: string[]; // nation or settlement IDs
  effects: EffectData[];
  durationType: "instant" | "sustained";
  durationTransitions: number | null;
  activationTurn: number;
  memories: EventMemoryDraft[];
};

/** Extracts wizard-only targeting fields persisted in an effect's extra_data_jsonb column. */
function extractEffectExtraData(extraDataJsonb: unknown): {
  managedPopulationMode?: "all" | "type" | "instance";
  buildingBlueprintMode?: "all" | "select" | "instance";
  buildingBlueprintIds?: string[];
  buildingInstanceIds?: string[];
  depositDestroyedMode?: "instance" | "type";
  depositTypeId?: string;
} {
  if (typeof extraDataJsonb !== "object" || extraDataJsonb === null) return {};
  const data = extraDataJsonb as Record<string, unknown>;

  const managedPopulationMode =
    data.managed_population_mode === "all" ||
    data.managed_population_mode === "type" ||
    data.managed_population_mode === "instance"
      ? data.managed_population_mode
      : undefined;

  const buildingBlueprintMode =
    data.building_blueprint_mode === "all" ||
    data.building_blueprint_mode === "select" ||
    data.building_blueprint_mode === "instance"
      ? data.building_blueprint_mode
      : undefined;

  const buildingBlueprintIds = Array.isArray(data.building_blueprint_ids)
    ? data.building_blueprint_ids.filter(
        (id): id is string => typeof id === "string",
      )
    : undefined;

  const buildingInstanceIds = Array.isArray(data.building_instance_ids)
    ? data.building_instance_ids.filter(
        (id): id is string => typeof id === "string",
      )
    : undefined;

  const depositDestroyedMode =
    data.deposit_destroyed_mode === "instance" ||
    data.deposit_destroyed_mode === "type"
      ? data.deposit_destroyed_mode
      : undefined;

  const depositTypeId =
    typeof data.deposit_type_id === "string" ? data.deposit_type_id : undefined;

  return {
    managedPopulationMode,
    buildingBlueprintMode,
    buildingBlueprintIds,
    buildingInstanceIds,
    depositDestroyedMode,
    depositTypeId,
  };
}

const createInitialState = (
  nextTurnNumber: number = 1,
): EventCreateWizardState => ({
  step: 1,
  scopeType: null,
  selectedIds: [],
  effects: [],
  durationType: "instant",
  durationTransitions: null,
  activationTurn: nextTurnNumber,
  memories: [],
});

export function EventCreateWizard({
  accessContext,
  worldId,
  onClose,
  isEditMode = false,
  editGroupId,
  editEventData,
  isAlreadyActivated = false,
}: EventCreateWizardProps): JSX.Element {
  const queryClient = useQueryClient();
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  const nextTurnNumber = worldQuery.data?.world.nextTurnNumber ?? 1;

  // Initialize state based on mode
  const [state, setState] = useState<EventCreateWizardState>(() => {
    if (isEditMode && editEventData !== undefined) {
      // In edit mode, scope/targets are locked (shown read-only on step 1),
      // but the wizard still opens on the Basics step like create mode.
      return {
        step: 1,
        scopeType:
          (editEventData.scopeType as "world" | "nation" | "settlement") ??
          null,
        selectedIds: [], // Locked in edit mode
        effects: editEventData.effects.map((e) => {
          const extra = extractEffectExtraData(e.extraDataJsonb);
          return {
            effectType: e.effectType,
            isPercent: e.isPercent,
            amountValue: e.amountValue,
            multiplierValue: e.multiplierValue,
            resourceId: e.resourceId,
            jobId: e.jobId,
            managedPopulationInstanceId: e.managedPopulationInstanceId,
            managedPopulationTypeId: e.managedPopulationTypeId,
            managedPopulationMode: extra.managedPopulationMode,
            depositInstanceId: e.depositInstanceId,
            depositTypeId: extra.depositTypeId,
            depositDestroyedMode: extra.depositDestroyedMode,
            settlementBuildingId: e.settlementBuildingId,
            buildingBlueprintMode: extra.buildingBlueprintMode,
            buildingBlueprintIds: extra.buildingBlueprintIds,
            buildingInstanceIds: extra.buildingInstanceIds,
            _id: generateLocalId(),
          };
        }),
        durationType:
          (editEventData.durationType as "instant" | "sustained") ?? "instant",
        durationTransitions: editEventData.durationTransitions,
        activationTurn: editEventData.activationTurn,
        memories: editEventData.memories.map((m) => ({
          turnOffset: m.turnOffset,
          text: m.memoryText,
        })),
      };
    }
    return createInitialState(nextTurnNumber);
  });

  const [groupName, setGroupName] = useState(editEventData?.groupName ?? "");
  const [groupDescription, setGroupDescription] = useState(
    editEventData?.groupDescription ?? "",
  );
  const [icon, setIcon] = useState<string | null>(editEventData?.icon ?? null);

  // Update activation turn when world data changes and state hasn't been customized
  useEffect(() => {
    if (nextTurnNumber > 1 && state.activationTurn === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect
      setState((prev) => ({
        ...prev,
        activationTurn: nextTurnNumber,
      }));
    }
  }, [nextTurnNumber, state.activationTurn]);

  const createMutationCreate = useMutation(
    createEventGroupMutationOptions({
      queryClient,
    }),
  );

  const editMutation = useMutation(
    editEventGroupMutationOptions({
      queryClient,
    }),
  );

  // Dirty tracking: becomes true on any user field change; bypassed on successful submit
  const isSubmittedRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = (): void => {
    setIsDirty(true);
  };

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !isSubmittedRef.current,
    withResolver: true,
    enableBeforeUnload: true,
  });

  const handleNext = (): void => {
    setState((prev) => ({
      ...prev,
      step: Math.min(3, prev.step + 1) as 1 | 2 | 3,
    }));
  };

  const handlePrev = (): void => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as 1 | 2 | 3,
    }));
  };

  const expandMultiResourceEffects = (
    effects: EffectData[],
    allResourceIds?: string[],
    allJobIds?: string[],
  ): EffectData[] => {
    const expanded: EffectData[] = [];

    for (const effect of effects) {
      // Handle modify_resource: expand to individual resource_grant/drain effects
      if (effect.effectType === "modify_resource") {
        // Determine which resources to expand to
        let resourceIdsToExpand: string[] = [];

        if (effect.resourceMode === "all" && allResourceIds !== undefined) {
          // Expand "all" mode to all available resource IDs
          resourceIdsToExpand = allResourceIds;
        } else if (
          effect.resourceIds !== undefined &&
          effect.resourceIds.length > 0
        ) {
          // Use explicitly selected resource IDs
          resourceIdsToExpand = effect.resourceIds;
        }

        if (resourceIdsToExpand.length > 0) {
          const isNegative = (effect.amountValue ?? 0) < 0;
          const absAmount = Math.abs(effect.amountValue ?? 0);

          for (const resourceId of resourceIdsToExpand) {
            expanded.push({
              ...effect,
              effectType: isNegative ? "resource_drain" : "resource_grant",
              amountValue: absAmount,
              resourceId,
              resourceIds: undefined,
              resourceMode: undefined,
            });
          }
        }
      } else if (effect.effectType === "production_multiplier") {
        // Handle production_multiplier: expand to individual per-job effects if in select mode
        let jobIdsToExpand: string[] = [];

        if (effect.jobMode === "all" && allJobIds !== undefined) {
          // Expand "all" mode to all available job IDs
          jobIdsToExpand = allJobIds;
        } else if (effect.jobIds !== undefined && effect.jobIds.length > 0) {
          // Use explicitly selected job IDs
          jobIdsToExpand = effect.jobIds;
        }

        if (jobIdsToExpand.length > 0) {
          // Create one effect per job
          for (const jobId of jobIdsToExpand) {
            expanded.push({
              ...effect,
              effectType: "production_multiplier",
              jobId,
              jobIds: undefined,
              jobMode: undefined,
            });
          }
        } else {
          // No jobs selected, keep as-is with null jobId (affects all jobs)
          expanded.push({
            ...effect,
            jobId: null,
            jobIds: undefined,
            jobMode: undefined,
          });
        }
      } else if (
        effect.effectType === "building_destroyed" &&
        effect.settlementBuildingIds !== undefined &&
        effect.settlementBuildingIds.length > 0
      ) {
        // Handle building_destroyed: expand to individual per-building effects
        for (const settlementBuildingId of effect.settlementBuildingIds) {
          expanded.push({
            ...effect,
            effectType: "building_destroyed",
            settlementBuildingId,
            settlementBuildingIds: undefined,
          });
        }
      } else if (
        effect.effectType === "deposit_destroyed" &&
        effect.depositInstanceIds !== undefined &&
        effect.depositInstanceIds.length > 0
      ) {
        // Handle deposit_destroyed: expand to individual per-deposit effects
        for (const depositInstanceId of effect.depositInstanceIds) {
          expanded.push({
            ...effect,
            effectType: "deposit_destroyed",
            depositInstanceId,
            depositInstanceIds: undefined,
          });
        }
      } else {
        // Keep other effects as-is
        expanded.push(effect);
      }
    }

    return expanded;
  };

  const hasInvalidJobSelection = (effects: EffectData[]): boolean =>
    effects.some(
      (e) =>
        e.effectType === "production_multiplier" &&
        e.jobMode === "select" &&
        (e.jobIds === undefined || e.jobIds.length === 0),
    );

  const handleSubmit = async (): Promise<void> => {
    if (state.scopeType === null) return;
    if (
      isEditMode &&
      (editGroupId === undefined || editEventData === undefined)
    )
      return;
    if (hasInvalidJobSelection(state.effects)) {
      toast.error(
        "Select at least one job for the production multiplier, or choose All Jobs.",
      );
      return;
    }

    try {
      // Fetch all resources to expand "all" mode if needed
      const resourcesQuery = await queryClient.ensureQueryData(
        activeResourcesByWorldQueryOptions(worldId),
      );
      const allResourceIds = resourcesQuery.map((r) => r.id);

      // Fetch all jobs to expand "all" mode if needed
      const jobsQuery = await queryClient.ensureQueryData(
        jobsByWorldQueryOptions(worldId),
      );
      const allJobIds = jobsQuery.map((j) => j.id);

      const expandedEffects = expandMultiResourceEffects(
        state.effects,
        allResourceIds,
        allJobIds,
      );

      const baseEffects = expandedEffects.map((e) => ({
        effectType:
          e.effectType as CreateEventGroupInput["effects"][number]["effectType"],
        isPercent: e.isPercent,
        amountValue: e.amountValue,
        multiplierValue: e.multiplierValue,
        resourceId: e.resourceId,
        jobId: e.jobId,
        managedPopulationInstanceId: e.managedPopulationInstanceId,
        managedPopulationTypeId: e.managedPopulationTypeId,
        managedPopulationMode: e.managedPopulationMode,
        depositInstanceId: e.depositInstanceId,
        depositTypeId: e.depositTypeId,
        depositDestroyedMode: e.depositDestroyedMode,
        settlementBuildingId: e.settlementBuildingId,
        buildingBlueprintMode: e.buildingBlueprintMode,
        buildingBlueprintIds: e.buildingBlueprintIds,
        buildingInstanceIds: e.buildingInstanceIds,
      }));

      const memories = state.memories
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({
          turnOffset: m.turnOffset,
          memoryText: m.text,
        }));

      if (isEditMode) {
        // Edit mode: use EditEventGroupInput
        const input = {
          groupId: editGroupId as string,
          worldId,
          groupName,
          groupDescription,
          icon,
          effects: baseEffects,
          durationType: state.durationType,
          durationTransitions:
            state.durationType === "sustained"
              ? state.durationTransitions
              : null,
          activationTurn: state.activationTurn,
          memories,
        };

        await editMutation.mutateAsync(input);

        toast.success("Event updated successfully");
        await queryClient.invalidateQueries({
          queryKey: eventQueryKeys.byWorld(worldId),
        });
        isSubmittedRef.current = true;
        onClose();
      } else {
        // Create mode: use CreateEventGroupInput
        let scopeNameById = new Map<string, string>();
        if (state.scopeType === "nation") {
          const nations = await queryClient.ensureQueryData(
            nationsListQueryOptions(worldId),
          );
          scopeNameById = new Map(nations.map((n) => [n.id, n.name]));
        } else if (state.scopeType === "settlement") {
          const settlements = await queryClient.ensureQueryData(
            settlementsByWorldQueryOptions(worldId),
          );
          scopeNameById = new Map(settlements.map((s) => [s.id, s.name]));
        }

        const targets =
          state.scopeType === "world"
            ? [
                {
                  scope_id: null,
                  nation_id: null,
                  settlement_id: null,
                  scope_name: "World",
                  job_id: null,
                  building_blueprint_id: null,
                  managed_population_type_id: null,
                },
              ]
            : state.selectedIds.map((id) => ({
                scope_id: id,
                nation_id: state.scopeType === "nation" ? id : null,
                settlement_id: state.scopeType === "settlement" ? id : null,
                scope_name:
                  scopeNameById.get(id) ??
                  (state.scopeType === "nation"
                    ? `Nation ${id}`
                    : `Settlement ${id}`),
                job_id: null,
                building_blueprint_id: null,
                managed_population_type_id: null,
              }));

        const input: CreateEventGroupInput = {
          worldId,
          groupName,
          groupDescription,
          icon,
          effects: baseEffects,
          scopeType: state.scopeType,
          targets,
          durationType: state.durationType,
          durationTransitions:
            state.durationType === "sustained"
              ? state.durationTransitions
              : null,
          activationTurn: state.activationTurn,
          memories,
        };

        await createMutationCreate.mutateAsync(input);

        toast.success("Event created successfully");
        setState(createInitialState(nextTurnNumber));
        setGroupName("");
        setGroupDescription("");
        setIcon(null);
        await queryClient.invalidateQueries({
          queryKey: eventQueryKeys.byWorld(worldId),
        });
        isSubmittedRef.current = true;
        onClose();
      }
    } catch (error) {
      if (isEventMutationError(error)) {
        toast.error(error.message);
      } else {
        toast.error(
          isEditMode ? "Failed to update event" : "Failed to create event",
        );
      }
    }
  };

  const totalSteps = 3;

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {isEditMode ? "Edit Event" : "Create Event"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {state.step} of {totalSteps}
          </p>
        </div>

        <div className="space-y-6">
          {state.step === 1 && (
            <div className="space-y-6">
              <EventCreateNameDescriptionStep
                groupName={groupName}
                groupDescription={groupDescription}
                icon={icon}
                onGroupNameChange={(val) => {
                  setGroupName(val);
                  markDirty();
                }}
                onGroupDescriptionChange={(val) => {
                  setGroupDescription(val);
                  markDirty();
                }}
                onIconChange={(val) => {
                  setIcon(val);
                  markDirty();
                }}
              />

              {isEditMode ? (
                state.scopeType !== null && (
                  <EventScopeReadOnly
                    scopeType={state.scopeType}
                    scopeNationId={editEventData?.scopeNationId ?? null}
                    scopeSettlementId={editEventData?.scopeSettlementId ?? null}
                  />
                )
              ) : (
                <>
                  <EventCreateStep1
                    scopeType={state.scopeType}
                    onScopeTypeChange={(scopeType) => {
                      setState((prev) => ({
                        ...prev,
                        scopeType,
                        selectedIds: [],
                      }));
                      markDirty();
                    }}
                  />

                  {state.scopeType !== null && (
                    <EventCreateStep2
                      worldId={worldId}
                      scopeType={state.scopeType}
                      selectedIds={state.selectedIds}
                      onSelectedIdsChange={(ids) => {
                        setState((prev) => ({
                          ...prev,
                          selectedIds: ids,
                        }));
                        markDirty();
                      }}
                    />
                  )}
                </>
              )}

              <EventCreateStep3
                worldId={worldId}
                currentTurnNumber={
                  worldQuery.data?.world.currentTurnNumber ?? 0
                }
                durationType={state.durationType}
                durationTransitions={state.durationTransitions}
                activationTurn={state.activationTurn}
                onDurationTypeChange={(type) => {
                  setState((prev) => ({
                    ...prev,
                    durationType: type,
                  }));
                  markDirty();
                }}
                onDurationTransitionsChange={(trans) => {
                  setState((prev) => ({
                    ...prev,
                    durationTransitions: trans,
                  }));
                  markDirty();
                }}
                onActivationTurnChange={(turn) => {
                  setState((prev) => ({
                    ...prev,
                    activationTurn: turn,
                  }));
                  markDirty();
                }}
              />
            </div>
          )}

          {state.step === 2 && (
            <EventCreateEffectsStep
              effects={state.effects}
              onEffectsChange={(effects) => {
                setState((prev) => ({
                  ...prev,
                  effects,
                }));
                markDirty();
              }}
              worldId={worldId}
              selectedIds={state.selectedIds}
              scopeType={state.scopeType}
            />
          )}

          {state.step === 3 && (
            <EventCreateForecastStep
              groupName={groupName}
              groupDescription={groupDescription}
              scopeType={state.scopeType ?? "world"}
              selectedIds={state.selectedIds}
              effects={state.effects}
              durationType={state.durationType}
              durationTransitions={state.durationTransitions}
              activationTurn={state.activationTurn}
              worldId={worldId}
              memories={state.memories}
              onMemoriesChange={(memories) => {
                setState((prev) => ({
                  ...prev,
                  memories: [...memories],
                }));
                markDirty();
              }}
              isAlreadyActivated={isAlreadyActivated}
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {state.step !== 1 && (
            <Button variant="outline" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
          )}

          {state.step < 3 && (
            <Button
              onClick={handleNext}
              className="ml-auto"
              disabled={
                (state.step === 1 && groupName.trim().length === 0) ||
                (!isEditMode && state.step === 1 && state.scopeType === null) ||
                (!isEditMode &&
                  state.step === 1 &&
                  state.scopeType !== "world" &&
                  state.selectedIds.length === 0) ||
                (state.step === 2 && hasInvalidJobSelection(state.effects))
              }
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {state.step >= 3 && (
            <Button
              onClick={() => {
                void handleSubmit();
              }}
              disabled={
                (isEditMode
                  ? editMutation.isPending
                  : createMutationCreate.isPending) ||
                (!isEditMode &&
                  (state.scopeType === null ||
                    (state.scopeType !== "world" &&
                      state.selectedIds.length === 0))) ||
                hasInvalidJobSelection(state.effects)
              }
              className="ml-auto"
            >
              {(
                isEditMode
                  ? editMutation.isPending
                  : createMutationCreate.isPending
              )
                ? isEditMode
                  ? "Updating…"
                  : "Creating…"
                : isEditMode
                  ? "Update Event"
                  : "Create Event"}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Discard changes?"
        description="You have unsaved changes. Leaving now will discard your progress."
        confirmLabel="Discard"
        confirmVariant="destructive"
        isPending={false}
        onConfirm={() => {
          blocker.proceed?.();
        }}
      />
    </>
  );
}
