import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import { playerCharactersInNationQueryOptions } from "@/features/citizens";
import type { Citizen } from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import {
  ALLOWED_NATION_OFFICE_TYPES,
  type NationOfficeType,
} from "@/shared/government";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import {
  appointNationOfficeMutationOptions,
  dismissNationOfficeMutationOptions,
} from "../../mutations/officesMutations";
import { nationOfficesRosterQueryOptions } from "../../queries/officesQueries";
import { formatNationOfficeType } from "../../types/nationOfficeTypes";

import type { NationOfficeRosterEntry } from "../../types/nationOfficeTypes";
import type { Nation } from "../../types/nationTypes";

export function NationOfficesSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canManage = canAdminWorld || isNationManager;

  const queryClient = useQueryClient();
  const rosterQuery = useQuery(nationOfficesRosterQueryOptions(nation.id));
  const calendarQuery = useQuery(
    worldCalendarConfigQueryOptions(nation.worldId),
  );
  const dismissMutation = useMutation(
    dismissNationOfficeMutationOptions({ queryClient }),
  );

  const [isAppointing, setIsAppointing] = useState(false);
  const [dismissing, setDismissing] = useState<NationOfficeRosterEntry | null>(
    null,
  );

  if (rosterQuery.isPending) {
    return (
      <OfficesCardFrame canManage={canManage} onAppoint={undefined}>
        <LoadingState label="Loading offices…" />
      </OfficesCardFrame>
    );
  }

  if (rosterQuery.isError) {
    return (
      <OfficesCardFrame canManage={canManage} onAppoint={undefined}>
        <ErrorState
          title="Offices could not be loaded"
          description={getErrorDescription(rosterQuery.error)}
        />
      </OfficesCardFrame>
    );
  }

  const allowedTypes = ALLOWED_NATION_OFFICE_TYPES[nation.governmentType];
  const roster = rosterQuery.data;
  const calendarConfig = calendarQuery.data ?? null;

  const rosterByType = new Map<NationOfficeType, NationOfficeRosterEntry[]>();
  for (const officeType of allowedTypes) {
    rosterByType.set(officeType, []);
  }
  for (const entry of roster) {
    const group = rosterByType.get(entry.officeType);
    if (group !== undefined) {
      group.push(entry);
    } else {
      rosterByType.set(entry.officeType, [entry]);
    }
  }

  function handleDismissConfirm(): void {
    if (dismissing === null) return;
    dismissMutation.mutate(
      {
        nationId: nation.id,
        officeId: dismissing.id,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to dismiss office holder.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${dismissing.citizenName} dismissed.`);
          setDismissing(null);
        },
      },
    );
  }

  return (
    <>
      <OfficesCardFrame
        canManage={canManage}
        onAppoint={isArchived ? undefined : () => setIsAppointing(true)}
      >
        {allowedTypes.length === 0 ? (
          <EmptyState
            title="No offices for this government"
            description={`${nation.name}'s government does not define any appointable offices.`}
          />
        ) : (
          <div className="grid gap-4">
            {[...rosterByType.entries()].map(([officeType, entries]) => (
              <OfficeGroup
                canManage={canManage}
                calendarConfig={calendarConfig}
                entries={entries}
                isArchived={isArchived}
                key={officeType}
                officeType={officeType}
                onDismiss={setDismissing}
              />
            ))}
          </div>
        )}
      </OfficesCardFrame>

      {canManage && isAppointing ? (
        <AppointOfficeDialog
          allowedTypes={allowedTypes}
          nation={nation}
          onClose={() => setIsAppointing(false)}
          queryClient={queryClient}
          roster={roster}
        />
      ) : null}

      <AlertDialog
        open={dismissing !== null}
        onOpenChange={(open) => {
          if (!open) setDismissing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss office holder?</AlertDialogTitle>
            <AlertDialogDescription>
              {dismissing === null
                ? ""
                : `This will remove ${dismissing.citizenName} from ${formatNationOfficeType(dismissing.officeType)}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={dismissMutation.isPending}>
              Keep office holder
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDismissConfirm}
              disabled={dismissMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {dismissMutation.isPending ? "Dismissing…" : "Dismiss"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OfficeGroup({
  calendarConfig,
  canManage,
  entries,
  isArchived,
  officeType,
  onDismiss,
}: {
  readonly calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null;
  readonly canManage: boolean;
  readonly entries: readonly NationOfficeRosterEntry[];
  readonly isArchived: boolean;
  readonly officeType: NationOfficeType;
  readonly onDismiss: (entry: NationOfficeRosterEntry) => void;
}): JSX.Element {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium text-foreground">
        {formatNationOfficeType(officeType)}
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No {formatNationOfficeType(officeType).toLowerCase()} appointed.
        </p>
      ) : (
        <ul
          className="grid gap-2"
          aria-label={formatNationOfficeType(officeType)}
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3"
            >
              <div className="grid gap-0.5 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Link
                    to="/worlds/$worldId/citizens/$citizenId"
                    params={{
                      citizenId: entry.citizenId,
                      worldId: entry.worldId,
                    }}
                    className="underline-offset-2 hover:underline"
                  >
                    {entry.citizenName}
                  </Link>
                  <Badge
                    variant={
                      entry.citizenType === "npc" ? "secondary" : "outline"
                    }
                  >
                    {entry.citizenType === "npc" ? "NPC" : "Player character"}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  Appointed{" "}
                  {formatAppointedTurn(
                    entry.appointedTurnNumber,
                    calendarConfig,
                  )}
                </span>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isArchived}
                  onClick={() => onDismiss(entry)}
                >
                  Dismiss
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppointOfficeDialog({
  allowedTypes,
  nation,
  onClose,
  queryClient,
  roster,
}: {
  readonly allowedTypes: readonly NationOfficeType[];
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly roster: readonly NationOfficeRosterEntry[];
}): JSX.Element {
  const [officeType, setOfficeType] = useState<NationOfficeType>(
    allowedTypes[0],
  );
  const [citizenId, setCitizenId] = useState<string>("");

  const citizensQuery = useQuery(
    playerCharactersInNationQueryOptions(nation.id),
  );
  const appointMutation = useMutation(
    appointNationOfficeMutationOptions({ queryClient }),
  );

  const currentHolderIds = new Set(
    roster
      .filter((entry) => entry.officeType === officeType)
      .map((entry) => entry.citizenId),
  );
  const candidates: readonly Citizen[] = (citizensQuery.data ?? []).filter(
    (citizen) =>
      citizen.status === "alive" && !currentHolderIds.has(citizen.id),
  );

  function handleSubmit(): void {
    if (citizenId === "") return;
    appointMutation.mutate(
      {
        citizenId,
        nationId: nation.id,
        officeType,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to appoint office holder.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Office holder appointed.");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appoint office holder</DialogTitle>
          <DialogDescription>
            Choose an office and an eligible citizen of this nation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="office-type-select">Office</Label>
            <Select
              value={officeType}
              onValueChange={(value) => {
                setOfficeType(value as NationOfficeType);
                setCitizenId("");
              }}
            >
              <SelectTrigger id="office-type-select" aria-label="Office type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatNationOfficeType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="office-citizen-select">Citizen</Label>
            {citizensQuery.isPending ? (
              <LoadingState label="Loading citizens…" />
            ) : citizensQuery.isError ? (
              <ErrorState
                title="Citizens could not be loaded"
                description={getErrorDescription(citizensQuery.error)}
              />
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible citizens for this office.
              </p>
            ) : (
              <Select value={citizenId} onValueChange={setCitizenId}>
                <SelectTrigger id="office-citizen-select" aria-label="Citizen">
                  <SelectValue placeholder="Select a citizen" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((citizen) => (
                    <SelectItem key={citizen.id} value={citizen.id}>
                      {citizen.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={appointMutation.isPending || citizenId === ""}
          >
            {appointMutation.isPending ? "Appointing…" : "Appoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfficesCardFrame({
  canManage,
  children,
  onAppoint,
}: {
  readonly canManage: boolean;
  readonly children: JSX.Element;
  readonly onAppoint: (() => void) | undefined;
}): JSX.Element {
  return (
    <Card aria-labelledby="nation-offices-heading" className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="nation-offices-heading" className="text-base font-medium">
          Government offices
        </h2>
        {canManage && onAppoint !== undefined ? (
          <Button type="button" variant="outline" size="sm" onClick={onAppoint}>
            Appoint office holder
          </Button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function formatAppointedTurn(
  turnNumber: number,
  calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null,
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
