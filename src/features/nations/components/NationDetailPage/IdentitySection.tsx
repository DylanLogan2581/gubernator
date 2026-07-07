import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Landmark, Pencil, Save, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";
import {
  managerScopeLabel,
  playerCharactersInNationQueryOptions,
} from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { notifyMutationError } from "@/lib/notify";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import { setNationCapitalAndFoundedTurnMutationOptions } from "../../mutations/nationsMutations";
import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";

import type { Nation, NationSettlement } from "../../types/nationTypes";

/**
 * Identity summary for a nation: current ruler (nation manager), capital
 * settlement, and founding turn. Capital and founded turn are both written
 * through set_nation_capital_and_founded_turn, so editing either one submits
 * both fields together (mirrors the RPC contract).
 */
export function NationIdentitySection({
  canAdminWorld,
  isArchived,
  nation,
  queryClient,
}: {
  readonly canAdminWorld: boolean;
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

  return (
    <Card aria-labelledby="nation-identity-heading" className="grid gap-4 p-4">
      <div className="flex items-center gap-2">
        <Landmark aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="nation-identity-heading" className="text-base font-medium">
          Identity
        </h2>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
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
              <FoundedTurnEditor nation={nation} queryClient={queryClient} />
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
      </dl>
    </Card>
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
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        {action ?? null}
      </div>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function formatFoundedTurn(
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

function FoundedTurnEditor({
  nation,
  queryClient,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [foundedTurnInput, setFoundedTurnInput] = useState(
    nation.foundedTurnNumber === null ? "" : String(nation.foundedTurnNumber),
  );
  const [error, setError] = useState<string | undefined>(undefined);

  const setFoundedTurnMutation = useMutation(
    setNationCapitalAndFoundedTurnMutationOptions({ queryClient }),
  );

  function openEditor(): void {
    setFoundedTurnInput(
      nation.foundedTurnNumber === null ? "" : String(nation.foundedTurnNumber),
    );
    setError(undefined);
    setFoundedTurnMutation.reset();
    setIsEditing(true);
  }

  function closeEditor(): void {
    setIsEditing(false);
    setError(undefined);
    setFoundedTurnMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(undefined);

    const trimmed = foundedTurnInput.trim();
    let foundedTurnNumber: number | null = null;
    if (trimmed.length > 0) {
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError("Founded turn must be a whole number, 0 or greater.");
        return;
      }
      foundedTurnNumber = parsed;
    }

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

  if (!isEditing) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openEditor}
        aria-label="Edit founded turn"
      >
        <Pencil aria-hidden="true" />
      </Button>
    );
  }

  return (
    <form
      aria-label="Edit founded turn"
      className="flex items-center gap-1"
      noValidate
      onSubmit={handleSubmit}
    >
      <Label className="sr-only" htmlFor="nation-founded-turn-input">
        Founded turn
      </Label>
      <Input
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={
          error === undefined ? undefined : "nation-founded-turn-error"
        }
        className="h-8 w-20"
        disabled={setFoundedTurnMutation.isPending}
        id="nation-founded-turn-input"
        inputMode="numeric"
        value={foundedTurnInput}
        onChange={(event) => {
          setFoundedTurnInput(event.currentTarget.value);
          setError(undefined);
        }}
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={setFoundedTurnMutation.isPending}
        aria-label="Save founded turn"
      >
        <Save aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={closeEditor}
        disabled={setFoundedTurnMutation.isPending}
        aria-label="Cancel edit"
      >
        <X aria-hidden="true" />
      </Button>
      {error === undefined ? null : (
        <p
          id="nation-founded-turn-error"
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  );
}
