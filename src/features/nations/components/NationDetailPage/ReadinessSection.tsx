import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useActivePlayerCharacter } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError } from "@/lib/notify";
import { GOVERNMENT_RULES } from "@/shared/government";

import { castNationReadinessVoteMutationOptions } from "../../mutations/nationReadinessVoteMutations";
import { nationReadinessVotersQueryOptions } from "../../queries/nationReadinessVotersQueries";
import { getReadinessVoterLabel } from "../../utils/nationReadinessSummary";

import type { NationReadinessVoter } from "../../types/nationReadinessTypes";
import type { Nation } from "../../types/nationTypes";
import type { JSX, ReactNode } from "react";

export function NationReadinessSection({
  currentTurnNumber,
  effectiveCanAdmin,
  isArchived,
  nation,
  worldId,
}: {
  readonly currentTurnNumber: number;
  readonly effectiveCanAdmin: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();
  const votersQuery = useQuery(
    nationReadinessVotersQueryOptions(nation.id, currentTurnNumber),
  );
  const castVoteMutation = useMutation(
    castNationReadinessVoteMutationOptions({ queryClient }),
  );

  if (votersQuery.isPending) {
    return (
      <ReadinessCardFrame>
        <LoadingState label="Loading nation readiness…" />
      </ReadinessCardFrame>
    );
  }

  if (votersQuery.isError) {
    return (
      <ReadinessCardFrame>
        <ErrorState
          title="Nation readiness could not be loaded"
          description={getErrorDescription(votersQuery.error)}
        />
      </ReadinessCardFrame>
    );
  }

  const readinessMode = GOVERNMENT_RULES[nation.governmentType].readinessMode;
  const voters = votersQuery.data;
  const pendingVoterCitizenId = castVoteMutation.isPending
    ? castVoteMutation.variables.voterCitizenId
    : null;

  function castVote(voterCitizenId: string, vote: boolean): void {
    castVoteMutation.mutate(
      {
        nationId: nation.id,
        turnNumber: currentTurnNumber,
        vote,
        voterCitizenId,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error);
        },
      },
    );
  }

  function canVoteFor(voterCitizenId: string): boolean {
    return (
      effectiveCanAdmin ||
      (activeCharacter !== null &&
        activeCharacter.status === "alive" &&
        activeCharacter.id === voterCitizenId)
    );
  }

  if (readinessMode === "ruler_only") {
    const ruler = voters[0] ?? null;

    return (
      <ReadinessCardFrame>
        {ruler === null ? (
          <EmptyState
            title="No ruler assigned"
            description="Nation readiness appears here once a ruler is assigned."
          />
        ) : (
          <>
            {canVoteFor(ruler.citizenId) ? (
              <Label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
                <Switch
                  checked={ruler.vote === true}
                  disabled={isArchived || castVoteMutation.isPending}
                  onCheckedChange={(checked) => {
                    castVote(ruler.citizenId, checked);
                  }}
                />
                <span>Ready</span>
              </Label>
            ) : (
              <p className="text-sm text-muted-foreground">
                {formatVoteState(ruler.vote)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Ruler:{" "}
              <span className="font-medium text-foreground">{ruler.name}</span>
            </p>
          </>
        )}
      </ReadinessCardFrame>
    );
  }

  const trueVoteCount = voters.filter((voter) => voter.vote === true).length;
  const eligibleVoterCount = voters.length;
  const isReady =
    readinessMode === "office_majority"
      ? trueVoteCount > eligibleVoterCount / 2
      : eligibleVoterCount > 0 && trueVoteCount === eligibleVoterCount;
  const voterLabel = getReadinessVoterLabel(readinessMode);

  return (
    <ReadinessCardFrame>
      {eligibleVoterCount === 0 ? (
        <EmptyState
          title={`No eligible ${voterLabel} yet`}
          description="Nation readiness appears here once eligible voters exist."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {trueVoteCount}/{eligibleVoterCount} {voterLabel} ready
            {isReady ? " — nation ready" : ""}
          </p>
          <ul className="grid grid-cols-1 gap-2">
            {voters.map((voter) => (
              <NationReadinessVoterRow
                canVote={canVoteFor(voter.citizenId)}
                castVote={castVote}
                isArchived={isArchived}
                isPending={pendingVoterCitizenId === voter.citizenId}
                key={voter.citizenId}
                voter={voter}
              />
            ))}
          </ul>
        </>
      )}
    </ReadinessCardFrame>
  );
}

function NationReadinessVoterRow({
  canVote,
  castVote,
  isArchived,
  isPending,
  voter,
}: {
  readonly canVote: boolean;
  readonly castVote: (voterCitizenId: string, vote: boolean) => void;
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly voter: NationReadinessVoter;
}): JSX.Element {
  return (
    <li className="flex flex-col gap-2 rounded-sm border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="truncate text-sm font-medium text-foreground">
        {voter.name ?? "Unknown citizen"}
      </span>
      {canVote ? (
        <div className="flex shrink-0 gap-1">
          <Button
            disabled={isArchived || isPending}
            onClick={() => {
              castVote(voter.citizenId, true);
            }}
            size="sm"
            variant={voter.vote === true ? "default" : "outline"}
          >
            Ready
          </Button>
          <Button
            disabled={isArchived || isPending}
            onClick={() => {
              castVote(voter.citizenId, false);
            }}
            size="sm"
            variant={voter.vote === false ? "default" : "outline"}
          >
            Not ready
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          {formatVoteState(voter.vote)}
        </span>
      )}
    </li>
  );
}

function formatVoteState(vote: boolean | null): string {
  if (vote === true) {
    return "Ready";
  }
  if (vote === false) {
    return "Not ready";
  }
  return "Awaiting vote";
}

function ReadinessCardFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <Card aria-labelledby="nation-readiness-heading" className="grid gap-3 p-4">
      <h2
        id="nation-readiness-heading"
        className="text-base font-medium text-foreground"
      >
        Readiness
      </h2>
      {children}
    </Card>
  );
}
