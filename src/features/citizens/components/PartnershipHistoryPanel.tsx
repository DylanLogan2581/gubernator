import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Heart, HeartCrack, Pencil, Save, UserPlus, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  currentTurnStateQueryOptions,
  latestTurnTransitionStatusQueryOptions,
} from "@/features/turns";

import {
  createPartnershipMutationOptions,
  dissolvePartnershipMutationOptions,
  isPartnershipMutationError,
  markPartnershipWidowedMutationOptions,
  reassignPartnerMutationOptions,
} from "../mutations/partnershipsMutations";
import {
  citizenByIdQueryOptions,
  unpairedAliveCitizensInWorldQueryOptions,
} from "../queries/citizensQueries";
import { partnershipsForCitizenQueryOptions } from "../queries/partnershipsQueries";

import type { Citizen } from "../types/citizenTypes";
import type { Partnership, PartnershipStatus } from "../types/partnershipTypes";

type PartnershipHistoryPanelProps = {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly isArchived?: boolean;
};

type RowAction = "dissolve" | "widow" | "reassign";

export function PartnershipHistoryPanel({
  canAdmin,
  citizen,
  isArchived = false,
}: PartnershipHistoryPanelProps): JSX.Element {
  const partnershipsQuery = useQuery(
    partnershipsForCitizenQueryOptions(citizen.id),
  );
  const latestTransitionQuery = useQuery({
    ...latestTurnTransitionStatusQueryOptions(citizen.worldId),
    enabled: canAdmin,
  });
  const currentTurnQuery = useQuery({
    ...currentTurnStateQueryOptions(citizen.worldId),
    enabled: canAdmin,
  });

  const turnTransitionId = latestTransitionQuery.data?.id ?? null;
  const currentTurnNumber = currentTurnQuery.data?.currentTurnNumber ?? null;
  const adminReady =
    canAdmin &&
    !isArchived &&
    turnTransitionId !== null &&
    currentTurnNumber !== null;

  const adminUnavailableReason = canAdmin
    ? getAdminUnavailableReason({
        currentTurnQuery,
        isArchived,
        latestTransitionQuery,
      })
    : null;

  const partnerships = partnershipsQuery.data ?? [];
  const hasActive = partnerships.some(
    (partnership) => partnership.status === "active",
  );

  const [openAction, setOpenAction] = useState<{
    readonly id: string;
    readonly kind: RowAction;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <section
      aria-labelledby="citizen-partnerships-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2
            id="citizen-partnerships-heading"
            className="text-base font-medium"
          >
            Partnership history
          </h2>
          <p className="text-sm text-muted-foreground">
            Active and past partnerships for this citizen.
          </p>
        </div>
        {canAdmin && !hasActive && !isCreating ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!adminReady}
            title={adminUnavailableReason ?? undefined}
            onClick={() => setIsCreating(true)}
          >
            <UserPlus aria-hidden="true" />
            Create partnership
          </Button>
        ) : null}
      </div>

      {canAdmin && adminUnavailableReason !== null ? (
        <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {adminUnavailableReason}
        </p>
      ) : null}

      {canAdmin && isCreating && adminReady ? (
        <CreatePartnershipForm
          focalCitizen={citizen}
          formedOnTurnNumber={currentTurnNumber}
          onClose={() => setIsCreating(false)}
          turnTransitionId={turnTransitionId}
        />
      ) : null}

      {partnershipsQuery.isPending ? (
        <LoadingState label="Loading partnerships…" />
      ) : partnershipsQuery.isError ? (
        <ErrorState
          title="Partnerships could not be loaded"
          description={getErrorDescription(partnershipsQuery.error)}
        />
      ) : partnerships.length === 0 ? (
        <EmptyState
          title="No partnerships"
          description="This citizen has no partnership records yet."
        />
      ) : (
        <ul aria-label="Partnerships" className="grid gap-2">
          {partnerships.map((partnership) => {
            const isThisRowActive = partnership.status === "active";
            const rowAdminReady = adminReady && isThisRowActive;
            const openKind =
              openAction?.id === partnership.id ? openAction.kind : null;
            return (
              <PartnershipRow
                key={partnership.id}
                canAdmin={canAdmin}
                currentTurnNumber={currentTurnNumber}
                focalCitizen={citizen}
                onCloseAction={() => setOpenAction(null)}
                onOpenAction={(kind) =>
                  setOpenAction({ id: partnership.id, kind })
                }
                openAction={openKind}
                partnership={partnership}
                rowAdminReady={rowAdminReady}
                turnTransitionId={turnTransitionId}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PartnershipRow({
  canAdmin,
  currentTurnNumber,
  focalCitizen,
  onCloseAction,
  onOpenAction,
  openAction,
  partnership,
  rowAdminReady,
  turnTransitionId,
}: {
  readonly canAdmin: boolean;
  readonly currentTurnNumber: number | null;
  readonly focalCitizen: Citizen;
  readonly onCloseAction: () => void;
  readonly onOpenAction: (kind: RowAction) => void;
  readonly openAction: RowAction | null;
  readonly partnership: Partnership;
  readonly rowAdminReady: boolean;
  readonly turnTransitionId: string | null;
}): JSX.Element {
  const partnerId =
    partnership.citizenAId === focalCitizen.id
      ? partnership.citizenBId
      : partnership.citizenAId;
  const partnerQuery = useQuery(citizenByIdQueryOptions(partnerId));
  const partner = partnerQuery.data ?? null;
  const isCrossSettlement =
    partner !== null && partner.settlementId !== focalCitizen.settlementId;

  return (
    <li className="grid gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Partner:</span>
          <PartnerLink
            partner={partner}
            partnerId={partnerId}
            queryError={partnerQuery.isError}
            queryPending={partnerQuery.isPending}
            worldId={focalCitizen.worldId}
          />
          {isCrossSettlement ? (
            <span
              className="inline-flex items-center rounded-sm bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
              title="Partner belongs to a different settlement."
            >
              Cross-settlement
            </span>
          ) : null}
          <PartnershipStatusChip status={partnership.status} />
        </div>
        {canAdmin && partnership.status === "active" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rowAdminReady}
              onClick={() => onOpenAction("dissolve")}
            >
              <HeartCrack aria-hidden="true" />
              Dissolve
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rowAdminReady}
              onClick={() => onOpenAction("widow")}
            >
              <Heart aria-hidden="true" />
              Mark widowed
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rowAdminReady}
              onClick={() => onOpenAction("reassign")}
            >
              <Pencil aria-hidden="true" />
              Reassign
            </Button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Formed on turn {partnership.formedOnTurnNumber}
        {partnership.endedOnTurnNumber === null
          ? ""
          : ` · Ended on turn ${partnership.endedOnTurnNumber}`}
      </p>
      {partnership.changeReason === null ? null : (
        <p className="text-xs italic text-muted-foreground">
          “{partnership.changeReason}”
        </p>
      )}
      {openAction === "dissolve" &&
      rowAdminReady &&
      turnTransitionId !== null ? (
        <EndPartnershipForm
          defaultTurnNumber={
            currentTurnNumber ?? partnership.formedOnTurnNumber
          }
          kind="dissolve"
          onClose={onCloseAction}
          partnership={partnership}
          turnTransitionId={turnTransitionId}
        />
      ) : null}
      {openAction === "widow" && rowAdminReady && turnTransitionId !== null ? (
        <EndPartnershipForm
          defaultTurnNumber={
            currentTurnNumber ?? partnership.formedOnTurnNumber
          }
          kind="widow"
          onClose={onCloseAction}
          partnership={partnership}
          turnTransitionId={turnTransitionId}
        />
      ) : null}
      {openAction === "reassign" &&
      rowAdminReady &&
      turnTransitionId !== null &&
      currentTurnNumber !== null ? (
        <ReassignPartnerForm
          currentTurnNumber={currentTurnNumber}
          focalCitizen={focalCitizen}
          onClose={onCloseAction}
          partnership={partnership}
          retainedCitizenId={focalCitizen.id}
          turnTransitionId={turnTransitionId}
        />
      ) : null}
    </li>
  );
}

function PartnerLink({
  partner,
  partnerId,
  queryError,
  queryPending,
  worldId,
}: {
  readonly partner: Citizen | null;
  readonly partnerId: string;
  readonly queryError: boolean;
  readonly queryPending: boolean;
  readonly worldId: string;
}): JSX.Element {
  if (queryPending) {
    return (
      <span className="text-xs italic text-muted-foreground">Loading…</span>
    );
  }
  if (queryError || partner === null) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {partnerId}
      </span>
    );
  }
  return (
    <Link
      to="/worlds/$worldId/citizens/$citizenId"
      params={{ citizenId: partner.id, worldId }}
      className="text-sm font-medium underline-offset-2 hover:underline"
    >
      {partner.name}
    </Link>
  );
}

function CreatePartnershipForm({
  focalCitizen,
  formedOnTurnNumber,
  onClose,
  turnTransitionId,
}: {
  readonly focalCitizen: Citizen;
  readonly formedOnTurnNumber: number;
  readonly onClose: () => void;
  readonly turnTransitionId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const candidatesQuery = useQuery(
    unpairedAliveCitizensInWorldQueryOptions(focalCitizen.worldId),
  );
  const mutation = useMutation(
    createPartnershipMutationOptions({ queryClient }),
  );

  const [partnerId, setPartnerId] = useState("");
  const [turnNumber, setTurnNumber] = useState(String(formedOnTurnNumber));
  const [changeReason, setChangeReason] = useState("");
  const [includeOtherSettlements, setIncludeOtherSettlements] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const candidates = usePartnerCandidates({
    allCandidates: candidatesQuery.data,
    excludeCitizenId: focalCitizen.id,
    focalSettlementId: focalCitizen.settlementId,
    includeOtherSettlements,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);
    mutation.reset();

    if (partnerId === "") {
      setFieldError("Pick a partner before creating the partnership.");
      return;
    }
    const parsedTurn = Number.parseInt(turnNumber, 10);
    if (!Number.isFinite(parsedTurn) || parsedTurn < 0) {
      setFieldError("Formed turn must be a non-negative integer.");
      return;
    }
    if (changeReason.trim().length === 0) {
      setFieldError("Change reason is required.");
      return;
    }

    mutation.mutate(
      {
        changeReason,
        citizenAId: focalCitizen.id,
        citizenBId: partnerId,
        formedOnTurnNumber: parsedTurn,
        status: "active",
        turnTransitionId,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form
      aria-label="Create partnership"
      className="grid gap-2 rounded-md border border-border bg-background px-3 py-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Create partnership</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Cancel create partnership"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <PartnerPicker
        candidates={candidates}
        disabled={mutation.isPending || candidatesQuery.isPending}
        focalSettlementId={focalCitizen.settlementId}
        includeOtherSettlements={includeOtherSettlements}
        label="Partner"
        onChange={setPartnerId}
        onToggleScope={setIncludeOtherSettlements}
        value={partnerId}
      />
      <TurnNumberField
        disabled={mutation.isPending}
        label="Formed on turn"
        onChange={setTurnNumber}
        value={turnNumber}
      />
      <ChangeReasonField
        disabled={mutation.isPending}
        onChange={setChangeReason}
        value={changeReason}
      />
      <FormError
        fieldError={fieldError}
        mutationError={mutation.isError ? mutation.error : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <Save aria-hidden="true" />
          {mutation.isPending ? "Creating…" : "Create partnership"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EndPartnershipForm({
  defaultTurnNumber,
  kind,
  onClose,
  partnership,
  turnTransitionId,
}: {
  readonly defaultTurnNumber: number;
  readonly kind: "dissolve" | "widow";
  readonly onClose: () => void;
  readonly partnership: Partnership;
  readonly turnTransitionId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const dissolveMutation = useMutation(
    dissolvePartnershipMutationOptions({ queryClient }),
  );
  const widowMutation = useMutation(
    markPartnershipWidowedMutationOptions({ queryClient }),
  );
  const mutation = kind === "dissolve" ? dissolveMutation : widowMutation;

  const [endTurn, setEndTurn] = useState(String(defaultTurnNumber));
  const [changeReason, setChangeReason] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);
    mutation.reset();

    const parsedTurn = Number.parseInt(endTurn, 10);
    if (!Number.isFinite(parsedTurn) || parsedTurn < 0) {
      setFieldError("End turn must be a non-negative integer.");
      return;
    }
    if (changeReason.trim().length === 0) {
      setFieldError("Change reason is required.");
      return;
    }

    const input = {
      changeReason,
      endedOnTurnNumber: parsedTurn,
      partnershipId: partnership.id,
      turnTransitionId,
    };

    if (kind === "dissolve") {
      dissolveMutation.mutate(input, { onSuccess: onClose });
    } else {
      widowMutation.mutate(input, { onSuccess: onClose });
    }
  }

  const heading = kind === "dissolve" ? "Dissolve partnership" : "Mark widowed";
  const submitLabel =
    kind === "dissolve"
      ? mutation.isPending
        ? "Dissolving…"
        : "Dissolve"
      : mutation.isPending
        ? "Marking…"
        : "Mark widowed";

  return (
    <form
      aria-label={heading}
      className="grid gap-2 rounded-md border border-border bg-card px-3 py-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{heading}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label={`Cancel ${heading.toLowerCase()}`}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <TurnNumberField
        disabled={mutation.isPending}
        label="Ended on turn"
        onChange={setEndTurn}
        value={endTurn}
      />
      <ChangeReasonField
        disabled={mutation.isPending}
        onChange={setChangeReason}
        value={changeReason}
      />
      <FormError
        fieldError={fieldError}
        mutationError={mutation.isError ? mutation.error : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          variant={kind === "dissolve" ? "destructive" : "default"}
          disabled={mutation.isPending}
        >
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReassignPartnerForm({
  currentTurnNumber,
  focalCitizen,
  onClose,
  partnership,
  retainedCitizenId,
  turnTransitionId,
}: {
  readonly currentTurnNumber: number;
  readonly focalCitizen: Citizen;
  readonly onClose: () => void;
  readonly partnership: Partnership;
  readonly retainedCitizenId: string;
  readonly turnTransitionId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const candidatesQuery = useQuery(
    unpairedAliveCitizensInWorldQueryOptions(focalCitizen.worldId),
  );
  const mutation = useMutation(reassignPartnerMutationOptions({ queryClient }));

  const [newPartnerId, setNewPartnerId] = useState("");
  const [endTurn, setEndTurn] = useState(String(currentTurnNumber));
  const [formedTurn, setFormedTurn] = useState(String(currentTurnNumber));
  const [changeReason, setChangeReason] = useState("");
  const [includeOtherSettlements, setIncludeOtherSettlements] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const candidates = usePartnerCandidates({
    allCandidates: candidatesQuery.data,
    excludeCitizenId: retainedCitizenId,
    focalSettlementId: focalCitizen.settlementId,
    includeOtherSettlements,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);
    mutation.reset();

    if (newPartnerId === "") {
      setFieldError("Pick a new partner before reassigning.");
      return;
    }
    const parsedEnd = Number.parseInt(endTurn, 10);
    const parsedFormed = Number.parseInt(formedTurn, 10);
    if (!Number.isFinite(parsedEnd) || parsedEnd < 0) {
      setFieldError("End turn must be a non-negative integer.");
      return;
    }
    if (!Number.isFinite(parsedFormed) || parsedFormed < 0) {
      setFieldError("New formed turn must be a non-negative integer.");
      return;
    }
    if (changeReason.trim().length === 0) {
      setFieldError("Change reason is required.");
      return;
    }

    mutation.mutate(
      {
        changeReason,
        endedOnTurnNumber: parsedEnd,
        formedOnTurnNumber: parsedFormed,
        newPartnerCitizenId: newPartnerId,
        oldPartnershipId: partnership.id,
        retainedCitizenId,
        turnTransitionId,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form
      aria-label="Reassign partner"
      className="grid gap-2 rounded-md border border-border bg-card px-3 py-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reassign partner</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Cancel reassign partner"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <PartnerPicker
        candidates={candidates}
        disabled={mutation.isPending || candidatesQuery.isPending}
        focalSettlementId={focalCitizen.settlementId}
        includeOtherSettlements={includeOtherSettlements}
        label="New partner"
        onChange={setNewPartnerId}
        onToggleScope={setIncludeOtherSettlements}
        value={newPartnerId}
      />
      <TurnNumberField
        disabled={mutation.isPending}
        label="Old partnership ended on turn"
        onChange={setEndTurn}
        value={endTurn}
      />
      <TurnNumberField
        disabled={mutation.isPending}
        label="New partnership formed on turn"
        onChange={setFormedTurn}
        value={formedTurn}
      />
      <ChangeReasonField
        disabled={mutation.isPending}
        onChange={setChangeReason}
        value={changeReason}
      />
      <FormError
        fieldError={fieldError}
        mutationError={mutation.isError ? mutation.error : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <Save aria-hidden="true" />
          {mutation.isPending ? "Reassigning…" : "Reassign"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PartnerPicker({
  candidates,
  disabled,
  focalSettlementId,
  includeOtherSettlements,
  label,
  onChange,
  onToggleScope,
  value,
}: {
  readonly candidates: readonly Citizen[];
  readonly disabled: boolean;
  readonly focalSettlementId: string | null;
  readonly includeOtherSettlements: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly onToggleScope: (value: boolean) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <label className="grid gap-1">
        <span className="text-muted-foreground">{label}</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          <option value="">Select a citizen…</option>
          {candidates.map((candidate) => {
            const isOther = candidate.settlementId !== focalSettlementId;
            return (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
                {isOther ? " (other settlement)" : ""}
              </option>
            );
          })}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeOtherSettlements}
          disabled={disabled}
          onChange={(event) => onToggleScope(event.currentTarget.checked)}
        />
        Include citizens from other settlements (cross-settlement)
      </label>
    </div>
  );
}

function TurnNumberField({
  disabled,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function ChangeReasonField({
  disabled,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">Change reason</span>
      <Input
        disabled={disabled}
        maxLength={1000}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function FormError({
  fieldError,
  mutationError,
}: {
  readonly fieldError: string | undefined;
  readonly mutationError: unknown;
}): JSX.Element | null {
  const description =
    fieldError ??
    (mutationError === null || mutationError === undefined
      ? null
      : getPartnershipMutationErrorDescription(mutationError));
  if (description === null) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {description}
    </p>
  );
}

function PartnershipStatusChip({
  status,
}: {
  readonly status: PartnershipStatus;
}): JSX.Element {
  const tone =
    status === "active"
      ? "bg-secondary text-secondary-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs ${tone}`}
    >
      {partnershipStatusLabel(status)}
    </span>
  );
}

function usePartnerCandidates({
  allCandidates,
  excludeCitizenId,
  focalSettlementId,
  includeOtherSettlements,
}: {
  readonly allCandidates: readonly Citizen[] | undefined;
  readonly excludeCitizenId: string;
  readonly focalSettlementId: string | null;
  readonly includeOtherSettlements: boolean;
}): readonly Citizen[] {
  return useMemo(() => {
    if (allCandidates === undefined) {
      return [];
    }
    return allCandidates.filter((candidate) => {
      if (candidate.id === excludeCitizenId) {
        return false;
      }
      if (includeOtherSettlements) {
        return true;
      }
      return candidate.settlementId === focalSettlementId;
    });
  }, [
    allCandidates,
    excludeCitizenId,
    focalSettlementId,
    includeOtherSettlements,
  ]);
}

function getAdminUnavailableReason({
  currentTurnQuery,
  isArchived,
  latestTransitionQuery,
}: {
  readonly currentTurnQuery: {
    readonly isError: boolean;
    readonly data: unknown;
  };
  readonly isArchived: boolean;
  readonly latestTransitionQuery: {
    readonly isError: boolean;
    readonly data: unknown;
  };
}): string | null {
  if (isArchived) {
    return "Partnership controls are disabled because this world is archived.";
  }
  if (latestTransitionQuery.isError) {
    return "Could not load the latest turn transition; partnership controls are disabled.";
  }
  if (currentTurnQuery.isError) {
    return "Could not load the current turn; partnership controls are disabled.";
  }
  if (
    latestTransitionQuery.data === null ||
    latestTransitionQuery.data === undefined
  ) {
    return "Partnership controls require at least one recorded turn transition for this world.";
  }
  return null;
}

function partnershipStatusLabel(status: PartnershipStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "dissolved":
      return "Dissolved";
    case "widowed":
      return "Widowed";
  }
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return "Try refreshing the page. If the problem continues, contact an administrator.";
}

function getPartnershipMutationErrorDescription(error: unknown): string {
  if (isPartnershipMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
