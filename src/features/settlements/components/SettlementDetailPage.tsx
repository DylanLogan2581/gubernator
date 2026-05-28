import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Pencil, Save, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type JSX, type ReactNode } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CitizensPanel } from "@/features/citizens";
import {
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
} from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type {
  WorldPermissionContext,
  WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";
import { textInputLimits } from "@/lib/inputLimits";

import {
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
} from "../mutations/settlementReadinessMutations";
import {
  deleteSettlementMutationOptions,
  isSettlementMutationError,
  updateSettlementCoordinatesMutationOptions,
  updateSettlementDetailsMutationOptions,
} from "../mutations/settlementsMutations";
import { settlementReadinessListQueryOptions } from "../queries/settlementReadinessQueries";
import { settlementByIdQueryOptions } from "../queries/settlementsQueries";

import { AutoReadyControl } from "./AutoReadyControl";
import { ManualReadinessControl } from "./ManualReadinessControl";
import { ReadinessStateBadge } from "./ReadinessStateBadge";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { SettlementWithNation } from "../types/settlementTypes";

// Coordinates are informational only per the feature guide; we still bound
// client input so users get feedback before the DB rejects out-of-range numbers.
const COORDINATE_LIMIT = 1_000_000;

type SettlementDetailPageProps = {
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDetailPage({
  nationId,
  settlementId,
  worldId,
}: SettlementDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </SettlementDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </SettlementDetailFrame>
    );
  }

  return (
    <SettlementDetailWorldGate
      accessContext={accessContextQuery.data}
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    />
  );
}

function SettlementDetailWorldGate({
  accessContext,
  nationId,
  settlementId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </SettlementDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <LoadingState label="Loading world…" />
      </SettlementDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <SettlementDetailFrame nationId={nationId} worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </SettlementDetailFrame>
      );
    }

    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </SettlementDetailFrame>
    );
  }

  return (
    <SettlementDetailContent
      accessContext={accessContext}
      nationId={nationId}
      settlementId={settlementId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function SettlementDetailContent({
  accessContext,
  nationId,
  settlementId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const settlementQuery = useQuery(settlementByIdQueryOptions(settlementId));

  if (settlementQuery.isPending) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <LoadingState label="Loading settlement…" />
      </SettlementDetailFrame>
    );
  }

  if (settlementQuery.isError) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <ErrorState
          title="Settlement could not be loaded"
          description={getErrorDescription(settlementQuery.error)}
        />
      </SettlementDetailFrame>
    );
  }

  const settlement = settlementQuery.data;
  if (
    settlement === null ||
    settlement.nation.worldId !== worldId ||
    settlement.nationId !== nationId
  ) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <AccessDeniedState
          title="Settlement unavailable"
          description="This settlement does not exist or is not part of this nation."
        />
      </SettlementDetailFrame>
    );
  }

  return (
    <SettlementDetailLoaded
      accessContext={accessContext}
      settlement={settlement}
      worldAccess={worldAccess}
      worldId={worldId}
    />
  );
}

