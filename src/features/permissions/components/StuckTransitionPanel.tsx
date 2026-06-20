import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState, type ChangeEvent, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { failStuckTransitionMutationOptions } from "../mutations/superadminMutations";
import { runningTransitionsQueryOptions } from "../queries/superadminQueries";

import type { SuperadminRunningTransition } from "../types/superadminTypes";

type RecoverState = {
  readonly transition: SuperadminRunningTransition;
  readonly reason: string;
  readonly open: boolean;
};

export function StuckTransitionPanel(): JSX.Element {
  const queryClient = useQueryClient();
  const transitionsQuery = useQuery(runningTransitionsQueryOptions());
  const recoverMutation = useMutation(
    failStuckTransitionMutationOptions({ queryClient }),
  );

  const [recoverState, setRecoverState] = useState<RecoverState | null>(null);

  const transitions = transitionsQuery.data ?? [];

  function openRecover(transition: SuperadminRunningTransition): void {
    setRecoverState({ transition, reason: "", open: true });
  }

  function handleReasonChange(e: ChangeEvent<HTMLInputElement>): void {
    if (recoverState === null) return;
    setRecoverState({ ...recoverState, reason: e.target.value });
  }

  function handleConfirmRecover(): void {
    if (recoverState === null) return;
    const { transition, reason } = recoverState;
    recoverMutation.mutate(
      {
        worldId: transition.world_id,
        transitionId: transition.id,
        reason: reason.trim() !== "" ? reason.trim() : undefined,
      },
      {
        onSuccess: () => {
          setRecoverState(null);
          notifyMutationSuccess(
            "Transition marked failed. World can now end turn.",
          );
        },
        onError: (error) => {
          setRecoverState(null);
          notifyMutationError(error, "Recovery failed");
        },
      },
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
        <h2 className="text-base font-semibold">Stuck Transitions</h2>
        {transitions.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {transitions.length}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Turn transitions wedged in{" "}
        <span className="font-mono text-xs">running</span> status. Recovering
        marks the transition failed and unlocks the world for a fresh end-turn.
        Superadmin only.
      </p>

      <div className="mt-4">
        {transitionsQuery.isPending && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {transitionsQuery.isError && (
          <p className="text-sm text-destructive">
            Could not load running transitions.
          </p>
        )}
        {!transitionsQuery.isPending && transitions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No transitions currently stuck in running status.
          </p>
        )}
        {transitions.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-2">World</TableHead>
                  <TableHead className="px-4 py-2">Turns</TableHead>
                  <TableHead className="px-4 py-2">Started</TableHead>
                  <TableHead className="px-4 py-2 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitions.map((t) => (
                  <TransitionRow
                    key={t.id}
                    transition={t}
                    onRecover={openRecover}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {recoverState !== null && (
        <ConfirmDialog
          open={recoverState.open}
          onOpenChange={(open) => {
            if (!open) setRecoverState(null);
          }}
          title="Recover stuck transition?"
          description={
            <span>
              <p>
                This marks transition{" "}
                <span className="font-mono text-xs">
                  {recoverState.transition.id.slice(0, 8)}…
                </span>{" "}
                as <strong>failed</strong> and unlocks the world for a fresh
                end-turn. This cannot be undone.
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <Label htmlFor="recover-reason">
                  Recovery reason (optional)
                </Label>
                <Input
                  id="recover-reason"
                  type="text"
                  value={recoverState.reason}
                  onChange={handleReasonChange}
                  placeholder="e.g. pre-apply validation bug fixed"
                  className="text-sm"
                />
              </div>
            </span>
          }
          confirmLabel="Recover"
          confirmVariant="destructive"
          isPending={recoverMutation.isPending}
          onConfirm={handleConfirmRecover}
        />
      )}
    </div>
  );
}

type TransitionRowProps = {
  readonly transition: SuperadminRunningTransition;
  readonly onRecover: (transition: SuperadminRunningTransition) => void;
};

function TransitionRow({
  transition,
  onRecover,
}: TransitionRowProps): JSX.Element {
  const startedAtLabel = transition.started_at.slice(0, 16).replace("T", " ");

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="px-4 py-2 font-mono text-xs">
        {transition.world_id.slice(0, 8)}…
      </TableCell>
      <TableCell className="px-4 py-2 text-xs">
        {transition.from_turn_number.toString()} →{" "}
        {transition.to_turn_number.toString()}
      </TableCell>
      <TableCell className="px-4 py-2 text-xs text-muted-foreground">
        {startedAtLabel}
      </TableCell>
      <TableCell className="px-4 py-2 text-right">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => {
            onRecover(transition);
          }}
        >
          Recover
        </Button>
      </TableCell>
    </TableRow>
  );
}
