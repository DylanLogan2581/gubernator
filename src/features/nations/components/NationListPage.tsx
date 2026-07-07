import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Landmark, Plus } from "lucide-react";
import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { toast } from "sonner";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
} from "@/features/permissions";
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
import {
  NATION_GOVERNMENT_TYPES,
  formatNationGovernmentType,
} from "../types/nationTypes";

import { NationFlagAvatar } from "./NationFlagAvatar";

import type { Nation, NationGovernmentType } from "../types/nationTypes";

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
      <NationListFrame>
        <LoadingState label="Loading world access…" />
      </NationListFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <NationListFrame>
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
      <NationListFrame>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </NationListFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <NationListFrame>
        <LoadingState label="Loading world…" />
      </NationListFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <NationListFrame>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </NationListFrame>
      );
    }

    return (
      <NationListFrame>
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
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);
  const canCreate = effectiveCanAdmin && !worldAccess.header.isArchived;

  return (
    <NationListFrame>
      <PageHeader
        icon={Landmark}
        title="Nations"
        description={
          <>
            Nations within{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </>
        }
        actions={
          canCreate ? (
            <CreateNationSection queryClient={queryClient} worldId={worldId} />
          ) : null
        }
      />

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
    <li className="group rounded-md border border-border bg-card text-card-foreground">
      <Link
        to="/worlds/$worldId/nations/$nationId"
        params={{ nationId: nation.id, worldId }}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <NationFlagAvatar
          className="size-10 shrink-0"
          flagPath={nation.flagPath}
          nationId={nation.id}
        />
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-medium">{nation.name}</h2>
            <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {formatNationGovernmentType(nation.governmentType)}
            </span>
          </div>
          {descriptionPreview === null ? (
            <p className="text-sm italic text-muted-foreground">
              No description.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {descriptionPreview}
            </p>
          )}
        </div>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
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
  const [foundedTurnNumber, setFoundedTurnNumber] = useState("");
  const [governmentType, setGovernmentType] =
    useState<NationGovernmentType>("monarchy");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [foundedTurnError, setFoundedTurnError] = useState<string | undefined>(
    undefined,
  );

  const createMutation = useMutation(
    createNationMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName("");
    setDescription("");
    setFoundedTurnNumber("");
    setGovernmentType("monarchy");
    setNameError(undefined);
    setFoundedTurnError(undefined);
    createMutation.reset();
  }

  function closeForm(): void {
    setIsOpen(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    setFoundedTurnError(undefined);
    createMutation.reset();

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setNameError("Nation name is required.");
      return;
    }

    const trimmedFoundedTurn = foundedTurnNumber.trim();
    let parsedFoundedTurn: number | null = null;
    if (trimmedFoundedTurn.length > 0) {
      const parsed = Number(trimmedFoundedTurn);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setFoundedTurnError(
          "Founded turn must be a whole number, 0 or greater.",
        );
        return;
      }
      parsedFoundedTurn = parsed;
    }

    createMutation.mutate(
      {
        description: description.trim().length === 0 ? null : description,
        foundedTurnNumber: parsedFoundedTurn,
        governmentType,
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

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        <Plus aria-hidden="true" />
        Create nation
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New nation</DialogTitle>
          </DialogHeader>
          <form
            aria-label="Create nation"
            className="grid gap-3"
            noValidate
            onSubmit={handleSubmit}
          >
            <Label className="grid gap-1 text-sm" htmlFor="nation-create-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={nameError === undefined ? undefined : true}
                aria-describedby={
                  nameError === undefined ? undefined : "nation-name-error"
                }
                id="nation-create-name"
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
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="nation-create-desc">
              <span className="text-muted-foreground">
                Description (optional)
              </span>
              <Textarea
                aria-label="Description"
                id="nation-create-desc"
                maxLength={textInputLimits.nationDescriptionMax}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </Label>
            <Label
              className="grid gap-1 text-sm"
              htmlFor="nation-create-founded-turn"
            >
              <span className="text-muted-foreground">
                Founded turn (optional)
              </span>
              <Input
                aria-invalid={foundedTurnError === undefined ? undefined : true}
                aria-describedby={
                  foundedTurnError === undefined
                    ? undefined
                    : "nation-founded-turn-error"
                }
                id="nation-create-founded-turn"
                inputMode="numeric"
                value={foundedTurnNumber}
                onChange={(event) => {
                  setFoundedTurnNumber(event.currentTarget.value);
                  if (foundedTurnError !== undefined) {
                    setFoundedTurnError(undefined);
                  }
                }}
              />
              {foundedTurnError === undefined ? null : (
                <p
                  id="nation-founded-turn-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {foundedTurnError}
                </p>
              )}
            </Label>
            <Label
              className="grid gap-1 text-sm"
              htmlFor="nation-create-government-type"
            >
              <span className="text-muted-foreground">Government type</span>
              <select
                id="nation-create-government-type"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                onClick={closeForm}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                <Plus aria-hidden="true" />
                Create nation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NationListFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className="flex flex-col gap-4">{children}</div>;
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
