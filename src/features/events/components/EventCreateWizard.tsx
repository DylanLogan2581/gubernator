import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import { jobsByWorldQueryOptions } from "@/features/jobs";
import type { AccessContext } from "@/features/permissions";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { worldRouteAccessQueryOptions } from "@/features/worlds";
import {
  formatCalendarDate,
  formatRelativeTurnDifference,
  getRelativeTurnDifference,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import {
  createEventGroupMutationOptions,
  editEventGroupMutationOptions,
  isEventMutationError,
} from "../mutations/eventMutations";
import { eventQueryKeys } from "../queries/eventQueryKeys";

import { EventCreateEffectsStep } from "./steps/EventCreateEffectsStep";
import { EventCreateNameDescriptionStep } from "./steps/EventCreateNameDescriptionStep";
import { EventCreateStep1 } from "./steps/EventCreateStep1";
import { EventCreateStep2 } from "./steps/EventCreateStep2";
import { EventCreateStep3 } from "./steps/EventCreateStep3";
import { EventCreateStep4 } from "./steps/EventCreateStep4";
import { EventCreateStep5 } from "./steps/EventCreateStep5";

import type { CreateEventGroupInput } from "../schemas/eventSchemas";

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
  managedPopulationTypeId?: string | null;
  managedPopulationMode?: "all" | "type" | "instance";
  depositInstanceId: string | null;
  depositInstanceIds?: string[];
  settlementBuildingId: string | null;
  settlementBuildingIds?: string[];
  _id?: string;
};

