import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import {
  citizensInSettlementQueryOptions,
  playerCharactersInNationQueryOptions,
  type Citizen,
} from "@/features/citizens";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { ALLOWED_NATION_OFFICE_TYPES } from "@/shared/government";
import { type resolveTurnCalendarDate } from "@/shared/turnCalendarPrimitives";

import {
  appointNationOfficeMutationOptions,
  appointSettlementOfficeMutationOptions,
  dismissNationOfficeMutationOptions,
  dismissSettlementOfficeMutationOptions,
  renewNationOfficeMutationOptions,
  renewSettlementOfficeMutationOptions,
} from "../../mutations/officesMutations";
import {
  createOfficeTypeMutationOptions,
  deleteOfficeTypeMutationOptions,
  updateOfficeTypeMutationOptions,
} from "../../mutations/officeTypesMutations";
import {
  nationOfficesRosterQueryOptions,
  settlementOfficesRosterQueryOptions,
} from "../../queries/officesQueries";
import {
  nationOfficeTypesQueryOptions,
  settlementOfficeTypesQueryOptions,
} from "../../queries/officeTypesQueries";
import {
  formatNationOfficeType,
  type OfficeType,
  type OfficeTypeScope,
} from "../../types/nationOfficeTypes";

import { formatAppointedTurn, formatTermStatus } from "./OfficeTermFormatters";

import type { NationGovernmentType } from "../../types/nationTypes";

type CalendarConfig = Parameters<typeof resolveTurnCalendarDate>[0] | null;

// The subset of NationOfficeRosterEntry / SettlementOfficeRosterEntry the
// shared UI reads. Both roster shapes (#1114/#1115) satisfy this, so the core
// never needs to know whether a seat is keyed by nation or settlement.
export type OfficeRosterEntryLike = {
  readonly appointedTurnNumber: number;
  readonly citizenId: string;
  readonly citizenName: string;
  readonly citizenType: Citizen["citizenType"];
  readonly expiresTurnNumber: number | null;
  readonly id: string;
  readonly officeTypeId: string;
  readonly officeTypeName: string;
  readonly termTurns: number | null;
  readonly worldId: string;
};

// Discriminated scope input (#1340). The nation branch carries the government
// type (office-type gating) and a single manage authority; the settlement
// branch splits appoint vs. type-management authority.
export type OfficesSectionProps =
  | {
      readonly scope: "nation";
      readonly canManage: boolean;
      readonly governmentType: NationGovernmentType;
      readonly isArchived: boolean;
      readonly nationId: string;
      readonly nationName: string;
      readonly worldId: string;
    }
  | {
      readonly scope: "settlement";
      readonly canManageSettlement: boolean;
      readonly canManageTypes: boolean;
      readonly isArchived: boolean;
      readonly nationId: string;
      readonly settlementId: string;
      readonly settlementName: string;
      readonly worldId: string;
    };

