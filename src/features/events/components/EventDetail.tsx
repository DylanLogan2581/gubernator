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

import {
  cancelEventMutationOptions,
  isEventMutationError,
} from "../mutations/eventMutations";
import { eventDetailQueryOptions, isEventsError } from "../queries/eventQueries";

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
  const cancelMutation = useMutation(cancelEventMutationOptions({ queryClient }));

  if (eventQuery.isPending) {
    return <LoadingState label="Loading event…" />;
  }

  if (eventQuery.isError) {
    if (isEventsError(eventQuery.error)) {
      return <ErrorState title="Event error" description={eventQuery.error.message} />;
    }
    return <ErrorState title="Failed to load event" description="Please try again" />;
  }

  const event = eventQuery.data;

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({
        eventId: event.id,
        worldId,
      });
      toast.success("Event cancelled");
      setShowCancelDialog(false);
      navigate({ to: `/worlds/${worldId}/events` });
    } catch (error) {
      if (isEventMutationError(error)) {
        toast.error(error.message);
      } else {
        toast.error("Failed to cancel event");
      }
    }
  };

  const canCancelEvent =
    canCancel &&
    event.status !== "cancelled" &&
    event.status !== "expired";

  const progressPercent =
    event.duration_type === "sustained" && event.duration_transitions
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
          onClick={() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigate as any)({
              to: "/worlds/$worldId/events/",
              params: { worldId },
            })
          }
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
              {event.description && (
                <p className="mt-2 text-muted-foreground">{event.description}</p>
              )}
            </div>
            <Badge className={statusColors[event.status]}>
              {event.status}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Scope
              </p>
              <p className="mt-1 font-medium capitalize">{event.scope_type}</p>
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
                {event.remaining_transitions} of {event.duration_transitions} transitions remaining
              </p>
            </div>
          )}

          {event.memory_text && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Memory Text
              </p>
              <p className="text-sm">{event.memory_text}</p>
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
              This will cancel the event "{event.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
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
