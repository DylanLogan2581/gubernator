import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Heart, Skull } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  markCitizenDeadMutationOptions,
  reviveCitizenMutationOptions,
} from "../../mutations/citizensMutations";

import type { Citizen } from "../../types/citizenTypes";

export function CitizenLifecycleSection({
  citizen,
  isArchived,
  queryClient,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isMarkingDead, setIsMarkingDead] = useState(false);
  const [deathCause, setDeathCause] = useState("");

  const markDeadMutation = useMutation(
    markCitizenDeadMutationOptions({ queryClient }),
  );
  const reviveMutation = useMutation(
    reviveCitizenMutationOptions({ queryClient }),
  );

  function handleMarkDead(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    markDeadMutation.reset();
    markDeadMutation.mutate(
      {
        citizenId: citizen.id,
        deathCause,
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update citizen.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Citizen marked as deceased.");
          setIsMarkingDead(false);
          setDeathCause("");
        },
      },
    );
  }

  function handleRevive(): void {
    reviveMutation.reset();
    reviveMutation.mutate(
      {
        citizenId: citizen.id,
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update citizen.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Citizen revived.");
        },
      },
    );
  }

  return (
    <Card
      aria-labelledby="citizen-lifecycle-heading"
      className="grid gap-3 p-4"
    >
      <div className="space-y-1">
        <h2 id="citizen-lifecycle-heading" className="text-base font-medium">
          Lifecycle
        </h2>
        <p className="text-sm text-muted-foreground">
          {citizen.status === "alive"
            ? "Mark this citizen dead if they have died in the world."
            : citizen.deathCause === null
              ? "This citizen is deceased."
              : `Cause of death: ${citizen.deathCause}`}
        </p>
      </div>
      {citizen.status === "alive" ? (
        isMarkingDead ? (
          <form className="grid gap-2" noValidate onSubmit={handleMarkDead}>
            <div className="grid gap-1 text-sm">
              <Label>Cause of death (optional)</Label>
              <Input
                disabled={markDeadMutation.isPending || isArchived}
                value={deathCause}
                onChange={(event) => setDeathCause(event.currentTarget.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="destructive"
                disabled={markDeadMutation.isPending || isArchived}
              >
                <Skull aria-hidden="true" />
                {markDeadMutation.isPending ? "Marking…" : "Mark dead"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsMarkingDead(false);
                  setDeathCause("");
                  markDeadMutation.reset();
                }}
                disabled={markDeadMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsMarkingDead(true)}
              disabled={isArchived}
              title={
                isArchived
                  ? "Cannot modify citizens in an archived world."
                  : undefined
              }
            >
              <Skull aria-hidden="true" />
              Mark dead
            </Button>
          </div>
        )
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevive}
            disabled={reviveMutation.isPending || isArchived}
            title={
              isArchived
                ? "Cannot modify citizens in an archived world."
                : undefined
            }
          >
            <Heart aria-hidden="true" />
            {reviveMutation.isPending ? "Reviving…" : "Revive citizen"}
          </Button>
        </div>
      )}
    </Card>
  );
}
