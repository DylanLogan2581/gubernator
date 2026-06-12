import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AccessContext } from "@/features/permissions";
import { worldRouteAccessQueryOptions } from "@/features/worlds";

import {
  createEventGroupMutationOptions,
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

type EventCreateWizardProps = {
  readonly accessContext: AccessContext;
  readonly worldId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
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
    jobId: number | null;
    managedPopulationInstanceId: string | null;
    depositInstanceId: string | null;
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
  open,
  onOpenChange,
}: EventCreateWizardProps): JSX.Element {
  const queryClient = useQueryClient();
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  const nextTurnNumber = worldQuery.data?.world.nextTurnNumber ?? 1;
  const [state, setState] = useState<EventCreateWizardState>(() =>
    createInitialState(nextTurnNumber),
  );
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  // Update activation turn when world data changes and state hasn't been customized
  useEffect(() => {
    if (open && nextTurnNumber > 1 && state.activationTurn === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect
      setState((prev) => ({
        ...prev,
        activationTurn: nextTurnNumber,
      }));
    }
  }, [nextTurnNumber, open, state.activationTurn]);

  const createMutation = useMutation(
    createEventGroupMutationOptions({
      queryClient,
    }),
  );

  const handleNext = (): void => {
    setState((prev) => ({
      ...prev,
      step: Math.min(6, prev.step + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    }));
  };

  const handlePrev = (): void => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as 1 | 2 | 3 | 4 | 5 | 6,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    if (state.scopeType === null || state.effects.length === 0) return;
    try {
      // Build targets array based on scope and selected IDs
      const targets = state.selectedIds.map((id) => ({
        scope_id: state.scopeType === "world" ? null : id,
        nation_id: state.scopeType === "nation" ? id : null,
        settlement_id: state.scopeType === "settlement" ? id : null,
        scope_name:
          state.scopeType === "world"
            ? "World"
            : state.scopeType === "nation"
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
        effects: state.effects.map((e) => ({
          effectType:
            e.effectType as CreateEventGroupInput["effects"][number]["effectType"],
          isPercent: e.isPercent,
          amountValue: e.amountValue,
          multiplierValue: e.multiplierValue,
          resourceId: e.resourceId,
          jobId: e.jobId,
          managedPopulationInstanceId: e.managedPopulationInstanceId,
          depositInstanceId: e.depositInstanceId,
        })),
        scopeType: state.scopeType,
        targets,
        durationType: state.durationType,
        durationTransitions:
          state.durationType === "sustained" ? state.durationTransitions : null,
        activationTurn: state.activationTurn,
        createCitizenMemories: state.createCitizenMemories,
        memoryText: state.createCitizenMemories ? state.memoryText : null,
      };

      await createMutation.mutateAsync(input);

      toast.success("Event created successfully");
      onOpenChange(false);
      setState(createInitialState(nextTurnNumber));
      setGroupName("");
      setGroupDescription("");
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.byWorld(worldId),
      });
    } catch (error) {
      if (isEventMutationError(error)) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create event");
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-md sm:w-full">
        <SheetHeader>
          <SheetTitle>Create Event</SheetTitle>
          <SheetDescription>Step {state.step} of 6</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          {state.step === 1 && (
            <EventCreateNameDescriptionStep
              groupName={groupName}
              groupDescription={groupDescription}
              onGroupNameChange={setGroupName}
              onGroupDescriptionChange={setGroupDescription}
            />
          )}

          {state.step === 2 && (
            <div className="space-y-6">
              <EventCreateStep1
                scopeType={state.scopeType}
                onScopeTypeChange={(scopeType) => {
                  setState((prev) => ({
                    ...prev,
                    scopeType,
                    selectedIds: [],
                  }));
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
              }}
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
              }}
              onDurationTransitionsChange={(trans) => {
                setState((prev) => ({
                  ...prev,
                  durationTransitions: trans,
                }));
              }}
              onActivationTurnChange={(turn) => {
                setState((prev) => ({
                  ...prev,
                  activationTurn: turn,
                }));
              }}
            />
          )}

          {state.step === 5 && (
            <EventCreateStep4
              createCitizenMemories={state.createCitizenMemories}
              memoryText={state.memoryText}
              groupDescription={groupDescription}
              onCreateCitizenMemoriesChange={(create) => {
                setState((prev) => ({
                  ...prev,
                  createCitizenMemories: create,
                }));
              }}
              onMemoryTextChange={(text) => {
                setState((prev) => ({
                  ...prev,
                  memoryText: text,
                }));
              }}
            />
          )}

          {state.step === 6 && (
            <EventCreateStep5
              groupName={groupName}
              groupDescription={groupDescription}
              scopeType={state.scopeType ?? "world"}
              effects={state.effects}
              durationType={state.durationType}
              durationTransitions={state.durationTransitions}
              activationTurn={state.activationTurn}
              createCitizenMemories={state.createCitizenMemories}
            />
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={state.step === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {state.step < 6 && (
              <Button
                onClick={handleNext}
                className="ml-auto"
                disabled={
                  (state.step === 1 && groupName.trim().length === 0) ||
                  (state.step === 2 && state.scopeType === null) ||
                  (state.step === 2 &&
                    state.scopeType !== "world" &&
                    state.selectedIds.length === 0) ||
                  (state.step === 3 && state.effects.length === 0)
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
                  createMutation.isPending ||
                  state.scopeType === null ||
                  (state.scopeType !== "world" &&
                    state.selectedIds.length === 0)
                }
                className="ml-auto"
              >
                {createMutation.isPending ? "Creating…" : "Create Event"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
