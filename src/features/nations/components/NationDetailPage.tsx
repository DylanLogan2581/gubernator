import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode,
} from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
} from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type { WorldRouteAccess } from "@/features/worlds";
import { textInputLimits } from "@/lib/inputLimits";

import {
  isNationRelationshipMutationError,
  proposeBilateralMutationOptions,
  respondToBilateralMutationOptions,
  setUnilateralStanceMutationOptions,
  withdrawFromBilateralMutationOptions,
} from "../mutations/nationRelationshipMutations";
import {
  deleteNationMutationOptions,
  isNationMutationError,
  setNationHiddenMutationOptions,
  updateNationDetailsMutationOptions,
} from "../mutations/nationsMutations";
import {
  nationRelationshipsFromNationQueryOptions,
  nationRelationshipsToNationQueryOptions,
} from "../queries/nationRelationshipQueries";
import {
  nationByIdQueryOptions,
  nationsListQueryOptions,
  nationSettlementsQueryOptions,
} from "../queries/nationsQueries";

import type {
  NationRelationship,
  NationUnilateralStance,
} from "../types/nationRelationshipTypes";
import type { Nation, NationSettlement } from "../types/nationTypes";

type NationDetailPageProps = {
  readonly nationId: string;
  readonly worldId: string;
};

export function NationDetailPage({
  nationId,
  worldId,
}: NationDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <NationDetailFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </NationDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <NationDetailFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </NationDetailFrame>
    );
  }

  return (
    <NationDetailWorldGate
      accessContext={accessContextQuery.data}
      nationId={nationId}
      worldId={worldId}
    />
  );
}

