import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { jobByIdQueryOptions } from "@/features/jobs";
import { managedPopulationTypeByIdQueryOptions } from "@/features/managed-populations";
import { nationByIdQueryOptions } from "@/features/nations";
import { resourceByIdQueryOptions } from "@/features/resources";
import { settlementByIdQueryOptions } from "@/features/settlements";

import {
  cancelEventMutationOptions,
  isEventMutationError,
} from "../mutations/eventMutations";
import {
  eventDetailQueryOptions,
  isEventsError,
} from "../queries/eventQueries";

import type { EventEffect } from "../types/eventTypes";

type EventDetailProps = {
  readonly worldId: string;
  readonly eventId: string;
  readonly canCancel: boolean;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export function EventDetail({
  worldId,
  eventId,
  canCancel,
}: EventDetailProps): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const eventQuery = useQuery(eventDetailQueryOptions(worldId, eventId));
  const cancelMutation = useMutation(
    cancelEventMutationOptions({ queryClient }),
  );

  if (eventQuery.isPending) {
    return <LoadingState label="Loading event…" />;
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
    return (
      <ErrorState title="Failed to load event" description="Please try again" />
    );
  }

  const event = eventQuery.data;

  const handleCancel = async (): Promise<void> => {
    try {
      await cancelMutation.mutateAsync({
        eventId: event.id,
        worldId,
      });
      toast.success("Event cancelled");
      setShowCancelDialog(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
      await (navigate as any)({ to: `/worlds/${worldId}/events` });
    } catch (error) {
      if (isEventMutationError(error)) {
        toast.error(error.message);
      } else {
        toast.error("Failed to cancel event");
      }
    }
  };

  const canCancelEvent =
    canCancel && event.status !== "cancelled" && event.status !== "expired";

  const progressPercent =
    event.duration_type === "sustained" && event.duration_transitions !== null
      ? ((event.duration_transitions - (event.remaining_transitions ?? 0)) /
          event.duration_transitions) *
        100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            return (navigate as any)({
              to: "/worlds/$worldId/events/",
              params: { worldId },
            });
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back to events</span>
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{event.name}</h1>
              {event.description !== null ? (
                <p className="mt-2 text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
            </div>
            <Badge className={statusColors[event.status]}>{event.status}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Scope
              </p>
              <ScopeDisplay
                scopeType={event.scope_type}
                scopeNationId={event.scope_nation_id}
                scopeSettlementId={event.scope_settlement_id}
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Effect Type
              </p>
              <p className="mt-1 font-medium">{event.effect_type}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Duration
              </p>
              <p className="mt-1 font-medium">
                {event.duration_type === "sustained"
                  ? `Sustained (${event.remaining_transitions}/${event.duration_transitions} turns)`
                  : "Instant"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Activation Turn
              </p>
              <p className="mt-1 font-medium">
                After turn {event.activate_on_transition_after_turn_number}
              </p>
            </div>
          </div>

          {event.duration_type === "sustained" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Progress
              </p>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {event.remaining_transitions} of {event.duration_transitions}{" "}
                transitions remaining
              </p>
            </div>
          )}

          {event.memory_text !== null ? (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Memory Text
              </p>
              <p className="text-sm">{event.memory_text}</p>
            </div>
          ) : null}

          {event.effects.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Effects
              </p>
              <div className="space-y-2">
                {event.effects.map((effect) => (
                  <EffectItem key={effect.id} effect={effect} />
                ))}
              </div>
            </div>
          )}

          {canCancelEvent && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel event
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel event?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the event "{event.name}". This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleCancel();
              }}
              disabled={cancelMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel event"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type ScopeDisplayProps = {
  readonly scopeType: string;
  readonly scopeNationId: string | null;
  readonly scopeSettlementId: string | null;
};

function ScopeDisplay({
  scopeType,
  scopeNationId,
  scopeSettlementId,
}: ScopeDisplayProps): JSX.Element {
  if (scopeType === "world") {
    return <p className="mt-1 font-medium capitalize">World</p>;
  }

  if (scopeType === "nation" && scopeNationId !== null) {
    return <ScopeNationDisplay nationId={scopeNationId} />;
  }

  if (scopeType === "settlement" && scopeSettlementId !== null) {
    return <ScopeSettlementDisplay settlementId={scopeSettlementId} />;
  }

  return <p className="mt-1 font-medium capitalize">{scopeType}</p>;
}

function ScopeNationDisplay({
  nationId,
}: {
  readonly nationId: string;
}): JSX.Element {
  const query = useQuery(nationByIdQueryOptions(nationId));

  if (query.isPending) {
    return <p className="mt-1 text-muted-foreground text-sm">Loading…</p>;
  }

  if (query.isError || query.data === null) {
    return <p className="mt-1 font-medium">Nation (unknown)</p>;
  }

  return <p className="mt-1 font-medium">Nation: {query.data.name}</p>;
}

function ScopeSettlementDisplay({
  settlementId,
}: {
  readonly settlementId: string;
}): JSX.Element {
  const query = useQuery(settlementByIdQueryOptions(settlementId));

  if (query.isPending) {
    return <p className="mt-1 text-muted-foreground text-sm">Loading…</p>;
  }

  if (query.isError || query.data === null) {
    return <p className="mt-1 font-medium">Settlement (unknown)</p>;
  }

  return <p className="mt-1 font-medium">Settlement: {query.data.name}</p>;
}

type EffectItemProps = {
  readonly effect: EventEffect;
};

function EffectItem({ effect }: EffectItemProps): JSX.Element {
  return (
    <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium capitalize">
          {effect.effect_type.replace(/_/g, " ")}
        </p>
      </div>
      <EffectTargets effect={effect} />
    </div>
  );
}

function EffectTargets({
  effect,
}: {
  readonly effect: EventEffect;
}): JSX.Element {
  const targets: JSX.Element[] = [];

  if (effect.amount_value !== null) {
    targets.push(
      <div key="amount">
        <span className="text-muted-foreground">Amount: </span>
        <span>{effect.amount_value}</span>
        {effect.is_percent ? <span>%</span> : null}
      </div>,
    );
  }

  if (effect.multiplier_value !== null) {
    targets.push(
      <div key="multiplier">
        <span className="text-muted-foreground">Multiplier: </span>
        <span>{effect.multiplier_value}</span>
        {effect.is_percent ? <span>%</span> : null}
      </div>,
    );
  }

  if (effect.resource_id !== null) {
    targets.push(
      <ResourceTarget key="resource" resourceId={effect.resource_id} />,
    );
  }

  if (effect.job_id !== null) {
    targets.push(<JobTarget key="job" jobId={effect.job_id} />);
  }

  if (effect.managed_population_type_id !== null) {
    targets.push(
      <ManagedPopulationTypeTarget
        key="managed-pop-type"
        managedPopulationTypeId={effect.managed_population_type_id}
      />,
    );
  }

  if (effect.settlement_building_id !== null) {
    targets.push(
      <div key="building">
        <span className="text-muted-foreground">Building: </span>
        <span>{effect.settlement_building_id}</span>
      </div>,
    );
  }

  if (effect.deposit_instance_id !== null) {
    targets.push(
      <div key="deposit">
        <span className="text-muted-foreground">Deposit: </span>
        <span>{effect.deposit_instance_id}</span>
      </div>,
    );
  }

  if (targets.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">No additional targets</p>
    );
  }

  return <div className="space-y-1 text-muted-foreground">{targets}</div>;
}

function ResourceTarget({
  resourceId,
}: {
  readonly resourceId: string;
}): JSX.Element {
  const query = useQuery(resourceByIdQueryOptions(resourceId));

  if (query.isPending) {
    return (
      <div>
        <span className="text-muted-foreground">Resource: </span>
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (query.isError || query.data === null) {
    return (
      <div>
        <span className="text-muted-foreground">Resource: </span>
        <span>unknown</span>
      </div>
    );
  }

  return (
    <div>
      <span className="text-muted-foreground">Resource: </span>
      <span>{query.data.name}</span>
    </div>
  );
}

function JobTarget({ jobId }: { readonly jobId: string }): JSX.Element {
  const query = useQuery(jobByIdQueryOptions(jobId));

  if (query.isPending) {
    return (
      <div>
        <span className="text-muted-foreground">Job: </span>
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (query.isError || query.data === null) {
    return (
      <div>
        <span className="text-muted-foreground">Job: </span>
        <span>unknown</span>
      </div>
    );
  }

  return (
    <div>
      <span className="text-muted-foreground">Job: </span>
      <span>{query.data.name}</span>
    </div>
  );
}

function ManagedPopulationTypeTarget({
  managedPopulationTypeId,
}: {
  readonly managedPopulationTypeId: string;
}): JSX.Element {
  const query = useQuery(
    managedPopulationTypeByIdQueryOptions(managedPopulationTypeId),
  );

  if (query.isPending) {
    return (
      <div>
        <span className="text-muted-foreground">Population Type: </span>
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (query.isError || query.data === null) {
    return (
      <div>
        <span className="text-muted-foreground">Population Type: </span>
        <span>unknown</span>
      </div>
    );
  }

  return (
    <div>
      <span className="text-muted-foreground">Population Type: </span>
      <span>{query.data.name}</span>
    </div>
  );
}
