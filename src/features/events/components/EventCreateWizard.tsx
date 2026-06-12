import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  createEventGroupMutationOptions,
  isEventMutationError,
} from "../mutations/eventMutations";
import { eventQueryKeys } from "../queries/eventQueryKeys";


import { EventCreateStep1 } from "./steps/EventCreateStep1";
import { EventCreateStep2 } from "./steps/EventCreateStep2";
import { EventCreateStep3 } from "./steps/EventCreateStep3";
import { EventCreateStep4 } from "./steps/EventCreateStep4";
import { EventCreateStep5 } from "./steps/EventCreateStep5";

import type { CreateEventGroupInput } from "../schemas/eventSchemas";

type EventCreateWizardProps = {
  readonly worldId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export type EventCreateWizardState = {
  step: 1 | 2 | 3 | 4 | 5;
  scopeType: "world" | "nation" | "settlement" | null;
  selectedIds: string[]; // nation or settlement IDs
  effectType: string;
  durationType: "instant" | "sustained";
  durationTransitions: number | null;
  activationTurn: number;
  createCitizenMemories: boolean;
  memoryText: string;
};

const initialState: EventCreateWizardState = {
  step: 1,
  scopeType: null,
  selectedIds: [],
  effectType: "",
  durationType: "instant",
  durationTransitions: null,
  activationTurn: 0,
  createCitizenMemories: false,
  memoryText: "",
};

export function EventCreateWizard({
  worldId,
  open,
  onOpenChange,
}: EventCreateWizardProps): JSX.Element {
  const queryClient = useQueryClient();
  const [state, setState] = useState<EventCreateWizardState>(initialState);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  const createMutation = useMutation(
    createEventGroupMutationOptions({
      queryClient,
    }),
  );

  const handleNext = () => {
    setState((prev) => ({
      ...prev,
      step: Math.min(5, prev.step + 1) as 1 | 2 | 3 | 4 | 5,
    }));
  };

  const handlePrev = () => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as 1 | 2 | 3 | 4 | 5,
    }));
  };

  const handleSubmit = async () => {
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
        effectType: state.effectType,
        scopeType: state.scopeType!,
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
      setState(initialState);
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
          <SheetDescription>Step {state.step} of 5</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {state.step === 1 && (
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
          )}

          {state.step === 2 && (
            <EventCreateStep2
              worldId={worldId}
              scopeType={state.scopeType}
              selectedIds={state.selectedIds}
              effectType={state.effectType}
              onSelectedIdsChange={(ids) => {
                setState((prev) => ({
                  ...prev,
                  selectedIds: ids,
                }));
              }}
              onEffectTypeChange={(type) => {
                setState((prev) => ({
                  ...prev,
                  effectType: type,
                }));
              }}
            />
          )}

          {state.step === 3 && (
            <EventCreateStep3
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

          {state.step === 4 && (
            <EventCreateStep4
              createCitizenMemories={state.createCitizenMemories}
              memoryText={state.memoryText}
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

          {state.step === 5 && (
            <EventCreateStep5
              groupName={groupName}
              groupDescription={groupDescription}
              scopeType={state.scopeType!}
              effectType={state.effectType}
              durationType={state.durationType}
              durationTransitions={state.durationTransitions}
              activationTurn={state.activationTurn}
              createCitizenMemories={state.createCitizenMemories}
              onGroupNameChange={setGroupName}
              onGroupDescriptionChange={setGroupDescription}
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

            {state.step < 5 ? (
              <Button onClick={handleNext} className="ml-auto">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !groupName.trim()}
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
