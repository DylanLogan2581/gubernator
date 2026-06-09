import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  proposeBilateralMutationOptions,
  respondToBilateralMutationOptions,
  setUnilateralStanceMutationOptions,
  withdrawFromBilateralMutationOptions,
} from "../../mutations/nationRelationshipMutations";

import { getRelationshipMutationErrorDescription } from "./ErrorMessages";

import type {
  NationRelationship,
  NationUnilateralStance,
} from "../../types/nationRelationshipTypes";
import type { Nation } from "../../types/nationTypes";

function formatRelationshipStance(stance: string): string {
  switch (stance) {
    case "neutral":
      return "Neutral";
    case "friendly":
      return "Friendly";
    case "hostile":
      return "Hostile";
    case "at_war":
      return "At war";
    case "allied":
      return "Allied";
    case "non_aggression_pact":
      return "Non-aggression pact";
    default:
      return stance;
  }
}

export function NationRelationshipRow({
  canControl,
  incoming,
  nation,
  other,
  outgoing,
  queryClient,
}: {
  readonly canControl: boolean;
  readonly incoming: NationRelationship | null;
  readonly nation: Nation;
  readonly other: Nation;
  readonly outgoing: NationRelationship | null;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [pendingUnilateralStance, setPendingUnilateralStance] =
    useState<NationUnilateralStance | null>(null);
  const setUnilateral = useMutation(
    setUnilateralStanceMutationOptions({ queryClient }),
  );
  const proposeBilateral = useMutation(
    proposeBilateralMutationOptions({ queryClient }),
  );
  const respondToBilateral = useMutation(
    respondToBilateralMutationOptions({ queryClient }),
  );
  const withdrawFromBilateral = useMutation(
    withdrawFromBilateralMutationOptions({ queryClient }),
  );

  const currentStance = outgoing?.currentStance ?? "neutral";
  const outgoingPending =
    outgoing !== null &&
    outgoing.pendingStance !== null &&
    outgoing.pendingStatus === "proposed"
      ? {
          stance: outgoing.pendingStance,
          status: outgoing.pendingStatus,
        }
      : null;
  const incomingProposal =
    incoming !== null &&
    incoming.pendingStance !== null &&
    incoming.pendingStatus === "proposed"
      ? {
          stance: incoming.pendingStance,
        }
      : null;
  const isBilateral =
    currentStance === "allied" || currentStance === "non_aggression_pact";

  const anyPending =
    setUnilateral.isPending ||
    proposeBilateral.isPending ||
    respondToBilateral.isPending ||
    withdrawFromBilateral.isPending;

  function notifyStanceSuccess(): void {
    notifyMutationSuccess(`Stance toward ${other.name} updated.`);
  }

  function notifyStanceError(error: unknown): void {
    toast.error(getRelationshipMutationErrorDescription(error));
  }

  return (
    <li className="grid gap-3 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{other.name}</span>
        <span className="text-xs text-muted-foreground">
          Current stance:{" "}
          <span className="font-medium text-foreground">
            {formatRelationshipStance(currentStance)}
          </span>
        </span>
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        {outgoingPending !== null ? (
          <p>
            <span className="font-medium text-foreground">Sent proposal:</span>{" "}
            {formatRelationshipStance(outgoingPending.stance)} — awaiting{" "}
            {other.name}.
          </p>
        ) : null}
        {incomingProposal !== null ? (
          <p>
            <span className="font-medium text-foreground">
              Incoming proposal:
            </span>{" "}
            {other.name} proposes{" "}
            {formatRelationshipStance(incomingProposal.stance)} — awaiting{" "}
            {nation.name}.
          </p>
        ) : null}
        {outgoingPending === null && incomingProposal === null ? (
          <p className="italic">No pending proposals.</p>
        ) : null}
      </div>
      {canControl ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              className="text-xs text-muted-foreground"
              htmlFor={`unilateral-${other.id}`}
            >
              Set stance
            </Label>
            <NativeSelect
              id={`unilateral-${other.id}`}
              className="h-8 px-2 text-xs md:text-xs"
              disabled={anyPending}
              value={isBilateral ? "neutral" : currentStance}
              onChange={(event) => {
                const stance = event.currentTarget
                  .value as NationUnilateralStance;
                if (isBilateral) {
                  setPendingUnilateralStance(stance);
                  return;
                }
                setUnilateral.reset();
                setUnilateral.mutate(
                  {
                    fromNationId: nation.id,
                    stance,
                    toNationId: other.id,
                    worldId: nation.worldId,
                  },
                  {
                    onError: notifyStanceError,
                    onSuccess: notifyStanceSuccess,
                  },
                );
              }}
            >
              <option value="neutral">Neutral</option>
              <option value="friendly">Friendly</option>
              <option value="hostile">Hostile</option>
              <option value="at_war">At war</option>
            </NativeSelect>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isBilateral && outgoingPending === null ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    proposeBilateral.reset();
                    proposeBilateral.mutate(
                      {
                        fromNationId: nation.id,
                        stance: "allied",
                        toNationId: other.id,
                        worldId: nation.worldId,
                      },
                      {
                        onError: notifyStanceError,
                        onSuccess: notifyStanceSuccess,
                      },
                    );
                  }}
                >
                  Propose alliance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    proposeBilateral.reset();
                    proposeBilateral.mutate(
                      {
                        fromNationId: nation.id,
                        stance: "non_aggression_pact",
                        toNationId: other.id,
                        worldId: nation.worldId,
                      },
                      {
                        onError: notifyStanceError,
                        onSuccess: notifyStanceSuccess,
                      },
                    );
                  }}
                >
                  Propose non-aggression pact
                </Button>
              </>
            ) : null}
            {isBilateral ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={anyPending}
                onClick={() => {
                  withdrawFromBilateral.reset();
                  withdrawFromBilateral.mutate(
                    {
                      fromNationId: nation.id,
                      toNationId: other.id,
                    },
                    {
                      onError: notifyStanceError,
                      onSuccess: notifyStanceSuccess,
                    },
                  );
                }}
              >
                Withdraw agreement
              </Button>
            ) : null}
            {incomingProposal !== null ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    respondToBilateral.reset();
                    respondToBilateral.mutate(
                      {
                        fromNationId: other.id,
                        response: "accepted",
                        toNationId: nation.id,
                      },
                      {
                        onError: notifyStanceError,
                        onSuccess: notifyStanceSuccess,
                      },
                    );
                  }}
                >
                  Accept proposal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    respondToBilateral.reset();
                    respondToBilateral.mutate(
                      {
                        fromNationId: other.id,
                        response: "declined",
                        toNationId: nation.id,
                      },
                      {
                        onError: notifyStanceError,
                        onSuccess: notifyStanceSuccess,
                      },
                    );
                  }}
                >
                  Decline proposal
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {pendingUnilateralStance !== null ? (
        <BilateralOverrideConfirmDialog
          currentStance={currentStance}
          isPending={setUnilateral.isPending}
          otherName={other.name}
          targetStance={pendingUnilateralStance}
          onCancel={() => {
            setPendingUnilateralStance(null);
            setUnilateral.reset();
          }}
          onConfirm={() => {
            setUnilateral.reset();
            setUnilateral.mutate(
              {
                fromNationId: nation.id,
                stance: pendingUnilateralStance,
                toNationId: other.id,
                worldId: nation.worldId,
              },
              {
                onError: notifyStanceError,
                onSettled: () => {
                  setPendingUnilateralStance(null);
                },
                onSuccess: notifyStanceSuccess,
              },
            );
          }}
        />
      ) : null}
    </li>
  );
}

function BilateralOverrideConfirmDialog({
  currentStance,
  isPending,
  otherName,
  targetStance,
  onCancel,
  onConfirm,
}: {
  readonly currentStance: string;
  readonly isPending: boolean;
  readonly otherName: string;
  readonly targetStance: NationUnilateralStance;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="bilateral-override-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="bilateral-override-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Dissolve {formatRelationshipStance(currentStance).toLowerCase()}?
          </h3>
          <p className="text-sm text-muted-foreground">
            Setting a unilateral stance of{" "}
            <span className="font-medium">
              {formatRelationshipStance(targetStance)}
            </span>{" "}
            will dissolve the existing{" "}
            <span className="font-medium">
              {formatRelationshipStance(currentStance).toLowerCase()}
            </span>{" "}
            with <span className="font-medium">{otherName}</span>. Use{" "}
            <span className="font-medium">Withdraw agreement</span> to leave the
            bilateral relationship through the normal path.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending
              ? "Applying…"
              : `Set ${formatRelationshipStance(targetStance).toLowerCase()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