// Shared government-offices section serving both nation (NationOfficesSection)
// and settlement (SettlementOfficesSection) scopes from one core. Mirrors the
// government-bodies BodiesSection precedent: both scopes' queries/mutations are
// declared with only the active one enabled, keeping each concretely typed.
export function OfficesSection(props: OfficesSectionProps): JSX.Element {
  const isNation = props.scope === "nation";
  const { isArchived, nationId, worldId } = props;
  const settlementId = props.scope === "settlement" ? props.settlementId : "";
  const canAppoint = isNation ? props.canManage : props.canManageSettlement;
  const canManageTypes = isNation ? props.canManage : props.canManageTypes;
  const scopeName = isNation ? props.nationName : props.settlementName;

  const queryClient = useQueryClient();

  const nationRosterQuery = useQuery({
    ...nationOfficesRosterQueryOptions(nationId),
    enabled: isNation,
  });
  const settlementRosterQuery = useQuery({
    ...settlementOfficesRosterQueryOptions(settlementId),
    enabled: !isNation,
  });
  const rosterQuery = isNation ? nationRosterQuery : settlementRosterQuery;

  const nationOfficeTypesQuery = useQuery({
    ...nationOfficeTypesQueryOptions(worldId, nationId),
    enabled: isNation,
  });
  const settlementOfficeTypesQuery = useQuery({
    ...settlementOfficeTypesQueryOptions(worldId, nationId),
    enabled: !isNation,
  });
  const officeTypesQuery = isNation
    ? nationOfficeTypesQuery
    : settlementOfficeTypesQuery;

  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));

  // Both scopes' mutations are created (rules of hooks); only the one matching
  // the scope is ever invoked. Keeping them separate preserves each mutation's
  // concrete input type instead of unioning two incompatible shapes.
  const dismissNationMutation = useMutation(
    dismissNationOfficeMutationOptions({ queryClient }),
  );
  const dismissSettlementMutation = useMutation(
    dismissSettlementOfficeMutationOptions({ queryClient }),
  );
  const renewNationMutation = useMutation(
    renewNationOfficeMutationOptions({ queryClient }),
  );
  const renewSettlementMutation = useMutation(
    renewSettlementOfficeMutationOptions({ queryClient }),
  );
  const dismissPending = isNation
    ? dismissNationMutation.isPending
    : dismissSettlementMutation.isPending;
  const renewPending = isNation
    ? renewNationMutation.isPending
    : renewSettlementMutation.isPending;

  const [isAppointing, setIsAppointing] = useState(false);
  const [isManagingTypes, setIsManagingTypes] = useState(false);
  const [dismissing, setDismissing] = useState<OfficeRosterEntryLike | null>(
    null,
  );

  const headingId = isNation
    ? "nation-offices-heading"
    : "settlement-offices-heading";

  const isLoading = rosterQuery.isPending || officeTypesQuery.isPending;
  const isErrored = rosterQuery.isError || officeTypesQuery.isError;
  if (isLoading || isErrored) {
    return (
      <OfficesCardFrame
        canAppoint={canAppoint}
        canManageTypes={canManageTypes}
        hasAppointableTypes={false}
        headingId={headingId}
        noTypesTooltip={null}
        onAppoint={undefined}
        onManageTypes={undefined}
      >
        {isErrored ? (
          <ErrorState
            title="Offices could not be loaded"
            description={getErrorDescription(
              rosterQuery.error ?? officeTypesQuery.error,
            )}
          />
        ) : (
          <LoadingState label="Loading offices…" />
        )}
      </OfficesCardFrame>
    );
  }

  const allOfficeTypes = officeTypesQuery.data;
  // Nation offices (#1079) are gated to the world-default types this
  // government allows, plus every custom office the nation invented (#1114);
  // settlement offices (#1115) are never government-gated -- all are appointable.
  const appointableTypes = isNation
    ? allOfficeTypes.filter((type) => {
        const allowed = ALLOWED_NATION_OFFICE_TYPES[
          props.governmentType
        ] as readonly string[];
        return (
          (type.nationId === null && allowed.includes(type.name)) ||
          type.nationId === nationId
        );
      })
    : allOfficeTypes;
  const officeTypeById = new Map(allOfficeTypes.map((t) => [t.id, t]));
  const roster: readonly OfficeRosterEntryLike[] = rosterQuery.data;
  const calendarConfig = calendarQuery.data ?? null;

  const rosterByType = new Map<string, OfficeRosterEntryLike[]>();
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

  function handleRenew(entry: OfficeRosterEntryLike): void {
    const options = {
      onError: (error: unknown) => {
        notifyMutationError(error, "Failed to renew office holder.");
      },
      onSuccess: () => {
        notifyMutationSuccess(`${entry.citizenName}'s term renewed.`);
      },
    };
    if (isNation) {
      renewNationMutation.mutate(
        { nationId, officeId: entry.id, worldId },
        options,
      );
    } else {
      renewSettlementMutation.mutate(
        { officeId: entry.id, settlementId, worldId },
        options,
      );
    }
  }

  function handleDismissConfirm(): void {
    if (dismissing === null) return;
    const entry = dismissing;
    const options = {
      onError: (error: unknown) => {
        notifyMutationError(error, "Failed to dismiss office holder.");
      },
      onSuccess: () => {
        notifyMutationSuccess(`${entry.citizenName} dismissed.`);
        setDismissing(null);
      },
    };
    if (isNation) {
      dismissNationMutation.mutate(
        { nationId, officeId: entry.id, worldId },
        options,
      );
    } else {
      dismissSettlementMutation.mutate(
        { officeId: entry.id, settlementId, worldId },
        options,
      );
    }
  }

  const emptyState = isNation
    ? {
        title: "No offices for this government",
        description: `${scopeName}'s government does not define any appointable offices.`,
      }
    : {
        title: "No settlement offices yet",
        description: `${scopeName} has no office types yet. ${
          canManageTypes
            ? "Invent one from Manage office types."
            : "Ask your nation manager to invent one."
        }`,
      };

  return (
    <>
      <OfficesCardFrame
        canAppoint={canAppoint}
        canManageTypes={canManageTypes}
        hasAppointableTypes={appointableTypes.length > 0}
        headingId={headingId}
        noTypesTooltip={
          isNation
            ? "This nation's government has no offices to appoint."
            : null
        }
        onAppoint={isArchived ? undefined : () => setIsAppointing(true)}
        onManageTypes={isArchived ? undefined : () => setIsManagingTypes(true)}
      >
        {appointableTypes.length === 0 ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
          />
        ) : (
          <div className="grid gap-4">
            {[...rosterByType.entries()].map(([officeTypeId, entries]) => {
              const officeType = officeTypeById.get(officeTypeId);
              return officeType === undefined ? null : (
                <OfficeGroup
                  calendarConfig={calendarConfig}
                  canManage={canAppoint}
                  entries={entries}
                  isArchived={isArchived}
                  key={officeTypeId}
                  officeType={officeType}
                  onDismiss={setDismissing}
                  onRenew={handleRenew}
                  renewPending={renewPending}
                />
              );
            })}
          </div>
        )}
      </OfficesCardFrame>

      {canAppoint && isAppointing ? (
        <AppointOfficeDialog
          appointableTypes={appointableTypes}
          nationId={nationId}
          onClose={() => setIsAppointing(false)}
          queryClient={queryClient}
          roster={roster}
          scope={props.scope}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}

      {canManageTypes && isManagingTypes ? (
        <OfficeTypeManagerDialog
          allOfficeTypes={allOfficeTypes}
          canEdit={isNation}
          confirmDelete={isNation}
          description={
            isNation
              ? `Invent custom offices for ${scopeName}. World-default offices are managed by world admins.`
              : `Invent custom offices (mayor, sheriff, guildmaster, ...) for ${scopeName}. World-default offices are managed by world admins.`
          }
          isArchived={isArchived}
          namePlaceholder={
            isNation ? "Lord Commander of the Night Watch" : "Mayor"
          }
          nationId={nationId}
          onClose={() => setIsManagingTypes(false)}
          roster={roster}
          scope={props.scope}
          showWorldDefaultsWhenEmpty={isNation}
          title={
            isNation ? "Manage office types" : "Manage settlement office types"
          }
          worldId={worldId}
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
            <AlertDialogCancel disabled={dismissPending}>
              Keep office holder
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDismissConfirm}
              disabled={dismissPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {dismissPending ? "Dismissing…" : "Dismiss"}
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
  readonly calendarConfig: CalendarConfig;
  readonly canManage: boolean;
  readonly entries: readonly OfficeRosterEntryLike[];
  readonly isArchived: boolean;
  readonly officeType: OfficeType;
  readonly onDismiss: (entry: OfficeRosterEntryLike) => void;
  readonly onRenew: (entry: OfficeRosterEntryLike) => void;
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
  nationId,
  onClose,
  queryClient,
  roster,
  scope,
  settlementId,
  worldId,
}: {
  readonly appointableTypes: readonly OfficeType[];
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly roster: readonly OfficeRosterEntryLike[];
  readonly scope: OfficeTypeScope;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const isNation = scope === "nation";
  const [officeTypeId, setOfficeTypeId] = useState<string>(
    appointableTypes[0]?.id ?? "",
  );
  const [citizenId, setCitizenId] = useState<string>("");
  const [termTurns, setTermTurns] = useState<string>(
    appointableTypes[0]?.defaultTermTurns?.toString() ?? "",
  );

  const nationCitizensQuery = useQuery({
    ...playerCharactersInNationQueryOptions(nationId),
    enabled: isNation,
  });
  const settlementCitizensQuery = useQuery({
    ...citizensInSettlementQueryOptions(settlementId),
    enabled: !isNation,
  });
  const citizensQuery = isNation
    ? nationCitizensQuery
    : settlementCitizensQuery;
  const appointNationMutation = useMutation(
    appointNationOfficeMutationOptions({ queryClient }),
  );
  const appointSettlementMutation = useMutation(
    appointSettlementOfficeMutationOptions({ queryClient }),
  );
  const appointPending = isNation
    ? appointNationMutation.isPending
    : appointSettlementMutation.isPending;

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
    const options = {
      onError: (error: unknown) => {
        notifyMutationError(error, "Failed to appoint office holder.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Office holder appointed.");
        onClose();
      },
    };
    if (isNation) {
      appointNationMutation.mutate(
        {
          citizenId,
          nationId,
          officeType: selectedType.name,
          termTurns: parsedTermTurns,
          worldId,
        },
        options,
      );
    } else {
      appointSettlementMutation.mutate(
        {
          citizenId,
          officeType: selectedType.name,
          settlementId,
          termTurns: parsedTermTurns,
          worldId,
        },
        options,
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appoint office holder</DialogTitle>
          <DialogDescription>
            {isNation
              ? "Choose an office and an eligible citizen of this nation."
              : "Choose an office and an eligible resident of this settlement."}
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
                <SelectValue placeholder="Select an office" />
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
            disabled={appointPending || citizenId === "" || atCapacity}
          >
            {appointPending ? "Appointing…" : "Appoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// #1114/#1115: nation managers (and world admins) invent/edit/delete custom
// offices; settlements reuse this dialog with `canEdit` off. World-default
// offices are listed for context only. The create/update/delete mutations are
// scope-agnostic already, so only labels and capability flags differ.
function OfficeTypeManagerDialog({
  allOfficeTypes,
  canEdit,
  confirmDelete,
  description,
  isArchived,
  namePlaceholder,
  nationId,
  onClose,
  roster,
  scope,
  showWorldDefaultsWhenEmpty,
  title,
  worldId,
}: {
  readonly allOfficeTypes: readonly OfficeType[];
  readonly canEdit: boolean;
  readonly confirmDelete: boolean;
  readonly description: string;
  readonly isArchived: boolean;
  readonly namePlaceholder: string;
  readonly nationId: string;
  readonly onClose: () => void;
  readonly roster: readonly OfficeRosterEntryLike[];
  readonly scope: OfficeTypeScope;
  readonly showWorldDefaultsWhenEmpty: boolean;
  readonly title: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [maxHolders, setMaxHolders] = useState("");
  const [defaultTermTurns, setDefaultTermTurns] = useState("");
  const [excludesFromLabor, setExcludesFromLabor] = useState(true);
  const [deletingType, setDeletingType] = useState<OfficeType | null>(null);

  const createMutation = useMutation(
    createOfficeTypeMutationOptions({ queryClient }),
  );
  const updateMutation = useMutation(
    updateOfficeTypeMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteOfficeTypeMutationOptions({ queryClient }),
  );

  const customTypes = allOfficeTypes.filter((t) => t.nationId === nationId);
  const defaultTypes = allOfficeTypes.filter((t) => t.nationId === null);
  const holderCountByType = new Map<string, number>();
  for (const entry of roster) {
    holderCountByType.set(
      entry.officeTypeId,
      (holderCountByType.get(entry.officeTypeId) ?? 0) + 1,
    );
  }

  function resetForm(): void {
    setEditingId(null);
    setName("");
    setMaxHolders("");
    setDefaultTermTurns("");
    setExcludesFromLabor(true);
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
        nationId,
        scope,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to create office type.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmed} created.`);
          resetForm();
        },
      },
    );
  }

  function handleStartEdit(type: OfficeType): void {
    setEditingId(type.id);
    setName(type.name);
    setMaxHolders(type.maxHolders === null ? "" : String(type.maxHolders));
    setDefaultTermTurns(
      type.defaultTermTurns === null ? "" : String(type.defaultTermTurns),
    );
    setExcludesFromLabor(type.excludesFromLabor);
  }

  function handleSave(): void {
    const trimmed = name.trim();
    if (trimmed === "") return;
    if (!canEdit || editingId === null) {
      handleCreate();
      return;
    }
    updateMutation.mutate(
      {
        defaultTermTurns:
          defaultTermTurns === "" ? null : Number(defaultTermTurns),
        excludesFromLabor,
        id: editingId,
        maxHolders: maxHolders === "" ? null : Number(maxHolders),
        name: trimmed,
        nationId,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update office type.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmed} updated.`);
          resetForm();
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
          setDeletingType(null);
        },
      },
    );
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {showWorldDefaultsWhenEmpty || defaultTypes.length > 0 ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">World defaults</h3>
              {defaultTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="grid gap-1 text-sm text-muted-foreground">
                  {defaultTypes.map((type) => (
                    <li key={type.id}>{formatNationOfficeType(type.name)}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

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
                    <div className="flex gap-2">
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isArchived}
                          onClick={() => handleStartEdit(type)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          isArchived ||
                          deleteMutation.isPending ||
                          (holderCountByType.get(type.id) ?? 0) > 0
                        }
                        onClick={() =>
                          confirmDelete
                            ? setDeletingType(type)
                            : handleDelete(type)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isArchived ? null : (
            <div className="grid gap-2 border-t border-border pt-3">
              <h3 className="text-sm font-medium">
                {canEdit && editingId !== null
                  ? "Edit custom office"
                  : "New custom office"}
              </h3>
              <div className="grid gap-1">
                <Label htmlFor="new-office-type-name">Name</Label>
                <Input
                  id="new-office-type-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={namePlaceholder}
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
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    name.trim() === ""
                  }
                  className="w-fit"
                >
                  {formSubmitLabel({
                    isCreating: createMutation.isPending,
                    isEditing: canEdit && editingId !== null,
                    isSaving: updateMutation.isPending,
                  })}
                </Button>
                {canEdit && editingId !== null ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className="w-fit"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDelete ? (
        <ConfirmDialog
          open={deletingType !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingType(null);
          }}
          title="Delete office type?"
          description={
            deletingType === null
              ? ""
              : `This will permanently delete ${formatNationOfficeType(deletingType.name)}. This action cannot be undone.`
          }
          confirmLabel="Delete"
          isPending={deleteMutation.isPending}
          onConfirm={() => {
            if (deletingType !== null) handleDelete(deletingType);
          }}
        />
      ) : null}
    </>
  );
}

function OfficesCardFrame({
  canAppoint,
  canManageTypes,
  children,
  hasAppointableTypes,
  headingId,
  noTypesTooltip,
  onAppoint,
  onManageTypes,
}: {
  readonly canAppoint: boolean;
  readonly canManageTypes: boolean;
  readonly children: JSX.Element;
  readonly hasAppointableTypes: boolean;
  readonly headingId: string;
  readonly noTypesTooltip: string | null;
  readonly onAppoint: (() => void) | undefined;
  readonly onManageTypes: (() => void) | undefined;
}): JSX.Element {
  // Nation (noTypesTooltip set) disables appointing until an office exists and
  // explains why; settlement (null) never gates the button.
  const appointDisabled = noTypesTooltip !== null && !hasAppointableTypes;
  const appointButton =
    canAppoint && onAppoint !== undefined ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={appointDisabled}
        onClick={onAppoint}
      >
        Appoint office holder
      </Button>
    ) : null;
  return (
    <Card aria-labelledby={headingId} className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-medium">
          Government offices
        </h2>
        <div className="flex gap-2">
          {canManageTypes && onManageTypes !== undefined ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onManageTypes}
            >
              Manage office types
            </Button>
          ) : null}
          {appointButton !== null && appointDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{appointButton}</span>
              </TooltipTrigger>
              <TooltipContent>{noTypesTooltip}</TooltipContent>
            </Tooltip>
          ) : (
            appointButton
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

function formSubmitLabel({
  isCreating,
  isEditing,
  isSaving,
}: {
  readonly isCreating: boolean;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
}): string {
  if (!isEditing) {
    return isCreating ? "Creating…" : "Create office";
  }
  return isSaving ? "Saving…" : "Save changes";
}