function SettlementDetailLoaded({
  accessContext,
  settlement,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly settlement: SettlementWithNation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();
  const isArchived = worldAccess.header.isArchived;
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === settlement.nationId &&
    activeCharacter.status === "alive";
  const isSettlementManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "settlement_manager" &&
    activeCharacter.roleSettlementId === settlement.id &&
    activeCharacter.status === "alive";
  const canEditDetails =
    (worldAccess.canAdmin || isNationManager || isSettlementManager) &&
    !isArchived;
  const canDelete = worldAccess.canAdmin && !isArchived;

  return (
    <SettlementDetailFrame
      nationId={settlement.nationId}
      worldId={worldId}
      backLabel={`Back to ${settlement.nation.name}`}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {settlement.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Settlement in{" "}
            <span className="font-medium">{settlement.nation.name}</span>,{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </p>
        </div>
      </header>

      <SettlementReadinessSection
        accessContext={accessContext}
        canAdmin={worldAccess.canAdmin}
        canManage={worldAccess.canManage}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementDetailsSection
        canEdit={canEditDetails}
        queryClient={queryClient}
        settlement={settlement}
      />

      <SettlementCoordinatesSection
        canEdit={canEditDetails}
        queryClient={queryClient}
        settlement={settlement}
      />

      <CitizensPanel
        canAdmin={worldAccess.canAdmin}
        incestPreventionDepth={worldAccess.world.incestPreventionDepth}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      {canDelete ? (
        <SettlementDeleteSection
          queryClient={queryClient}
          settlement={settlement}
          worldId={worldId}
        />
      ) : null}
    </SettlementDetailFrame>
  );
}

function SettlementReadinessSection({
  accessContext,
  canAdmin,
  canManage,
  isArchived,
  settlementId,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const readinessQuery = useQuery(settlementReadinessListQueryOptions(worldId));
  const setReadinessMutation = useMutation(
    setSettlementReadinessMutationOptions({ accessContext, queryClient }),
  );
  const setAutoReadyMutation = useMutation(
    setSettlementAutoReadyMutationOptions({ accessContext, queryClient }),
  );

  return (
    <section
      aria-labelledby="settlement-readiness-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="settlement-readiness-heading" className="text-base font-medium">
        Readiness
      </h2>
      {readinessQuery.isPending ? (
        <LoadingState label="Loading readiness…" />
      ) : readinessQuery.isError ? (
        <ErrorState
          title="Readiness could not be loaded"
          description={getErrorDescription(readinessQuery.error)}
        />
      ) : (
        <SettlementReadinessSectionContent
          autoReadyError={
            setAutoReadyMutation.variables?.settlementId === settlementId
              ? setAutoReadyMutation.error
              : null
          }
          canSetAutoReady={canAdmin}
          canSetManualReady={canManage}
          isArchived={isArchived}
          isAutoReadyPending={
            setAutoReadyMutation.isPending &&
            setAutoReadyMutation.variables.settlementId === settlementId
          }
          isReadinessPending={
            setReadinessMutation.isPending &&
            setReadinessMutation.variables.settlementId === settlementId
          }
          item={
            readinessQuery.data.find((entry) => entry.id === settlementId) ??
            null
          }
          readinessError={
            setReadinessMutation.variables?.settlementId === settlementId
              ? setReadinessMutation.error
              : null
          }
          setAutoReady={(autoReadyEnabled) => {
            setAutoReadyMutation.mutate({
              autoReadyEnabled,
              settlementId,
              worldId,
            });
          }}
          setReadiness={(isReady) => {
            setReadinessMutation.mutate({
              isReady,
              settlementId,
              worldId,
            });
          }}
        />
      )}
    </section>
  );
}

function SettlementReadinessSectionContent({
  autoReadyError,
  canSetAutoReady,
  canSetManualReady,
  isArchived,
  isAutoReadyPending,
  isReadinessPending,
  item,
  readinessError,
  setAutoReady,
  setReadiness,
}: {
  readonly autoReadyError: Error | null;
  readonly canSetAutoReady: boolean;
  readonly canSetManualReady: boolean;
  readonly isArchived: boolean;
  readonly isAutoReadyPending: boolean;
  readonly isReadinessPending: boolean;
  readonly item: SettlementReadinessListItem | null;
  readonly readinessError: Error | null;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
  readonly setReadiness: (isReady: boolean) => void;
}): JSX.Element {
  if (item === null) {
    return (
      <EmptyState
        title="Readiness unavailable"
        description="Readiness data for this settlement could not be found."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
      <ReadinessStateBadge item={item} />
      <div className="grid gap-3">
        {canSetManualReady ? (
          <ManualReadinessControl
            isArchived={isArchived}
            isPending={isReadinessPending}
            item={item}
            mutationError={readinessError}
            setReadiness={setReadiness}
          />
        ) : null}
        {canSetAutoReady ? (
          <AutoReadyControl
            isArchived={isArchived}
            isPending={isAutoReadyPending}
            item={item}
            mutationError={autoReadyError}
            setAutoReady={setAutoReady}
          />
        ) : null}
      </div>
    </div>
  );
}

function SettlementDetailsSection({
  canEdit,
  queryClient,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(settlement.name);
  const [description, setDescription] = useState(settlement.description ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateSettlementDetailsMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName(settlement.name);
    setDescription(settlement.description ?? "");
    setNameError(undefined);
    updateMutation.reset();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    updateMutation.reset();

    if (name.trim().length === 0) {
      setNameError("Settlement name is required.");
      return;
    }

    updateMutation.mutate(
      {
        description: description.trim().length === 0 ? null : description,
        name,
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId: settlement.nation.worldId,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <section
        aria-labelledby="settlement-details-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="settlement-details-heading" className="text-base font-medium">
            Details
          </h2>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
        {settlement.description === null ? (
          <p className="text-sm italic text-muted-foreground">
            No description.
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {settlement.description}
          </p>
        )}
      </section>
    );
  }

  return (
    <form
      aria-label="Edit settlement details"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit details</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          aria-label="Cancel edit"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError === undefined ? undefined : true}
          aria-describedby={
            nameError === undefined ? undefined : "settlement-detail-name-error"
          }
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.settlementNameMax}
          required
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            if (nameError !== undefined) {
              setNameError(undefined);
            }
          }}
        />
        {nameError === undefined ? null : (
          <p
            id="settlement-detail-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {nameError}
          </p>
        )}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Description</span>
        <textarea
          className="min-h-[6rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.settlementDescriptionMax}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>
      {updateMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getMutationErrorDescription(updateMutation.error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          <Save aria-hidden="true" />
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeEditor}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SettlementCoordinatesSection({
  canEdit,
  queryClient,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [coordX, setCoordX] = useState(() =>
    formatCoordinate(settlement.coordX),
  );
  const [coordZ, setCoordZ] = useState(() =>
    formatCoordinate(settlement.coordZ),
  );
  const [coordXError, setCoordXError] = useState<string | undefined>(undefined);
  const [coordZError, setCoordZError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateSettlementCoordinatesMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setCoordX(formatCoordinate(settlement.coordX));
    setCoordZ(formatCoordinate(settlement.coordZ));
    setCoordXError(undefined);
    setCoordZError(undefined);
    updateMutation.reset();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCoordXError(undefined);
    setCoordZError(undefined);
    updateMutation.reset();

    const parsedX = parseCoordinateInput(coordX);
    const parsedZ = parseCoordinateInput(coordZ);

    if (parsedX.kind === "invalid") {
      setCoordXError(parsedX.message);
    }
    if (parsedZ.kind === "invalid") {
      setCoordZError(parsedZ.message);
    }
    if (parsedX.kind === "invalid" || parsedZ.kind === "invalid") {
      return;
    }

    updateMutation.mutate(
      {
        coordX: parsedX.value,
        coordZ: parsedZ.value,
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId: settlement.nation.worldId,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <section
        aria-labelledby="settlement-coordinates-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <h2
              id="settlement-coordinates-heading"
              className="text-base font-medium"
            >
              Coordinates
            </h2>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Coordinates are informational only.
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <CoordinateReadout label="X" value={settlement.coordX} />
          <CoordinateReadout label="Z" value={settlement.coordZ} />
        </dl>
      </section>
    );
  }

  return (
    <form
      aria-label="Edit settlement coordinates"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit coordinates</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          aria-label="Cancel edit"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Accepts decimal values between {`-${COORDINATE_LIMIT.toLocaleString()}`}{" "}
        and {COORDINATE_LIMIT.toLocaleString()}. Leave blank to clear.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CoordinateField
          disabled={updateMutation.isPending}
          error={coordXError}
          id="settlement-coord-x"
          label="X"
          onChange={(value) => {
            setCoordX(value);
            if (coordXError !== undefined) {
              setCoordXError(undefined);
            }
          }}
          value={coordX}
        />
        <CoordinateField
          disabled={updateMutation.isPending}
          error={coordZError}
          id="settlement-coord-z"
          label="Z"
          onChange={(value) => {
            setCoordZ(value);
            if (coordZError !== undefined) {
              setCoordZError(undefined);
            }
          }}
          value={coordZ}
        />
      </div>
      {updateMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getMutationErrorDescription(updateMutation.error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          <Save aria-hidden="true" />
          {updateMutation.isPending ? "Saving…" : "Save coordinates"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeEditor}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CoordinateReadout({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | null;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium">
        {value === null ? (
          <span className="italic text-muted-foreground">Not set</span>
        ) : (
          formatCoordinate(value)
        )}
      </dd>
    </div>
  );
}

function CoordinateField({
  disabled,
  error,
  id,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly error: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  const errorId = `${id}-error`;
  return (
    <label className="grid gap-1 text-sm" htmlFor={id}>
      <span className="text-muted-foreground">{label}</span>
      <Input
        aria-describedby={error === undefined ? undefined : errorId}
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="e.g. 12.5"
        value={value}
      />
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </label>
  );
}

function SettlementDeleteSection({
  queryClient,
  settlement,
  worldId,
}: {
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const deleteMutation = useMutation(
    deleteSettlementMutationOptions({ queryClient }),
  );

  function handleConfirm(): void {
    deleteMutation.reset();
    deleteMutation.mutate(
      {
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId,
      },
      {
        onSuccess: () => {
          setIsConfirming(false);
          void navigate({
            params: { nationId: settlement.nationId, worldId },
            replace: true,
            to: "/worlds/$worldId/nations/$nationId",
          });
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="settlement-delete-heading"
      className="grid gap-3 rounded-md border border-destructive/30 bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="settlement-delete-heading" className="text-base font-medium">
          Danger zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this settlement. Citizens and other linked records
          will be removed.
        </p>
      </div>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsConfirming(true)}
        >
          <Trash2 aria-hidden="true" />
          Delete settlement
        </Button>
      </div>
      {isConfirming ? (
        <SettlementDeleteConfirmDialog
          isPending={deleteMutation.isPending}
          settlementName={settlement.name}
          onCancel={() => {
            setIsConfirming(false);
            deleteMutation.reset();
          }}
          onConfirm={handleConfirm}
        />
      ) : null}
      {deleteMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getMutationErrorDescription(deleteMutation.error)}
        </p>
      ) : null}
    </section>
  );
}

function SettlementDeleteConfirmDialog({
  isPending,
  settlementName,
  onCancel,
  onConfirm,
}: {
  readonly isPending: boolean;
  readonly settlementName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="settlement-delete-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="settlement-delete-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Delete settlement
          </h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">{settlementName}</span>? This action
            cannot be undone.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            <Trash2 aria-hidden="true" />
            {isPending ? "Deleting…" : "Delete settlement"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettlementDetailFrame({
  backLabel = "Back to nation",
  children,
  nationId,
  worldId,
}: {
  readonly backLabel?: string;
  readonly children: ReactNode;
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link
          to="/worlds/$worldId/nations/$nationId"
          params={{ nationId, worldId }}
        >
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Link>
      </Button>
      {children}
    </div>
  );
}

type ParsedCoordinate =
  | { readonly kind: "valid"; readonly value: number | null }
  | { readonly kind: "invalid"; readonly message: string };

function parseCoordinateInput(raw: string): ParsedCoordinate {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: "valid", value: null };
  }

  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return {
      kind: "invalid",
      message: "Enter a decimal number, or leave blank to clear.",
    };
  }

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      kind: "invalid",
      message: "Enter a finite decimal number.",
    };
  }

  if (parsed < -COORDINATE_LIMIT || parsed > COORDINATE_LIMIT) {
    return {
      kind: "invalid",
      message: `Must be between -${COORDINATE_LIMIT.toLocaleString()} and ${COORDINATE_LIMIT.toLocaleString()}.`,
    };
  }

  return { kind: "valid", value: parsed };
}

function formatCoordinate(value: number | null): string {
  if (value === null) {
    return "";
  }
  return String(value);
}

function getMutationErrorDescription(error: unknown): string {
  if (isSettlementMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
