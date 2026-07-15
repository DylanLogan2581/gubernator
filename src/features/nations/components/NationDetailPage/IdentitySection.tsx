import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Landmark, Pencil, Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  worldCalendarConfigQueryOptions,
  WorldDatePicker,
  type CalendarDateInput,
  type WorldCalendarConfig,
} from "@/features/calendar";
import {
  managerScopeLabel,
  playerCharactersInNationQueryOptions,
} from "@/features/citizens";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { useActivePlayerCharacter } from "@/features/permissions";
import { religionsByWorldQueryOptions } from "@/features/religions";
import { notifyMutationError } from "@/lib/notify";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import {
  setNationCapitalAndFoundedTurnMutationOptions,
  setNationGovernmentTypeMutationOptions,
} from "../../mutations/nationsMutations";
import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";
import {
  NATION_GOVERNMENT_TYPES,
  formatNationGovernmentType,
} from "../../types/nationTypes";

import type {
  Nation,
  NationGovernmentType,
  NationSettlement,
} from "../../types/nationTypes";

/**
 * Identity summary for a nation: current ruler (nation manager), capital
 * settlement, and founding turn. Capital and founded turn are both written
 * through set_nation_capital_and_founded_turn, so editing either one submits
 * both fields together (mirrors the RPC contract).
 */
export function NationIdentitySection({
  canAdminWorld,
  currentTurnNumber,
  isArchived,
  nation,
  queryClient,
}: {
  readonly canAdminWorld: boolean;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const citizensQuery = useQuery(
    playerCharactersInNationQueryOptions(nation.id),
  );
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nation.id));
  const calendarConfigQuery = useQuery(
    worldCalendarConfigQueryOptions(nation.worldId),
  );
  const culturesQuery = useQuery(culturesByWorldQueryOptions(nation.worldId));
  const religionsQuery = useQuery(religionsByWorldQueryOptions(nation.worldId));

  // Mirrors the visibility check in NationRoleAssignmentSection/
  // NationGovernmentRoute — capital and founded turn are editable by world
  // admins and by this nation's own (alive) nation_manager citizen.
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canEdit = (canAdminWorld || isNationManager) && !isArchived;
  // Government type is admin-arbitrated roleplay: unlike capital/founded
  // turn, the nation manager never gets an edit control here.
  const canEditGovernmentType = canAdminWorld && !isArchived;

  const ruler =
    citizensQuery.data?.find(
      (citizen) =>
        managerScopeLabel(citizen.roleType) === "nation" &&
        citizen.roleNationId === nation.id,
    ) ?? null;
  const capital =
    settlementsQuery.data?.find(
      (settlement) => settlement.id === nation.capitalSettlementId,
    ) ?? null;
  const culture =
    culturesQuery.data?.find((c) => c.id === nation.primaryCultureId) ?? null;
  const religion =
    religionsQuery.data?.find((r) => r.id === nation.stateReligionId) ?? null;

  return (
    <Card aria-labelledby="nation-identity-heading" className="grid gap-4 p-4">
      <div className="flex items-center gap-2">
        <Landmark aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="nation-identity-heading" className="text-base font-medium">
          Identity
        </h2>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <IdentityReadout label="Ruler">
          {citizensQuery.isPending ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : ruler === null ? (
            <span className="text-sm italic text-muted-foreground">Vacant</span>
          ) : (
            <Link
              to="/worlds/$worldId/citizens/$citizenId"
              params={{ citizenId: ruler.id, worldId: nation.worldId }}
              search={{}}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {ruler.name}
            </Link>
          )}
        </IdentityReadout>

        <IdentityReadout
          label="Capital"
          action={
            canEdit ? (
              <CapitalPickerDialog
                nation={nation}
                queryClient={queryClient}
                settlements={settlementsQuery.data ?? []}
              />
            ) : null
          }
        >
          {settlementsQuery.isPending ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : capital === null ? (
            <span className="text-sm italic text-muted-foreground">
              Not set
            </span>
          ) : (
            <Link
              to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
              params={{
                nationId: nation.id,
                settlementId: capital.id,
                worldId: nation.worldId,
              }}
              search={{}}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {capital.name}
            </Link>
          )}
        </IdentityReadout>

        <IdentityReadout
          label="Founded"
          action={
            canEdit ? (
              <FoundedTurnEditor
                calendarConfig={calendarConfigQuery.data ?? null}
                currentTurnNumber={currentTurnNumber}
                nation={nation}
                queryClient={queryClient}
              />
            ) : null
          }
        >
          <span className="text-sm">
            {formatFoundedTurn(
              nation.foundedTurnNumber,
              calendarConfigQuery.data ?? null,
            )}
          </span>
        </IdentityReadout>

        <IdentityReadout
          label="Government"
          action={
            canEditGovernmentType ? (
              <GovernmentTypeEditor nation={nation} queryClient={queryClient} />
            ) : null
          }
        >
          <span className="text-sm">
            {formatNationGovernmentType(nation.governmentType)}
          </span>
        </IdentityReadout>

        <IdentityReadout label="Culture">
          {culturesQuery.isPending ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : culture === null ? (
            <span className="text-sm italic text-muted-foreground">None</span>
          ) : (
            <IdentityChip color={culture.color} name={culture.name} />
          )}
        </IdentityReadout>

        <IdentityReadout label="Religion">
          {religionsQuery.isPending ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : religion === null ? (
            <span className="text-sm italic text-muted-foreground">None</span>
          ) : (
            <IdentityChip color={religion.color} name={religion.name} />
          )}
        </IdentityReadout>
      </dl>
    </Card>
  );
}

