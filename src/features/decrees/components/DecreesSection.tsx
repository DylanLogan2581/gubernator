import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
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
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
  worldCalendarConfigQueryOptions,
  type WorldCalendarConfig,
} from "@/features/calendar";
import {
  playerCharactersInNationQueryOptions,
  citizensInSettlementQueryOptions,
} from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  issueDecreeMutationOptions,
  revokeDecreeMutationOptions,
} from "../mutations/decreesMutations";
import {
  nationDecreesQueryOptions,
  settlementDecreesQueryOptions,
} from "../queries/decreesQueries";

import { DecreeIssuerCombobox } from "./DecreeIssuerCombobox";

import type { Decree } from "../types/decreeTypes";

type DecreeScopeContext =
  | {
      readonly scope: "nation";
      readonly nationId: string;
      readonly worldId: string;
    }
  | {
      readonly scope: "settlement";
      readonly nationId: string;
      readonly settlementId: string;
      readonly worldId: string;
    };

export type DecreesSectionProps = DecreeScopeContext & {
  readonly canManage: boolean;
  // Admin-issued decrees record the acting citizen id explicitly rather than
  // resolving one from auth.uid() -- see issue_decree's authority comment.
  readonly effectiveCanAdmin: boolean;
  readonly isArchived: boolean;
};

function formatTurnDate(
  turnNumber: number,
  calendarConfig: WorldCalendarConfig | null,
): string {
  if (calendarConfig === null) {
    return `Turn ${String(turnNumber)}`;
  }
  try {
    return formatCalendarDate(
      resolveTurnCalendarDate(calendarConfig, turnNumber),
      { dateFormatTemplate: calendarConfig.dateFormatTemplate },
    );
  } catch {
    return `Turn ${String(turnNumber)}`;
  }
}

