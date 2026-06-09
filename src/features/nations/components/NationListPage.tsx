import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Plus, X } from "lucide-react";
import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { toast } from "sonner";

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
import { getErrorDescription } from "@/lib/errorUtils";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  createNationMutationOptions,
  isNationMutationError,
} from "../mutations/nationsMutations";
import { nationsListQueryOptions } from "../queries/nationsQueries";

import type { Nation } from "../types/nationTypes";

type NationListPageProps = {
  readonly worldId: string;
};

export function NationListPage({ worldId }: NationListPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <NationListFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </NationListFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <NationListFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </NationListFrame>
    );
  }

  return (
    <NationListWorldGate
      accessContext={accessContextQuery.data}
      worldId={worldId}
    />
  );
}

function NationListWorldGate({
  accessContext,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <NationListFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </NationListFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <NationListFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </NationListFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <NationListFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </NationListFrame>
      );
    }

    return (
      <NationListFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </NationListFrame>
    );
  }

  return <NationListContent worldAccess={worldQuery.data} worldId={worldId} />;
}

function NationListContent({
  worldAccess,
  worldId,
}: {
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const canCreate = worldAccess.canAdmin && !worldAccess.header.isArchived;

  return (
    <NationListFrame worldId={worldId}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">Nations</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nations within{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </p>
        </div>
      </header>

      {canCreate ? (
        <CreateNationSection queryClient={queryClient} worldId={worldId} />
      ) : null}

      {nationsQuery.isPending ? (
        <LoadingState label="Loading nations…" />
      ) : nationsQuery.isError ? (
        <ErrorState
          title="Nations could not be loaded"
          description={getErrorDescription(nationsQuery.error)}
        />
      ) : nationsQuery.data.length === 0 ? (
        <EmptyState
          title="No nations yet"
          description={
            canCreate
              ? "Create the first nation to populate this world."
              : "No nations are visible to your account in this world."
          }
        />
      ) : (
        <ul className="grid gap-3" aria-label="Nations">
          {nationsQuery.data.map((nation) => (
            <NationListItem key={nation.id} nation={nation} worldId={worldId} />
          ))}
        </ul>
      )}
    </NationListFrame>
  );
}

function NationListItem({
  nation,
  worldId,
}: {
  readonly nation: Nation;
  readonly worldId: string;
}): JSX.Element {
  const descriptionPreview = getDescriptionPreview(nation.description);

  return (
    <li className="grid gap-2 p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="truncate text-base font-medium">
          <Link
            to="/worlds/$worldId/nations/$nationId"
            params={{ nationId: nation.id, worldId }}
            className="underline-offset-4 hover:underline"
          >
            {nation.name}
          </Link>
        </h2>
        {nation.isHidden ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <LockKeyhole className="size-3" aria-hidden="true" />
            Hidden
          </span>
        ) : null}
      </div>
      {descriptionPreview === null ? (
        <p className="text-sm italic text-muted-foreground">No description.</p>
      ) : (
        <p className="text-sm text-muted-foreground">{descriptionPreview}</p>
      )}
    </li>
  );
}

function CreateNationSection({
  queryClient,
  worldId,
}: {
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const createMutation = useMutation(
    createNationMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName("");
    setDescription("");
    setNameError(undefined);
    createMutation.reset();
  }

  function closeForm(): void {
    setIsOpen(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    createMutation.reset();

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setNameError("Nation name is required.");
      return;
    }

    createMutation.mutate(
      {
        description: description.trim().length === 0 ? null : description,
        name,
        worldId,
      },
      {
        onError: (error) => {
          toast.error(getCreateErrorDescription(error));
        },
        onSuccess: (nation) => {
          notifyMutationSuccess(`Nation "${nation.name}" created.`);
          closeForm();
        },
      },
    );
  }

  if (!isOpen) {
    return (
      <div>
        <Button type="button" onClick={() => setIsOpen(true)}>
          <Plus aria-hidden="true" />
          Create nation
        </Button>
      </div>
    );
  }

  return (
    <form
      aria-label="Create nation"
      className="grid gap-3 p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">New nation</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeForm}
          aria-label="Cancel"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError === undefined ? undefined : true}
          aria-describedby={
            nameError === undefined ? undefined : "nation-name-error"
          }
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
            id="nation-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {nameError}
          </p>
        )}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Description (optional)</span>
        <textarea
          className="min-h-[5rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          maxLength={textInputLimits.nationDescriptionMax}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus aria-hidden="true" />
          Create nation
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeForm}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NationListFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to world
        </Link>
      </Button>
      {children}
    </div>
  );
}

function getDescriptionPreview(description: string | null): string | null {
  if (description === null) {
    return null;
  }

  const collapsed = description.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) {
    return null;
  }

  const limit = 160;
  if (collapsed.length <= limit) {
    return collapsed;
  }

  return `${collapsed.slice(0, limit).trimEnd()}…`;
}

function getCreateErrorDescription(error: unknown): string {
  if (isNationMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
