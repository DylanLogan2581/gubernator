import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  currentAccessContextQueryOptions,
  type AccessContext,
} from "@/features/permissions";

import {
  eventDetailQueryOptions,
  isEventsError,
} from "../queries/eventQueries";

import { EventCreateWizard } from "./EventCreateWizard";

import type { JSX } from "react";

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

type EventEditPageProps = {
  readonly worldId: string;
  readonly eventId: string;
};

export function EventEditPage({
  worldId,
  eventId,
}: EventEditPageProps): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const eventQuery = useQuery(eventDetailQueryOptions(worldId, eventId));

  const handleClose = (): void => {
    void navigate({
      to: "/worlds/$worldId/events/$eventId",
      params: { worldId, eventId },
    });
  };

  if (accessContextQuery.isPending || eventQuery.isPending) {
    return <LoadingState label="Loading event…" />;
  }

  if (accessContextQuery.isError) {
    return <ErrorState title="Failed to load" description="Please try again" />;
  }

  if (eventQuery.isError) {
    if (isEventsError(eventQuery.error)) {
      return (
        <ErrorState
          title="Event error"
          description={eventQuery.error.message}
        />
      );
    }
    return <ErrorState title="Failed to load event" description="Try again" />;
  }

  const accessContext: AccessContext = accessContextQuery.data;
  const event = eventQuery.data;

  if (event.event_group_id === null) {
    return (
      <ErrorState
        title="Cannot edit"
        description="Event is not part of a group"
      />
    );
  }

  // Build EditEventData from event and effects
  const editEventData: EditEventData = {
    groupId: event.event_group_id,
    groupName: event.group?.name ?? "",
    groupDescription: event.group?.description ?? null,
    scopeType: event.scope_type,
    durationType: event.duration_type,
    durationTransitions: event.duration_transitions,
    activationTurn: event.activate_on_transition_after_turn_number,
    createCitizenMemories: event.create_citizen_memories,
    memoryText: event.memory_text,
    effects: event.effects.map((e) => ({
      effectType: e.effect_type,
      isPercent: e.is_percent,
      amountValue: e.amount_value,
      multiplierValue: e.multiplier_value,
      resourceId: e.resource_id,
      jobId: e.job_id,
      managedPopulationInstanceId: e.managed_population_instance_id,
      managedPopulationTypeId: e.managed_population_type_id,
      depositInstanceId: e.deposit_instance_id,
      settlementBuildingId: e.settlement_building_id,
      extraDataJsonb: e.extra_data_jsonb,
    })),
  };

  return (
    <EventCreateWizard
      accessContext={accessContext}
      worldId={worldId}
      onClose={handleClose}
      isEditMode
      editGroupId={event.event_group_id}
      editEventData={editEventData}
    />
  );
}