// #1121: standalone proclamations for a nation or settlement's government
// tab -- pure roleplay/DM reference, zero simulation effects. Every write is
// RPC-only (issue_decree, revoke_decree). Distinct from law-amendments'
// decree-procedure amendments, which live in that feature and never write
// to this table.
export function DecreesSection(props: DecreesSectionProps): JSX.Element {
  const { canManage, effectiveCanAdmin, isArchived } = props;
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();

  const isNationScope = props.scope === "nation";
  const settlementId = props.scope === "settlement" ? props.settlementId : "";

  const nationDecreesQuery = useQuery({
    ...nationDecreesQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementDecreesQuery = useQuery({
    ...settlementDecreesQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const decreesQuery = isNationScope
    ? nationDecreesQuery
    : settlementDecreesQuery;

  const calendarConfigQuery = useQuery(
    worldCalendarConfigQueryOptions(props.worldId),
  );

  const isManagerActive =
    activeCharacter !== null &&
    activeCharacter.status === "alive" &&
    (isNationScope
      ? activeCharacter.roleType === "nation_manager" &&
        activeCharacter.roleNationId === props.nationId
      : activeCharacter.roleType === "settlement_manager" &&
        activeCharacter.roleSettlementId === settlementId);

  // Only needed when an admin who is not themselves the manager wants to
  // issue: falls back to the scope's current manager citizen as the acting
  // issuer. If there is no manager assigned, an admin (or superadmin) picks
  // an arbitrary citizen in the scope instead via IssueDecreeDialog (#1159).
  const rulerLookupEnabled = canManage && effectiveCanAdmin && !isManagerActive;
  const nationRulerQuery = useQuery({
    ...playerCharactersInNationQueryOptions(props.nationId),
    enabled: rulerLookupEnabled && isNationScope,
  });
  const settlementRulerQuery = useQuery({
    ...citizensInSettlementQueryOptions(settlementId),
    enabled: rulerLookupEnabled && !isNationScope,
  });
  const rulerCitizenId = rulerLookupEnabled
    ? ((
        (isNationScope ? nationRulerQuery.data : settlementRulerQuery.data) ??
        []
      ).find((citizen) =>
        isNationScope
          ? citizen.roleType === "nation_manager" &&
            citizen.roleNationId === props.nationId &&
            citizen.status === "alive"
          : citizen.roleType === "settlement_manager" &&
            citizen.roleSettlementId === settlementId &&
            citizen.status === "alive",
      )?.id ?? null)
    : null;
  const canPickIssuer = rulerLookupEnabled && rulerCitizenId === null;

  const issuedByCitizenId = isManagerActive
    ? (activeCharacter?.id ?? null)
    : rulerCitizenId;

  const revokeMutation = useMutation(
    revokeDecreeMutationOptions({ queryClient }),
  );

  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<Decree | null>(null);

  const decrees = decreesQuery.data ?? [];
  const calendarConfig = calendarConfigQuery.data ?? null;

  function handleRevokeConfirm(): void {
    if (revoking === null) return;
    revokeMutation.mutate(
      {
        id: revoking.id,
        nationId: revoking.nationId,
        settlementId: revoking.settlementId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to revoke decree.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${revoking.title} revoked.`);
          setRevoking(null);
        },
      },
    );
  }

  return (
    <>
      <Card aria-labelledby="decrees-heading" className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="decrees-heading" className="text-base font-medium">
            Decrees
          </h2>
          {canManage &&
          !isArchived &&
          (issuedByCitizenId !== null || canPickIssuer) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIssuing(true)}
            >
              Issue decree
            </Button>
          ) : null}
        </div>

        {decreesQuery.isPending ? (
          <LoadingState label="Loading decrees…" />
        ) : decreesQuery.isError ? (
          <ErrorState
            title="Decrees could not be loaded"
            description={getErrorDescription(decreesQuery.error)}
          />
        ) : decrees.length === 0 ? (
          <EmptyState
            title="No decrees yet"
            description="Issue a one-off proclamation for the record."
          />
        ) : (
          <ul className="grid gap-2">
            {decrees.map((decree) => (
              <li
                key={decree.id}
                className="grid gap-1 rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="grid gap-0.5">
                    <span
                      className={
                        decree.revokedTurnNumber !== null
                          ? "font-medium line-through text-muted-foreground"
                          : "font-medium"
                      }
                    >
                      {decree.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Issued{" "}
                      {formatTurnDate(decree.issuedTurnNumber, calendarConfig)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {decree.revokedTurnNumber !== null ? (
                      <Badge variant="secondary">
                        Revoked{" "}
                        {formatTurnDate(
                          decree.revokedTurnNumber,
                          calendarConfig,
                        )}
                      </Badge>
                    ) : canManage && !isArchived ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRevoking(decree)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </div>

                {decree.revokedTurnNumber !== null ? (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        Show text
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {decree.bodyMarkdown}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {decree.bodyMarkdown}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && issuing && (issuedByCitizenId !== null || canPickIssuer) ? (
        <IssueDecreeDialog
          issuedByCitizenId={issuedByCitizenId}
          onClose={() => setIssuing(false)}
          queryClient={queryClient}
          scopeContext={props}
        />
      ) : null}

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke decree?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking === null
                ? ""
                : `This will mark ${revoking.title} as revoked. The decree stays in the log. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={revokeMutation.isPending}>
              Keep decree
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              disabled={revokeMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function IssueDecreeDialog({
  issuedByCitizenId,
  onClose,
  queryClient,
  scopeContext,
}: {
  readonly issuedByCitizenId: string | null;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly scopeContext: DecreeScopeContext;
}): JSX.Element {
  const [title, setTitle] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [pickedCitizenId, setPickedCitizenId] = useState<string | null>(null);

  const issueMutation = useMutation(
    issueDecreeMutationOptions({ queryClient }),
  );

  const resolvedIssuedByCitizenId = issuedByCitizenId ?? pickedCitizenId;

  const trimmedTitle = title.trim();
  const trimmedBody = bodyMarkdown.trim();
  const canSubmit =
    trimmedTitle !== "" &&
    trimmedBody !== "" &&
    resolvedIssuedByCitizenId !== null;

  function handleSubmit(): void {
    if (!canSubmit || resolvedIssuedByCitizenId === null) return;

    issueMutation.mutate(
      {
        bodyMarkdown: trimmedBody,
        issuedByCitizenId: resolvedIssuedByCitizenId,
        nationId:
          scopeContext.scope === "nation" ? scopeContext.nationId : null,
        settlementId:
          scopeContext.scope === "settlement"
            ? scopeContext.settlementId
            : null,
        title: trimmedTitle,
        worldId: scopeContext.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to issue decree.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmedTitle} issued.`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue decree</DialogTitle>
          <DialogDescription>
            A one-off proclamation for the record -- roleplay only, no
            simulation effects.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {issuedByCitizenId === null ? (
            <div className="grid gap-1">
              <Label htmlFor="decree-issuer">Issued by</Label>
              <DecreeIssuerCombobox
                citizenId={pickedCitizenId}
                nationId={scopeContext.nationId}
                onChange={setPickedCitizenId}
                settlementId={
                  scopeContext.scope === "settlement"
                    ? scopeContext.settlementId
                    : undefined
                }
                worldId={scopeContext.worldId}
              />
            </div>
          ) : null}
          <div className="grid gap-1">
            <Label htmlFor="decree-title">Title</Label>
            <Input
              id="decree-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="All exports of amulets are banned"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="decree-body">Body</Label>
            <Textarea
              id="decree-body"
              value={bodyMarkdown}
              onChange={(e) => setBodyMarkdown(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || issueMutation.isPending}
          >
            {issueMutation.isPending ? "Issuing…" : "Issue decree"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