type EditEventData = {
  readonly groupId: string;
  readonly groupName: string;
  readonly groupDescription: string | null;
  readonly scopeType: string;
  readonly durationType: string;
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly createCitizenMemories: boolean;
  readonly memoryText: string | null;
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
  step: 1 | 2 | 3 | 4 | 5 | 6;
  scopeType: "world" | "nation" | "settlement" | null;
  selectedIds: string[]; // nation or settlement IDs
  effects: Array<{
    effectType: string;
    isPercent: boolean;
    amountValue: number | null;
    multiplierValue: number | null;
    resourceId: string | null;
    jobId: string | null;
    managedPopulationInstanceId: string | null;
    managedPopulationTypeId: string | null;
    managedPopulationMode?: "all" | "type" | "instance";
    depositInstanceId: string | null;
    settlementBuildingId: string | null;
  }>;
  durationType: "instant" | "sustained";
  durationTransitions: number | null;
  activationTurn: number;
  createCitizenMemories: boolean;
  memoryText: string;
};

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
  createCitizenMemories: false,
  memoryText: "",
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
  const calendarConfigQuery = useQuery(
    worldCalendarConfigQueryOptions(worldId),
  );

  const nextTurnNumber = worldQuery.data?.world.nextTurnNumber ?? 1;
  const currentTurnNumber = worldQuery.data?.world.currentTurnNumber ?? 1;

  // Initialize state based on mode
  const [state, setState] = useState<EventCreateWizardState>(() => {
    if (isEditMode && editEventData !== undefined) {
      // In edit mode, skip scope/targets steps and go to effects
      return {
        step: 3, // Start at effects step (scope is locked)
        scopeType:
          (editEventData.scopeType as "world" | "nation" | "settlement") ??
          null,
        selectedIds: [], // Locked in edit mode
        effects: editEventData.effects.map((e) => ({
          effectType: e.effectType,
          isPercent: e.isPercent,
          amountValue: e.amountValue,
          multiplierValue: e.multiplierValue,
          resourceId: e.resourceId,
          jobId: e.jobId,
          managedPopulationInstanceId: e.managedPopulationInstanceId,
          managedPopulationTypeId: e.managedPopulationTypeId,
          depositInstanceId: e.depositInstanceId,
          settlementBuildingId: e.settlementBuildingId,
        })),
        durationType:
          (editEventData.durationType as "instant" | "sustained") ?? "instant",
        durationTransitions: editEventData.durationTransitions,
        activationTurn: editEventData.activationTurn,
        createCitizenMemories: editEventData.createCitizenMemories,
        memoryText: editEventData.memoryText ?? "",
      };
    }
    return createInitialState(nextTurnNumber);
  });

  const [groupName, setGroupName] = useState(editEventData?.groupName ?? "");
  const [groupDescription, setGroupDescription] = useState(
    editEventData?.groupDescription ?? "",
  );

  // Compute calendar date and relative time for activation turn
  let activationTurnCalendarDate: string | undefined;
  let activationTurnRelativeTime: string | undefined;
  if (
    calendarConfigQuery.data !== undefined &&
    calendarConfigQuery.data !== null
  ) {
    try {
      const resolved = resolveTurnCalendarDate(
        calendarConfigQuery.data,
        state.activationTurn,
      );
      activationTurnCalendarDate = formatCalendarDate(resolved, {
        dateFormatTemplate: calendarConfigQuery.data.dateFormatTemplate,
      });
      const relativeDiff = getRelativeTurnDifference(
        calendarConfigQuery.data,
        currentTurnNumber,
        state.activationTurn,
      );
      activationTurnRelativeTime = formatRelativeTurnDifference(relativeDiff);
    } catch {
      // Silently fail if turn number is invalid
    }
  }

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
    setState((prev) => {
      let nextStep = Math.min(6, prev.step + 1) as 1 | 2 | 3 | 4 | 5 | 6;
      // Skip step 2 in edit mode (scope selection is locked)
      if (isEditMode && nextStep === 2) {
        nextStep = 3;
      }
      return {
        ...prev,
        step: nextStep,
      };
    });
  };

  const handlePrev = (): void => {
    setState((prev) => {
      let prevStep = Math.max(1, prev.step - 1) as 1 | 2 | 3 | 4 | 5 | 6;
      // Skip step 2 in edit mode (scope selection is locked)
      if (isEditMode && prevStep === 2) {
        prevStep = 1;
      }
      return {
        ...prev,
        step: prevStep,
      };
    });
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

  const handleSubmit = async (): Promise<void> => {
    if (state.scopeType === null) return;
    if (
      isEditMode &&
      (editGroupId === undefined || editEventData === undefined)
    )
      return;

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
        settlementBuildingId: e.settlementBuildingId,
      }));

      if (isEditMode) {
        // Edit mode: use EditEventGroupInput
        const input = {
          groupId: editGroupId as string,
          worldId,
          groupName,
          groupDescription,
          effects: baseEffects,
          durationType: state.durationType,
          durationTransitions:
            state.durationType === "sustained"
              ? state.durationTransitions
              : null,
          activationTurn: state.activationTurn,
          createCitizenMemories: state.createCitizenMemories,
          memoryText: state.createCitizenMemories ? state.memoryText : null,
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
                  state.scopeType === "nation"
                    ? `Nation ${id}`
                    : `Settlement ${id}`,
                job_id: null,
                building_blueprint_id: null,
                managed_population_type_id: null,
              }));

        const input: CreateEventGroupInput = {
          worldId,
          groupName,
          groupDescription,
          effects: baseEffects,
          scopeType: state.scopeType,
          targets,
          durationType: state.durationType,
          durationTransitions:
            state.durationType === "sustained"
              ? state.durationTransitions
              : null,
          activationTurn: state.activationTurn,
          createCitizenMemories: state.createCitizenMemories,
          memoryText: state.createCitizenMemories ? state.memoryText : null,
        };

        await createMutationCreate.mutateAsync(input);

        toast.success("Event created successfully");
        setState(createInitialState(nextTurnNumber));
        setGroupName("");
        setGroupDescription("");
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

  // In edit mode, calculate effective step number (skip 1-2, map 3-6 to 1-4)
  const effectiveStep = isEditMode ? state.step - 2 : state.step;
  const totalSteps = isEditMode ? 4 : 6;

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {isEditMode ? "Edit Event" : "Create Event"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {effectiveStep} of {totalSteps}
          </p>
        </div>

        <div className="space-y-6">
          {state.step === 1 && (
            <EventCreateNameDescriptionStep
              groupName={groupName}
              groupDescription={groupDescription}
              onGroupNameChange={(val) => {
                setGroupName(val);
                markDirty();
              }}
              onGroupDescriptionChange={(val) => {
                setGroupDescription(val);
                markDirty();
              }}
            />
          )}

          {state.step === 2 && !isEditMode && (
            <div className="space-y-6">
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
            </div>
          )}

          {state.step === 3 && (
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

          {state.step === 4 && (
            <EventCreateStep3
              worldId={worldId}
              currentTurnNumber={worldQuery.data?.world.currentTurnNumber ?? 0}
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
          )}

          {state.step === 5 && (
            <EventCreateStep4
              createCitizenMemories={state.createCitizenMemories}
              memoryText={state.memoryText}
              groupDescription={groupDescription}
              isAlreadyActivated={isAlreadyActivated}
              onCreateCitizenMemoriesChange={(create) => {
                setState((prev) => ({
                  ...prev,
                  createCitizenMemories: create,
                }));
                markDirty();
              }}
              onMemoryTextChange={(text) => {
                setState((prev) => ({
                  ...prev,
                  memoryText: text,
                }));
                markDirty();
              }}
            />
          )}

          {state.step === 6 && (
            <EventCreateStep5
              groupName={groupName}
              groupDescription={groupDescription}
              scopeType={state.scopeType ?? "world"}
              selectedIds={state.selectedIds}
              effects={state.effects}
              durationType={state.durationType}
              durationTransitions={state.durationTransitions}
              activationTurn={state.activationTurn}
              activationTurnCalendarDate={activationTurnCalendarDate}
              activationTurnRelativeTime={activationTurnRelativeTime}
              createCitizenMemories={state.createCitizenMemories}
              worldId={worldId}
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {state.step !== 1 && (
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={isEditMode && state.step === 3}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
          )}

          {state.step < 6 && (
            <Button
              onClick={handleNext}
              className="ml-auto"
              disabled={
                (state.step === 1 && groupName.trim().length === 0) ||
                (!isEditMode && state.step === 2 && state.scopeType === null) ||
                (!isEditMode &&
                  state.step === 2 &&
                  state.scopeType !== "world" &&
                  state.selectedIds.length === 0) ||
                (state.step === 5 &&
                  state.createCitizenMemories &&
                  state.memoryText.trim().length === 0)
              }
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {state.step >= 6 && (
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
                (state.createCitizenMemories &&
                  state.memoryText.trim().length === 0)
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
