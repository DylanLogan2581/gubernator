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
import { currentAccessContextQueryOptions } from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type { WorldRouteAccess } from "@/features/worlds";
import { textInputLimits } from "@/lib/inputLimits";

import {
  deleteNationMutationOptions,
  isNationMutationError,
  setNationHiddenMutationOptions,
  updateNationDetailsMutationOptions,
} from "../mutations/nationsMutations";
import {
  nationByIdQueryOptions,
  nationSettlementsQueryOptions,
} from "../queries/nationsQueries";

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