function NationDetailWorldGate({
  accessContext,
  nationId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <NationDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </NationDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <NationDetailFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </NationDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <NationDetailFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </NationDetailFrame>
      );
    }

    return (
      <NationDetailFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </NationDetailFrame>
    );
  }

  return (
    <NationDetailContent
      nationId={nationId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function NationDetailContent({
  nationId,
  worldAccess,
  worldId,
}: {
  readonly nationId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const nationQuery = useQuery(nationByIdQueryOptions(nationId));

  if (nationQuery.isPending) {
    return (
      <NationDetailFrame worldId={worldId}>
        <LoadingState label="Loading nation…" />
      </NationDetailFrame>
    );
  }

  if (nationQuery.isError) {
    return (
      <NationDetailFrame worldId={worldId}>
        <ErrorState
          title="Nation could not be loaded"
          description={getErrorDescription(nationQuery.error)}
        />
      </NationDetailFrame>
    );
  }

  const nation = nationQuery.data;
  if (nation === null || nation.worldId !== worldId) {
    return (
      <NationDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Nation unavailable"
          description="This nation does not exist or is not part of this world."
        />
      </NationDetailFrame>
    );
  }

  if (nation.isHidden && !worldAccess.canAdmin) {
    return <HiddenNationRedirect worldId={worldId} />;
  }

  return (
    <NationDetailLoaded
      nation={nation}
      worldAccess={worldAccess}
      worldId={worldId}
    />
  );
}

function HiddenNationRedirect({
  worldId,
}: {
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({
      params: { worldId },
      replace: true,
      to: "/worlds/$worldId/nations",
    });
  }, [navigate, worldId]);

  return (
    <NationDetailFrame worldId={worldId}>
      <LoadingState label="Redirecting…" />
    </NationDetailFrame>
  );
}

function NationDetailLoaded({
  nation,
  worldAccess,
  worldId,
}: {
  readonly nation: Nation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const isArchived = worldAccess.header.isArchived;
  const canEditDetails = worldAccess.canManage && !isArchived;
  const canToggleHidden = worldAccess.canAdmin && !isArchived;
  const canDelete = worldAccess.canAdmin && !isArchived;

  return (
    <NationDetailFrame worldId={worldId}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              {nation.name}
            </h1>
            {nation.isHidden ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <LockKeyhole className="size-3" aria-hidden="true" />
                Hidden
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Nation in{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </p>
        </div>
      </header>

      <NationDetailsSection
        canEdit={canEditDetails}
        nation={nation}
        queryClient={queryClient}
      />

      {canToggleHidden ? (
        <NationHiddenToggleSection nation={nation} queryClient={queryClient} />
      ) : null}

      <NationSettlementsSection nationId={nation.id} worldId={worldId} />

      <NationRelationshipsSection
        canAdminWorld={worldAccess.canAdmin && !isArchived}
        isArchived={isArchived}
        nation={nation}
        queryClient={queryClient}
      />

      {canDelete ? (
        <NationDeleteSection nation={nation} queryClient={queryClient} />
      ) : null}
    </NationDetailFrame>
  );
}

function NationDetailsSection({
  canEdit,
  nation,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(nation.name);
  const [description, setDescription] = useState(nation.description ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateNationDetailsMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName(nation.name);
    setDescription(nation.description ?? "");
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
      setNameError("Nation name is required.");
      return;
    }

    updateMutation.mutate(
      {
        description: description.trim().length === 0 ? null : description,
        name,
        nationId: nation.id,
        worldId: nation.worldId,
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
        aria-labelledby="nation-details-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="nation-details-heading" className="text-base font-medium">
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
        {nation.description === null ? (
          <p className="text-sm italic text-muted-foreground">
            No description.
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {nation.description}
          </p>
        )}
      </section>
    );
  }

  return (
    <form
      aria-label="Edit nation details"
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
            nameError === undefined ? undefined : "nation-detail-name-error"
          }
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.nationNameMax}
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
            id="nation-detail-name-error"
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
          maxLength={textInputLimits.nationDescriptionMax}
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

function NationHiddenToggleSection({
  nation,
  queryClient,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const setHiddenMutation = useMutation(
    setNationHiddenMutationOptions({ queryClient }),
  );

  function handleToggle(): void {
    setHiddenMutation.reset();
    setHiddenMutation.mutate({
      isHidden: !nation.isHidden,
      nationId: nation.id,
      worldId: nation.worldId,
    });
  }

  return (
    <section
      aria-labelledby="nation-hidden-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 id="nation-hidden-heading" className="text-base font-medium">
            Visibility
          </h2>
          <p className="text-sm text-muted-foreground">
            {nation.isHidden
              ? "This nation is hidden from non-administrators."
              : "This nation is visible to all world members."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleToggle}
          disabled={setHiddenMutation.isPending}
        >
          {nation.isHidden ? (
            <Eye aria-hidden="true" />
          ) : (
            <EyeOff aria-hidden="true" />
          )}
          {nation.isHidden ? "Show nation" : "Hide nation"}
        </Button>
      </div>
      {setHiddenMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getMutationErrorDescription(setHiddenMutation.error)}
        </p>
      ) : null}
    </section>
  );
}

function NationSettlementsSection({
  nationId,
  worldId,
}: {
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));

  return (
    <section
      aria-labelledby="nation-settlements-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="nation-settlements-heading" className="text-base font-medium">
        Settlements
      </h2>
      {settlementsQuery.isPending ? (
        <LoadingState label="Loading settlements…" />
      ) : settlementsQuery.isError ? (
        <ErrorState
          title="Settlements could not be loaded"
          description={getErrorDescription(settlementsQuery.error)}
        />
      ) : settlementsQuery.data.length === 0 ? (
        <EmptyState
          title="No settlements"
          description="This nation has no settlements yet."
        />
      ) : (
        <ul className="grid gap-2" aria-label="Settlements">
          {settlementsQuery.data.map((settlement) => (
            <NationSettlementListItem
              key={settlement.id}
              settlement={settlement}
              worldId={worldId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NationSettlementListItem({
  settlement,
  worldId,
}: {
  readonly settlement: NationSettlement;
  readonly worldId: string;
}): JSX.Element {
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <a
        href={`/worlds/${worldId}/settlements/${settlement.id}`}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {settlement.name}
      </a>
    </li>
  );
}

function NationRelationshipsSection({
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
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canControl = (canAdminWorld || isNationManager) && !isArchived;

  const nationsQuery = useQuery(nationsListQueryOptions(nation.worldId));
  const outgoingQuery = useQuery(
    nationRelationshipsFromNationQueryOptions(nation.id),
  );
  const incomingQuery = useQuery(
    nationRelationshipsToNationQueryOptions(nation.id),
  );

  return (
    <section
      aria-labelledby="nation-relationships-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="nation-relationships-heading" className="text-base font-medium">
          Relationships
        </h2>
        <p className="text-sm text-muted-foreground">
          Outgoing stances from {nation.name} and proposals awaiting either
          side.
        </p>
      </div>
      {nationsQuery.isPending ||
      outgoingQuery.isPending ||
      incomingQuery.isPending ? (
        <LoadingState label="Loading relationships…" />
      ) : nationsQuery.isError ? (
        <ErrorState
          title="Relationships could not be loaded"
          description={getErrorDescription(nationsQuery.error)}
        />
      ) : outgoingQuery.isError ? (
        <ErrorState
          title="Relationships could not be loaded"
          description={getErrorDescription(outgoingQuery.error)}
        />
      ) : incomingQuery.isError ? (
        <ErrorState
          title="Relationships could not be loaded"
          description={getErrorDescription(incomingQuery.error)}
        />
      ) : (
        <NationRelationshipsList
          canControl={canControl}
          incoming={incomingQuery.data}
          nation={nation}
          otherNations={nationsQuery.data.filter(
            (candidate) => candidate.id !== nation.id,
          )}
          outgoing={outgoingQuery.data}
          queryClient={queryClient}
        />
      )}
    </section>
  );
}

function NationRelationshipsList({
  canControl,
  incoming,
  nation,
  otherNations,
  outgoing,
  queryClient,
}: {
  readonly canControl: boolean;
  readonly incoming: readonly NationRelationship[];
  readonly nation: Nation;
  readonly otherNations: readonly Nation[];
  readonly outgoing: readonly NationRelationship[];
  readonly queryClient: QueryClient;
}): JSX.Element {
  if (otherNations.length === 0) {
    return (
      <EmptyState
        title="No other nations"
        description="This world has no other nations to relate to yet."
      />
    );
  }

  const outgoingByTo = new Map<string, NationRelationship>(
    outgoing.map((row) => [row.toNationId, row]),
  );
  const incomingByFrom = new Map<string, NationRelationship>(
    incoming.map((row) => [row.fromNationId, row]),
  );

  return (
    <ul className="grid gap-2" aria-label="Relationships">
      {otherNations.map((other) => (
        <NationRelationshipRow
          key={other.id}
          canControl={canControl}
          incoming={incomingByFrom.get(other.id) ?? null}
          nation={nation}
          other={other}
          outgoing={outgoingByTo.get(other.id) ?? null}
          queryClient={queryClient}
        />
      ))}
    </ul>
  );
}

function NationRelationshipRow({
  canControl,
  incoming,
  nation,
  other,
  outgoing,
  queryClient,
}: {
  readonly canControl: boolean;
  readonly incoming: NationRelationship | null;
  readonly nation: Nation;
  readonly other: Nation;
  readonly outgoing: NationRelationship | null;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const setUnilateral = useMutation(
    setUnilateralStanceMutationOptions({ queryClient }),
  );
  const proposeBilateral = useMutation(
    proposeBilateralMutationOptions({ queryClient }),
  );
  const respondToBilateral = useMutation(
    respondToBilateralMutationOptions({ queryClient }),
  );
  const withdrawFromBilateral = useMutation(
    withdrawFromBilateralMutationOptions({ queryClient }),
  );

  const currentStance = outgoing?.currentStance ?? "neutral";
  const outgoingPending =
    outgoing !== null &&
    outgoing.pendingStance !== null &&
    outgoing.pendingStatus === "proposed"
      ? {
          stance: outgoing.pendingStance,
          status: outgoing.pendingStatus,
        }
      : null;
  const incomingProposal =
    incoming !== null &&
    incoming.pendingStance !== null &&
    incoming.pendingStatus === "proposed"
      ? {
          stance: incoming.pendingStance,
        }
      : null;
  const isBilateral =
    currentStance === "allied" || currentStance === "non_aggression_pact";

  const anyPending =
    setUnilateral.isPending ||
    proposeBilateral.isPending ||
    respondToBilateral.isPending ||
    withdrawFromBilateral.isPending;

  const firstError =
    setUnilateral.error ??
    proposeBilateral.error ??
    respondToBilateral.error ??
    withdrawFromBilateral.error ??
    null;

  return (
    <li className="grid gap-3 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{other.name}</span>
        <span className="text-xs text-muted-foreground">
          Current stance:{" "}
          <span className="font-medium text-foreground">
            {formatRelationshipStance(currentStance)}
          </span>
        </span>
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        {outgoingPending !== null ? (
          <p>
            <span className="font-medium text-foreground">Sent proposal:</span>{" "}
            {formatRelationshipStance(outgoingPending.stance)} — awaiting{" "}
            {other.name}.
          </p>
        ) : null}
        {incomingProposal !== null ? (
          <p>
            <span className="font-medium text-foreground">
              Incoming proposal:
            </span>{" "}
            {other.name} proposes{" "}
            {formatRelationshipStance(incomingProposal.stance)} — awaiting{" "}
            {nation.name}.
          </p>
        ) : null}
        {outgoingPending === null && incomingProposal === null ? (
          <p className="italic">No pending proposals.</p>
        ) : null}
      </div>
      {canControl ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor={`unilateral-${other.id}`}
            >
              Set stance
            </label>
            <select
              id={`unilateral-${other.id}`}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              disabled={anyPending}
              value={isBilateral ? "neutral" : currentStance}
              onChange={(event) => {
                const stance = event.currentTarget
                  .value as NationUnilateralStance;
                setUnilateral.reset();
                setUnilateral.mutate({
                  fromNationId: nation.id,
                  stance,
                  toNationId: other.id,
                });
              }}
            >
              <option value="neutral">Neutral</option>
              <option value="friendly">Friendly</option>
              <option value="hostile">Hostile</option>
              <option value="at_war">At war</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isBilateral && outgoingPending === null ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    proposeBilateral.reset();
                    proposeBilateral.mutate({
                      fromNationId: nation.id,
                      stance: "allied",
                      toNationId: other.id,
                    });
                  }}
                >
                  Propose alliance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    proposeBilateral.reset();
                    proposeBilateral.mutate({
                      fromNationId: nation.id,
                      stance: "non_aggression_pact",
                      toNationId: other.id,
                    });
                  }}
                >
                  Propose non-aggression pact
                </Button>
              </>
            ) : null}
            {isBilateral ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={anyPending}
                onClick={() => {
                  withdrawFromBilateral.reset();
                  withdrawFromBilateral.mutate({
                    fromNationId: nation.id,
                    toNationId: other.id,
                  });
                }}
              >
                Withdraw agreement
              </Button>
            ) : null}
            {incomingProposal !== null ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    respondToBilateral.reset();
                    respondToBilateral.mutate({
                      fromNationId: other.id,
                      response: "accepted",
                      toNationId: nation.id,
                    });
                  }}
                >
                  Accept proposal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => {
                    respondToBilateral.reset();
                    respondToBilateral.mutate({
                      fromNationId: other.id,
                      response: "declined",
                      toNationId: nation.id,
                    });
                  }}
                >
                  Decline proposal
                </Button>
              </>
            ) : null}
          </div>
          {firstError !== null ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {getRelationshipMutationErrorDescription(firstError)}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function formatRelationshipStance(stance: string): string {
  switch (stance) {
    case "neutral":
      return "Neutral";
    case "friendly":
      return "Friendly";
    case "hostile":
      return "Hostile";
    case "at_war":
      return "At war";
    case "allied":
      return "Allied";
    case "non_aggression_pact":
      return "Non-aggression pact";
    default:
      return stance;
  }
}

function getRelationshipMutationErrorDescription(error: unknown): string {
  if (isNationRelationshipMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}

function NationDeleteSection({
  nation,
  queryClient,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const deleteMutation = useMutation(
    deleteNationMutationOptions({ queryClient }),
  );

  function handleConfirm(): void {
    deleteMutation.reset();
    deleteMutation.mutate(
      { nationId: nation.id, worldId: nation.worldId },
      {
        onSuccess: () => {
          setIsConfirming(false);
          void navigate({
            params: { worldId: nation.worldId },
            replace: true,
            to: "/worlds/$worldId/nations",
          });
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="nation-delete-heading"
      className="grid gap-3 rounded-md border border-destructive/30 bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="nation-delete-heading" className="text-base font-medium">
          Danger zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this nation. Settlements assigned to it will be
          unlinked.
        </p>
      </div>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsConfirming(true)}
        >
          <Trash2 aria-hidden="true" />
          Delete nation
        </Button>
      </div>
      {isConfirming ? (
        <NationDeleteConfirmDialog
          isPending={deleteMutation.isPending}
          nationName={nation.name}
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

function NationDeleteConfirmDialog({
  isPending,
  nationName,
  onCancel,
  onConfirm,
}: {
  readonly isPending: boolean;
  readonly nationName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="nation-delete-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="nation-delete-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Delete nation
          </h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">{nationName}</span>? This action
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
            {isPending ? "Deleting…" : "Delete nation"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NationDetailFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId/nations" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to nations
        </Link>
      </Button>
      {children}
    </div>
  );
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}

function getMutationErrorDescription(error: unknown): string {
  if (isNationMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
