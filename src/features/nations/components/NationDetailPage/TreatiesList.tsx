import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

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
import { citizensByIdsQueryOptions } from "@/features/citizens";
import type { Resource } from "@/features/resources";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import {
  breakTreatyMutationOptions,
  respondToTreatyMutationOptions,
  withdrawTreatyMutationOptions,
} from "../../mutations/treatiesMutations";
import { formatNationTreatyStatus } from "../../types/nationTreatyTypes";

import { ProposeTreatyDialog } from "./ProposeTreatyDialog";
import {
  formatTreatyExpiry,
  formatTreatyTerms,
  getTreatyStatusBadgeClassName,
  getTreatyTypeIconConfig,
} from "./TreatyUtils";

import type {
  NationTreaty,
  RoyalMarriageTreatyTerms,
} from "../../types/nationTreatyTypes";
import type { Nation } from "../../types/nationTypes";

export function NationTreatiesPanel({
  activeCharacterId,
  calendarConfig,
  canControl,
  nation,
  other,
  queryClient,
  resources,
  treaties,
}: {
  readonly activeCharacterId: string | null;
  readonly calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null;
  readonly canControl: boolean;
  readonly nation: Nation;
  readonly other: Nation;
  readonly queryClient: QueryClient;
  readonly resources: readonly Resource[];
  readonly treaties: readonly NationTreaty[];
}): JSX.Element {
  const [isProposing, setIsProposing] = useState(false);

  const citizenIds = Array.from(
    new Set(
      treaties
        .filter(
          (
            treaty,
          ): treaty is NationTreaty & {
            terms: RoyalMarriageTreatyTerms;
          } => treaty.treatyType === "royal_marriage",
        )
        .flatMap((treaty) => [
          treaty.terms.citizenAId,
          treaty.terms.citizenBId,
        ]),
    ),
  );
  const citizensQuery = useQuery(citizensByIdsQueryOptions(citizenIds));

  const citizenNamesById = new Map<string, string>(
    (citizensQuery.data ?? []).map((citizen) => [citizen.id, citizen.name]),
  );
  const resourceNamesById = new Map<string, string>(
    resources.map((resource) => [resource.id, resource.name]),
  );

  const canPropose = canControl && activeCharacterId !== null;

  return (
    <div className="grid gap-2 border-t border-border pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Treaties
        </span>
        {canPropose ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              setIsProposing(true);
            }}
          >
            Propose treaty
          </Button>
        ) : null}
      </div>
      {treaties.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No treaties with {other.name}.
        </p>
      ) : (
        <ul className="grid gap-2">
          {treaties.map((treaty) => (
            <TreatyRow
              key={treaty.id}
              activeCharacterId={activeCharacterId}
              calendarConfig={calendarConfig}
              canControl={canControl}
              citizenNamesById={citizenNamesById}
              nation={nation}
              other={other}
              queryClient={queryClient}
              resourceNamesById={resourceNamesById}
              treaty={treaty}
            />
          ))}
        </ul>
      )}
      {isProposing && activeCharacterId !== null ? (
        <ProposeTreatyDialog
          activeCharacterId={activeCharacterId}
          nation={nation}
          other={other}
          queryClient={queryClient}
          onClose={() => {
            setIsProposing(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TreatyRow({
  activeCharacterId,
  calendarConfig,
  canControl,
  citizenNamesById,
  nation,
  other,
  queryClient,
  resourceNamesById,
  treaty,
}: {
  readonly activeCharacterId: string | null;
  readonly calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null;
  readonly canControl: boolean;
  readonly citizenNamesById: ReadonlyMap<string, string>;
  readonly nation: Nation;
  readonly other: Nation;
  readonly queryClient: QueryClient;
  readonly resourceNamesById: ReadonlyMap<string, string>;
  readonly treaty: NationTreaty;
}): JSX.Element {
  const [isBreaking, setIsBreaking] = useState(false);

  const respondMutation = useMutation(
    respondToTreatyMutationOptions({ queryClient }),
  );
  const withdrawMutation = useMutation(
    withdrawTreatyMutationOptions({ queryClient }),
  );
  const breakMutation = useMutation(
    breakTreatyMutationOptions({ queryClient }),
  );

  const anyPending =
    respondMutation.isPending ||
    withdrawMutation.isPending ||
    breakMutation.isPending;

  const proposerName =
    treaty.proposerNationId === nation.id ? nation.name : other.name;
  const responderName =
    treaty.responderNationId === nation.id ? nation.name : other.name;
  const { Icon } = getTreatyTypeIconConfig(treaty.treatyType);
  const termsText = formatTreatyTerms(treaty, {
    citizenNamesById,
    proposerName,
    resourceNamesById,
    responderName,
  });
  const expiryText = formatTreatyExpiry(treaty.endsTurnNumber, (turnNumber) =>
    calendarConfig === null
      ? `Turn ${String(turnNumber)}`
      : formatCalendarDate(
          resolveTurnCalendarDate(calendarConfig, turnNumber),
          {
            dateFormatTemplate: calendarConfig.dateFormatTemplate,
          },
        ),
  );

  const isIncomingProposal =
    treaty.status === "proposed" && treaty.responderNationId === nation.id;
  const isOutgoingProposal =
    treaty.status === "proposed" && treaty.proposerNationId === nation.id;
  const canAct = canControl && activeCharacterId !== null && !anyPending;

  function notifyError(message: string) {
    return (error: unknown) => {
      notifyMutationError(error, message);
    };
  }

  return (
    <li className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {termsText}
        </span>
        <Badge className={getTreatyStatusBadgeClassName(treaty.status)}>
          {formatNationTreatyStatus(treaty.status)}
        </Badge>
      </div>
      <div className="text-muted-foreground">
        {treaty.status === "proposed" && treaty.durationTurns !== null
          ? `Duration: ${String(treaty.durationTurns)} turns`
          : `Expires: ${expiryText}`}
      </div>
      {isIncomingProposal ||
      isOutgoingProposal ||
      treaty.status === "active" ? (
        <div className="flex flex-wrap gap-2">
          {isIncomingProposal ? (
            <>
              <Button
                disabled={!canAct}
                size="sm"
                type="button"
                onClick={() => {
                  if (activeCharacterId === null) return;
                  respondMutation.mutate(
                    {
                      respondedByCitizenId: activeCharacterId,
                      response: "accept",
                      treatyId: treaty.id,
                    },
                    {
                      onError: notifyError("Failed to accept treaty."),
                      onSuccess: () => {
                        notifyMutationSuccess("Treaty accepted.");
                      },
                    },
                  );
                }}
              >
                Accept
              </Button>
              <Button
                disabled={!canAct}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  if (activeCharacterId === null) return;
                  respondMutation.mutate(
                    {
                      respondedByCitizenId: activeCharacterId,
                      response: "decline",
                      treatyId: treaty.id,
                    },
                    {
                      onError: notifyError("Failed to decline treaty."),
                      onSuccess: () => {
                        notifyMutationSuccess("Treaty declined.");
                      },
                    },
                  );
                }}
              >
                Decline
              </Button>
            </>
          ) : null}
          {isOutgoingProposal ? (
            <Button
              disabled={!canAct}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                withdrawMutation.mutate(
                  { treatyId: treaty.id },
                  {
                    onError: notifyError("Failed to withdraw treaty."),
                    onSuccess: () => {
                      notifyMutationSuccess("Treaty withdrawn.");
                    },
                  },
                );
              }}
            >
              Withdraw
            </Button>
          ) : null}
          {treaty.status === "active" ? (
            <Button
              disabled={!canAct}
              size="sm"
              type="button"
              variant="destructive"
              onClick={() => {
                setIsBreaking(true);
              }}
            >
              Break
            </Button>
          ) : null}
        </div>
      ) : null}
      <AlertDialog
        open={isBreaking}
        onOpenChange={(open) => {
          if (!open) setIsBreaking(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Break treaty?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately end the {termsText.toLowerCase()} treaty
              between {nation.name} and {other.name}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={breakMutation.isPending}>
              Keep treaty
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={breakMutation.isPending}
              onClick={() => {
                if (activeCharacterId === null) return;
                breakMutation.mutate(
                  { brokenByCitizenId: activeCharacterId, treatyId: treaty.id },
                  {
                    onError: notifyError("Failed to break treaty."),
                    onSuccess: () => {
                      notifyMutationSuccess("Treaty broken.");
                      setIsBreaking(false);
                    },
                  },
                );
              }}
            >
              {breakMutation.isPending ? "Breaking…" : "Break treaty"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
