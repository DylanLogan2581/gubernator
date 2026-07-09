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
import { Checkbox } from "@/components/ui/checkbox";
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
import { ALLOWED_NATION_OFFICE_TYPES } from "@/shared/government";
import {
  formatCalendarDate,
  formatCalendarYear,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import {
  appointNationOfficeMutationOptions,
  dismissNationOfficeMutationOptions,
  renewNationOfficeMutationOptions,
} from "../../mutations/officesMutations";
import {
  createOfficeTypeMutationOptions,
  deleteOfficeTypeMutationOptions,
} from "../../mutations/officeTypesMutations";
import { nationOfficesRosterQueryOptions } from "../../queries/officesQueries";
import { nationOfficeTypesQueryOptions } from "../../queries/officeTypesQueries";
import { formatNationOfficeType } from "../../types/nationOfficeTypes";

import type { AppointNationOfficeInput } from "../../mutations/officesMutations";
import type {
  NationOfficeRosterEntry,
  OfficeType,
} from "../../types/nationOfficeTypes";
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
  const officeTypesQuery = useQuery(
    nationOfficeTypesQueryOptions(nation.worldId, nation.id),
  );
  const calendarQuery = useQuery(
    worldCalendarConfigQueryOptions(nation.worldId),
  );
  const dismissMutation = useMutation(
    dismissNationOfficeMutationOptions({ queryClient }),
  );
  const renewMutation = useMutation(
    renewNationOfficeMutationOptions({ queryClient }),
  );

  const [isAppointing, setIsAppointing] = useState(false);
  const [isManagingTypes, setIsManagingTypes] = useState(false);
  const [dismissing, setDismissing] = useState<NationOfficeRosterEntry | null>(
    null,
  );

  if (rosterQuery.isPending || officeTypesQuery.isPending) {
    return (
      <OfficesCardFrame
        canManage={canManage}
        onAppoint={undefined}
        onManageTypes={undefined}
      >
        <LoadingState label="Loading offices…" />
      </OfficesCardFrame>
    );
  }

  if (rosterQuery.isError || officeTypesQuery.isError) {
    return (
      <OfficesCardFrame
        canManage={canManage}
        onAppoint={undefined}
        onManageTypes={undefined}
      >
        <ErrorState
          title="Offices could not be loaded"
          description={getErrorDescription(
            rosterQuery.error ?? officeTypesQuery.error,
          )}
        />
      </OfficesCardFrame>
    );
  }

  const allowedDefaultNames = ALLOWED_NATION_OFFICE_TYPES[
    nation.governmentType
  ] as readonly string[];
  const allOfficeTypes = officeTypesQuery.data;
  // Appointable offices: world-default types allowed for this government,
  // plus every custom office type this nation invented (#1114).
  const appointableTypes = allOfficeTypes.filter(
    (type) =>
      (type.nationId === null && allowedDefaultNames.includes(type.name)) ||
      type.nationId === nation.id,
  );
  const officeTypeById = new Map(allOfficeTypes.map((t) => [t.id, t]));
  const roster = rosterQuery.data;
  const calendarConfig = calendarQuery.data ?? null;

  const rosterByType = new Map<string, NationOfficeRosterEntry[]>();
  for (const officeType of appointableTypes) {
    rosterByType.set(officeType.id, []);
  }
  for (const entry of roster) {
    const group = rosterByType.get(entry.officeTypeId);
    if (group !== undefined) {
      group.push(entry);
    } else {
      rosterByType.set(entry.officeTypeId, [entry]);
    }
  }

  function handleRenew(entry: NationOfficeRosterEntry): void {
    renewMutation.mutate(
      { nationId: nation.id, officeId: entry.id, worldId: nation.worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to renew office holder.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${entry.citizenName}'s term renewed.`);
        },
      },
    );
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
        onManageTypes={
          isArchived || !isNationManager
            ? undefined
            : () => setIsManagingTypes(true)
        }
      >
        {appointableTypes.length === 0 ? (
          <EmptyState
            title="No offices for this government"
            description={`${nation.name}'s government does not define any appointable offices.`}
          />
        ) : (
          <div className="grid gap-4">
            {[...rosterByType.entries()].map(([officeTypeId, entries]) => {
              const officeType = officeTypeById.get(officeTypeId);
              return officeType === undefined ? null : (
                <OfficeGroup
                  canManage={canManage}
                  calendarConfig={calendarConfig}
                  entries={entries}
                  isArchived={isArchived}
                  key={officeTypeId}
                  officeType={officeType}
                  onDismiss={setDismissing}
                  onRenew={handleRenew}
                  renewPending={renewMutation.isPending}
                />
              );
            })}
          </div>
        )}
      </OfficesCardFrame>

      {canManage && isAppointing ? (
        <AppointOfficeDialog
          appointableTypes={appointableTypes}
          nation={nation}
          onClose={() => setIsAppointing(false)}
          queryClient={queryClient}
          roster={roster}
        />
      ) : null}

      {isNationManager && isManagingTypes ? (
        <OfficeTypeManagerDialog
          allOfficeTypes={allOfficeTypes}
          isArchived={isArchived}
          nation={nation}
          onClose={() => setIsManagingTypes(false)}
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
                : `This will remove ${dismissing.citizenName} from ${formatNationOfficeType(dismissing.officeTypeName)}. This action cannot be undone.`}
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
  onRenew,
  renewPending,
}: {
  readonly calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null;
  readonly canManage: boolean;
  readonly entries: readonly NationOfficeRosterEntry[];
  readonly isArchived: boolean;
  readonly officeType: OfficeType;
  readonly onDismiss: (entry: NationOfficeRosterEntry) => void;
  readonly onRenew: (entry: NationOfficeRosterEntry) => void;
  readonly renewPending: boolean;
}): JSX.Element {
  const label = formatNationOfficeType(officeType.name);
  const capLabel =
    officeType.maxHolders === null
      ? ""
      : ` (max ${String(officeType.maxHolders)})`;
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium text-foreground">
        {label}
        {capLabel}
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No {label.toLowerCase()} appointed.
        </p>
      ) : (
        <ul className="grid gap-2" aria-label={label}>
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
                <span className="text-xs text-muted-foreground">
                  {formatTermStatus(entry, calendarConfig)}
                </span>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  {entry.termTurns !== null ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isArchived || renewPending}
                      onClick={() => onRenew(entry)}
                    >
                      Renew
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isArchived}
                    onClick={() => onDismiss(entry)}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppointOfficeDialog({
  appointableTypes,
  nation,
  onClose,
  queryClient,
  roster,
}: {
  readonly appointableTypes: readonly OfficeType[];
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly roster: readonly NationOfficeRosterEntry[];
}): JSX.Element {
  const [officeTypeId, setOfficeTypeId] = useState<string>(
    appointableTypes[0]?.id ?? "",
  );
  const [citizenId, setCitizenId] = useState<string>("");
  const [termTurns, setTermTurns] = useState<string>(
    appointableTypes[0]?.defaultTermTurns?.toString() ?? "",
  );

  const citizensQuery = useQuery(
    playerCharactersInNationQueryOptions(nation.id),
  );
  const appointMutation = useMutation(
    appointNationOfficeMutationOptions({ queryClient }),
  );

  const selectedType = appointableTypes.find((t) => t.id === officeTypeId);
  const currentHolderIds = new Set(
    roster
      .filter((entry) => entry.officeTypeId === officeTypeId)
      .map((entry) => entry.citizenId),
  );
  const atCapacity =
    selectedType?.maxHolders !== null &&
    selectedType?.maxHolders !== undefined &&
    currentHolderIds.size >= selectedType.maxHolders;
  const candidates: readonly Citizen[] = (citizensQuery.data ?? []).filter(
    (citizen) =>
      citizen.status === "alive" && !currentHolderIds.has(citizen.id),
  );

  function handleSubmit(): void {
    if (citizenId === "" || selectedType === undefined) return;
    const parsedTermTurns = termTurns.trim() === "" ? null : Number(termTurns);
    const input: AppointNationOfficeInput = {
      citizenId,
      nationId: nation.id,
      officeType: selectedType.name,
      termTurns: parsedTermTurns,
      worldId: nation.worldId,
    };
    appointMutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to appoint office holder.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Office holder appointed.");
        onClose();
      },
    });
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
              value={officeTypeId}
              onValueChange={(value) => {
                setOfficeTypeId(value);
                setCitizenId("");
                setTermTurns(
                  appointableTypes
                    .find((t) => t.id === value)
                    ?.defaultTermTurns?.toString() ?? "",
                );
              }}
            >
              <SelectTrigger id="office-type-select" aria-label="Office type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {appointableTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {formatNationOfficeType(type.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="office-term-turns">
              Term length in turns (optional, indefinite if blank)
            </Label>
            <Input
              id="office-term-turns"
              type="number"
              min={1}
              value={termTurns}
              onChange={(e) => setTermTurns(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="office-citizen-select">Citizen</Label>
            {atCapacity ? (
              <p className="text-sm text-muted-foreground">
                This office already has the maximum number of holders.
              </p>
            ) : citizensQuery.isPending ? (
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
            disabled={
              appointMutation.isPending || citizenId === "" || atCapacity
            }
          >
            {appointMutation.isPending ? "Appointing…" : "Appoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Nation manager only (#1114): invent, edit, and delete custom offices for
// this nation. World-default offices are listed for context but are not
// editable here -- those belong to the world admin config panel.
function OfficeTypeManagerDialog({
  allOfficeTypes,
  isArchived,
  nation,
  onClose,
  queryClient,
  roster,
}: {
  readonly allOfficeTypes: readonly OfficeType[];
  readonly isArchived: boolean;
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly roster: readonly NationOfficeRosterEntry[];
}): JSX.Element {
  const [name, setName] = useState("");
  const [maxHolders, setMaxHolders] = useState("");
  const [defaultTermTurns, setDefaultTermTurns] = useState("");
  const [excludesFromLabor, setExcludesFromLabor] = useState(true);

  const createMutation = useMutation(
    createOfficeTypeMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteOfficeTypeMutationOptions({ queryClient }),
  );

  const customTypes = allOfficeTypes.filter((t) => t.nationId === nation.id);
  const defaultTypes = allOfficeTypes.filter((t) => t.nationId === null);
  const holderCountByType = new Map<string, number>();
  for (const entry of roster) {
    holderCountByType.set(
      entry.officeTypeId,
      (holderCountByType.get(entry.officeTypeId) ?? 0) + 1,
    );
  }

  function handleCreate(): void {
    const trimmed = name.trim();
    if (trimmed === "") return;
    createMutation.mutate(
      {
        defaultTermTurns:
          defaultTermTurns === "" ? null : Number(defaultTermTurns),
        excludesFromLabor,
        maxHolders: maxHolders === "" ? null : Number(maxHolders),
        name: trimmed,
        nationId: nation.id,
        scope: "nation",
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to create office type.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmed} created.`);
          setName("");
          setMaxHolders("");
          setDefaultTermTurns("");
          setExcludesFromLabor(true);
        },
      },
    );
  }

  function handleDelete(type: OfficeType): void {
    deleteMutation.mutate(
      { id: type.id, nationId: type.nationId, worldId: type.worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to delete office type.");
        },
        onSuccess: () => {
          notifyMutationSuccess(
            `${formatNationOfficeType(type.name)} deleted.`,
          );
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage office types</DialogTitle>
          <DialogDescription>
            Invent custom offices for {nation.name}. World-default offices are
            managed by world admins.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">World defaults</h3>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {defaultTypes.map((type) => (
              <li key={type.id}>{formatNationOfficeType(type.name)}</li>
            ))}
          </ul>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Custom offices</h3>
          {customTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No custom offices yet.
            </p>
          ) : (
            <ul className="grid gap-2">
              {customTypes.map((type) => (
                <li
                  key={type.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <span>
                    {type.name}
                    {type.maxHolders === null
                      ? ""
                      : ` (max ${String(type.maxHolders)})`}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      isArchived ||
                      deleteMutation.isPending ||
                      (holderCountByType.get(type.id) ?? 0) > 0
                    }
                    onClick={() => handleDelete(type)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isArchived ? null : (
          <div className="grid gap-2 border-t border-border pt-3">
            <h3 className="text-sm font-medium">New custom office</h3>
            <div className="grid gap-1">
              <Label htmlFor="new-office-type-name">Name</Label>
              <Input
                id="new-office-type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lord Commander of the Night Watch"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="new-office-type-max-holders">
                Max holders (optional)
              </Label>
              <Input
                id="new-office-type-max-holders"
                type="number"
                min={1}
                value={maxHolders}
                onChange={(e) => setMaxHolders(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="new-office-type-default-term-turns">
                Default term length in turns (optional, indefinite if blank)
              </Label>
              <Input
                id="new-office-type-default-term-turns"
                type="number"
                min={1}
                value={defaultTermTurns}
                onChange={(e) => setDefaultTermTurns(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="new-office-type-excludes-labor"
                checked={excludesFromLabor}
                onCheckedChange={(checked) =>
                  setExcludesFromLabor(checked === true)
                }
              />
              <Label htmlFor="new-office-type-excludes-labor">
                Excludes holder from labor
              </Label>
            </div>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending || name.trim() === ""}
              className="w-fit"
            >
              {createMutation.isPending ? "Creating…" : "Create office"}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
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
  onManageTypes,
}: {
  readonly canManage: boolean;
  readonly children: JSX.Element;
  readonly onAppoint: (() => void) | undefined;
  readonly onManageTypes: (() => void) | undefined;
}): JSX.Element {
  return (
    <Card aria-labelledby="nation-offices-heading" className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="nation-offices-heading" className="text-base font-medium">
          Government offices
        </h2>
        <div className="flex gap-2">
          {canManage && onManageTypes !== undefined ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onManageTypes}
            >
              Manage office types
            </Button>
          ) : null}
          {canManage && onAppoint !== undefined ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAppoint}
            >
              Appoint office holder
            </Button>
          ) : null}
        </div>
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

// #1123: term_turns null = indefinite; otherwise show when the seat expires.
function formatTermStatus(
  entry: {
    readonly expiresTurnNumber: number | null;
    readonly termTurns: number | null;
  },
  calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null,
): string {
  if (entry.termTurns === null || entry.expiresTurnNumber === null) {
    return "Indefinite term";
  }
  if (calendarConfig === null) {
    return `Ends turn ${String(entry.expiresTurnNumber)}`;
  }
  try {
    return `Ends Year ${formatCalendarYear(
      resolveTurnCalendarDate(calendarConfig, entry.expiresTurnNumber).year,
    )}`;
  } catch {
    return `Ends turn ${String(entry.expiresTurnNumber)}`;
  }
}
