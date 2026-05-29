import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Heart, Skull } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  markCitizenDeadMutationOptions,
  reviveCitizenMutationOptions,
} from "../../mutations/citizensMutations";

import { getCitizenMutationErrorDescription } from "./ErrorMessages";

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
        onSuccess: () => {
          setIsMarkingDead(false);
          setDeathCause("");
        },
      },
    );
  }

  function handleRevive(): void {
    reviveMutation.reset();
    reviveMutation.mutate({
      citizenId: citizen.id,
      worldId: citizen.worldId,
    });
  }

  const firstError = markDeadMutation.error ?? reviveMutation.error ?? null;

  return (
    <section
      aria-labelledby="citizen-lifecycle-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
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
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Cause of death (optional)
              </span>
              <Input
                disabled={markDeadMutation.isPending || isArchived}
                value={deathCause}
                onChange={(event) => setDeathCause(event.currentTarget.value)}
              />
            </label>
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
      {firstError !== null ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getCitizenMutationErrorDescription(firstError)}
        </p>
      ) : null}
    </section>
  );
}
