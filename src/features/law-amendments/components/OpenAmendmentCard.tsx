import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Citizen } from "@/features/citizens";
import { citizensByIdsQueryOptions } from "@/features/citizens";
import type {
  BodyResolverContext,
  GovernmentBody,
} from "@/features/government-bodies";
import { notifyMutationError } from "@/lib/notify";
import {
  resolveBodyMembers,
  type VoteAmendmentProcedure,
} from "@/shared/government";

import { castLawAmendmentVoteMutationOptions } from "../mutations/lawAmendmentsMutations";
import { lawAmendmentVotesQueryOptions } from "../queries/lawAmendmentsQueries";
import { formatTurnsUntilDeadline, neededYesVotes } from "../utils/voteTally";

import type { LawAmendment } from "../types/lawAmendmentTypes";

// One open (status "proposed") amendment: live tally, deadline, and a
// per-voter roster with cast/uncast state. Bicameral procedures (a
// secondBodyId set) are simplified to a single pooled tally across both
// chambers' rosters rather than two independently-passing chamber tallies --
// this is an advisory UI number only (cast_law_amendment_vote is the real
// pass/fail gate), so the simplification is pragmatic, not a correctness gap.
export function OpenAmendmentCard({
  activeCharacter,
  amendment,
  bodies,
  currentTurnNumber,
  documentId,
  effectiveCanAdmin,
  procedure,
  resolverContext,
}: {
  readonly activeCharacter: Citizen | null;
  readonly amendment: LawAmendment;
  readonly bodies: readonly GovernmentBody[];
  readonly currentTurnNumber: number;
  readonly documentId: string;
  readonly effectiveCanAdmin: boolean;
  readonly procedure: VoteAmendmentProcedure;
  readonly resolverContext: BodyResolverContext;
}): JSX.Element {
  const queryClient = useQueryClient();
  const votesQuery = useQuery(lawAmendmentVotesQueryOptions(amendment.id));
  const castVoteMutation = useMutation(
    castLawAmendmentVoteMutationOptions({ queryClient }),
  );

  const firstBody = bodies.find((body) => body.id === procedure.bodyId);
  const secondBody =
    procedure.secondBodyId === null
      ? undefined
      : bodies.find((body) => body.id === procedure.secondBodyId);

  // Full roster resolution needs every member alive, including citizens
  // named by an explicit "citizens" rule -- mirror BodiesSection's
  // aliveCitizenIds assembly (ruler/settlement managers/office holders are
  // alive by construction; explicit picks need a lookup).
  const explicitCitizenIds = [
    ...new Set(
      [...(firstBody?.composition ?? []), ...(secondBody?.composition ?? [])]
        .filter((rule) => rule.kind === "citizens")
        .flatMap((rule) => rule.citizenIds),
    ),
  ];
  const explicitCitizensQuery = useQuery(
    citizensByIdsQueryOptions(explicitCitizenIds),
  );
  const aliveExplicitCitizenIds = (explicitCitizensQuery.data ?? [])
    .filter((citizen) => citizen.status === "alive")
    .map((citizen) => citizen.id);
  const aliveCitizenIds = new Set([
    ...(resolverContext.rulerCitizenId !== null
      ? [resolverContext.rulerCitizenId]
      : []),
    ...resolverContext.settlementManagers.map((manager) => manager.citizenId),
    ...resolverContext.officeHolders.map((holder) => holder.citizenId),
    ...aliveExplicitCitizenIds,
  ]);

  const memberIds = [
    ...new Set([
      ...(firstBody === undefined
        ? []
        : resolveBodyMembers(firstBody, {
            ...resolverContext,
            aliveCitizenIds,
          })),
      ...(secondBody === undefined
        ? []
        : resolveBodyMembers(secondBody, {
            ...resolverContext,
            aliveCitizenIds,
          })),
    ]),
  ];

  const membersQuery = useQuery(citizensByIdsQueryOptions(memberIds));
  const nameById = new Map(
    (membersQuery.data ?? []).map((citizen) => [citizen.id, citizen.name]),
  );

  const votes = votesQuery.data ?? [];
  const voteByVoterCitizenId = new Map(
    votes.map((vote) => [vote.voterCitizenId, vote.vote]),
  );
  const yesCount = votes.filter((vote) => vote.vote).length;
  const needed = neededYesVotes(procedure.threshold, memberIds.length);

  const pendingVoterCitizenId = castVoteMutation.isPending
    ? castVoteMutation.variables.voterCitizenId
    : null;

  function canVoteFor(voterCitizenId: string): boolean {
    return (
      effectiveCanAdmin ||
      (activeCharacter !== null &&
        activeCharacter.status === "alive" &&
        activeCharacter.id === voterCitizenId)
    );
  }

  function castVote(voterCitizenId: string, vote: boolean): void {
    castVoteMutation.mutate(
      { amendmentId: amendment.id, documentId, vote, voterCitizenId },
      { onError: (error) => notifyMutationError(error) },
    );
  }

  return (
    <li className="grid gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{amendment.title}</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Proposed</Badge>
          {amendment.deadlineTurnNumber !== null ? (
            <Badge variant="outline">
              {formatTurnsUntilDeadline(
                amendment.deadlineTurnNumber,
                currentTurnNumber,
              )}
            </Badge>
          ) : null}
        </div>
      </div>
      {amendment.rationaleMarkdown !== null ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {amendment.rationaleMarkdown}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {yesCount}/{memberIds.length} yes, needs {needed}
      </p>

      {votesQuery.isPending || membersQuery.isPending ? null : (
        <ul className="grid grid-cols-1 gap-2">
          {memberIds.map((citizenId) => {
            const vote = voteByVoterCitizenId.get(citizenId) ?? null;
            return (
              <li
                key={citizenId}
                className="flex flex-col gap-2 rounded-sm border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {nameById.get(citizenId) ?? "Unknown citizen"}
                </span>
                {canVoteFor(citizenId) ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      disabled={pendingVoterCitizenId === citizenId}
                      onClick={() => castVote(citizenId, true)}
                      size="sm"
                      variant={vote === true ? "default" : "outline"}
                    >
                      Yes
                    </Button>
                    <Button
                      disabled={pendingVoterCitizenId === citizenId}
                      onClick={() => castVote(citizenId, false)}
                      size="sm"
                      variant={vote === false ? "default" : "outline"}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {vote === true
                      ? "Voted yes"
                      : vote === false
                        ? "Voted no"
                        : "Awaiting vote"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