function IdentityChip({
  color,
  name,
}: {
  readonly color: string;
  readonly name: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}

function IdentityReadout({
  action,
  children,
  label,
}: {
  readonly action?: JSX.Element | null;
  readonly children: JSX.Element;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        {action ?? null}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

// Exported for reuse by the nation charter page header (#1122) -- not a
// component, so fast refresh can't treat this export like the rest of the
// file's -- an isolated, deliberate exception.
// eslint-disable-next-line react-refresh/only-export-components
export function formatFoundedTurn(
  foundedTurnNumber: number | null,
  calendarConfig: Parameters<typeof resolveTurnCalendarDate>[0] | null,
): string {
  if (foundedTurnNumber === null) {
    return "Unknown";
  }
  if (foundedTurnNumber < 1 || calendarConfig === null) {
    return `Turn ${String(foundedTurnNumber)}`;
  }
  try {
    return formatCalendarDate(
      resolveTurnCalendarDate(calendarConfig, foundedTurnNumber),
      { dateFormatTemplate: calendarConfig.dateFormatTemplate },
    );
  } catch {
    return `Turn ${String(foundedTurnNumber)}`;
  }
}

function CapitalPickerDialog({
  nation,
  queryClient,
  settlements,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
  readonly settlements: readonly NationSettlement[];
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSettlementId, setSelectedSettlementId] = useState(
    nation.capitalSettlementId ?? "",
  );

  const setCapitalMutation = useMutation(
    setNationCapitalAndFoundedTurnMutationOptions({ queryClient }),
  );

  function openDialog(): void {
    setSelectedSettlementId(nation.capitalSettlementId ?? "");
    setCapitalMutation.reset();
    setIsOpen(true);
  }

  function closeDialog(): void {
    setIsOpen(false);
    setCapitalMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCapitalMutation.mutate(
      {
        capitalSettlementId:
          selectedSettlementId === "" ? null : selectedSettlementId,
        foundedTurnNumber: nation.foundedTurnNumber,
        nationId: nation.id,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update capital.");
        },
        onSuccess: () => {
          setIsOpen(false);
        },
      },
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openDialog}
        aria-label="Change capital"
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change capital</DialogTitle>
          </DialogHeader>
          <form
            aria-label="Change capital"
            className="grid gap-3"
            noValidate
            onSubmit={handleSubmit}
          >
            <Label
              className="grid gap-1 text-sm"
              htmlFor="nation-capital-select"
            >
              <span className="text-muted-foreground">Capital settlement</span>
              <select
                id="nation-capital-select"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={setCapitalMutation.isPending}
                value={selectedSettlementId}
                onChange={(event) => {
                  setSelectedSettlementId(event.currentTarget.value);
                }}
              >
                <option value="">None</option>
                {settlements.map((settlement) => (
                  <option key={settlement.id} value={settlement.id}>
                    {settlement.name}
                  </option>
                ))}
              </select>
            </Label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={setCapitalMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={setCapitalMutation.isPending}>
                <Save aria-hidden="true" />
                {setCapitalMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GovernmentTypeEditor({
  nation,
  queryClient,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [governmentType, setGovernmentType] = useState<NationGovernmentType>(
    nation.governmentType,
  );

  const setGovernmentTypeMutation = useMutation(
    setNationGovernmentTypeMutationOptions({ queryClient }),
  );

  function openDialog(): void {
    setGovernmentType(nation.governmentType);
    setGovernmentTypeMutation.reset();
    setIsOpen(true);
  }

  function closeDialog(): void {
    setIsOpen(false);
    setGovernmentTypeMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setGovernmentTypeMutation.mutate(
      {
        governmentType,
        nationId: nation.id,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update government type.");
        },
        onSuccess: () => {
          setIsOpen(false);
        },
      },
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openDialog}
        aria-label="Change government type"
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change government type</DialogTitle>
          </DialogHeader>
          <form
            aria-label="Change government type"
            className="grid gap-3"
            noValidate
            onSubmit={handleSubmit}
          >
            <Label
              className="grid gap-1 text-sm"
              htmlFor="nation-government-type-select"
            >
              <span className="text-muted-foreground">Government type</span>
              <select
                id="nation-government-type-select"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={setGovernmentTypeMutation.isPending}
                value={governmentType}
                onChange={(event) => {
                  setGovernmentType(
                    event.currentTarget.value as NationGovernmentType,
                  );
                }}
              >
                {NATION_GOVERNMENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {formatNationGovernmentType(option)}
                  </option>
                ))}
              </select>
            </Label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={setGovernmentTypeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={setGovernmentTypeMutation.isPending}
              >
                <Save aria-hidden="true" />
                {setGovernmentTypeMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FoundedTurnEditor({
  calendarConfig,
  currentTurnNumber,
  nation,
  queryClient,
}: {
  readonly calendarConfig: WorldCalendarConfig | null;
  readonly currentTurnNumber: number;
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [foundedTurnNumber, setFoundedTurnNumber] = useState<number | null>(
    nation.foundedTurnNumber,
  );

  const setFoundedTurnMutation = useMutation(
    setNationCapitalAndFoundedTurnMutationOptions({ queryClient }),
  );

  function openEditor(): void {
    setFoundedTurnNumber(nation.foundedTurnNumber);
    setFoundedTurnMutation.reset();
    setIsEditing(true);
  }

  function closeEditor(): void {
    setIsEditing(false);
    setFoundedTurnMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    setFoundedTurnMutation.mutate(
      {
        capitalSettlementId: nation.capitalSettlementId,
        foundedTurnNumber,
        nationId: nation.id,
        worldId: nation.worldId,
      },
      {
        onError: (mutationError) => {
          notifyMutationError(mutationError, "Failed to update founded turn.");
        },
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  let foundedTurnDate: CalendarDateInput | null = null;
  if (
    calendarConfig !== null &&
    foundedTurnNumber !== null &&
    foundedTurnNumber >= 1
  ) {
    try {
      const resolved = resolveTurnCalendarDate(
        calendarConfig,
        foundedTurnNumber,
      );
      foundedTurnDate = {
        year: resolved.year,
        monthIndex: resolved.monthIndex,
        dayOfMonth: resolved.dayOfMonth,
      };
    } catch {
      foundedTurnDate = null;
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openEditor}
        aria-label="Edit founded turn"
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit founded turn</DialogTitle>
          </DialogHeader>
          <form
            aria-label="Edit founded turn"
            className="grid gap-3"
            noValidate
            onSubmit={handleSubmit}
          >
            {calendarConfig === null ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : (
              <WorldDatePicker
                config={calendarConfig}
                currentTurnNumber={currentTurnNumber}
                label="Select founded date"
                value={foundedTurnDate}
                onTurnNumberChange={setFoundedTurnNumber}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={setFoundedTurnMutation.isPending}
                onClick={() => {
                  setFoundedTurnNumber(null);
                }}
                aria-label="Clear founded turn"
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeEditor}
                disabled={setFoundedTurnMutation.isPending}
                aria-label="Cancel edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  setFoundedTurnMutation.isPending || calendarConfig === null
                }
                aria-label="Save founded turn"
              >
                <Save aria-hidden="true" />
                {setFoundedTurnMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
