import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  Globe2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";

import { accessibleWorldsQueryOptions } from "../queries/worldQueries";

import type { AccessibleWorld } from "../types/worldTypes";
import type { JSX } from "react";

export function WorldListPage(): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <WorldListFrame>
        <LoadingState label="Loading world access…" />
      </WorldListFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <WorldListFrame>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </WorldListFrame>
    );
  }

  return <WorldListContent accessContext={accessContextQuery.data} />;
}

function WorldListContent({
  accessContext,
}: {
  readonly accessContext: AccessContext;
}): JSX.Element {
  const worldsQuery = useQuery(accessibleWorldsQueryOptions(accessContext));

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <WorldListFrame>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </WorldListFrame>
    );
  }

  if (worldsQuery.isPending) {
    return (
      <WorldListFrame>
        <LoadingState label="Loading worlds…" />
      </WorldListFrame>
    );
  }

  if (worldsQuery.isError) {
    return (
      <WorldListFrame>
        <ErrorState
          title="Worlds could not be loaded"
          description={getErrorDescription(worldsQuery.error)}
        />
      </WorldListFrame>
    );
  }

  if (worldsQuery.data.length === 0) {
    return (
      <WorldListFrame>
        <AccessDeniedState
          title="No accessible worlds"
          description="Your Gubernator account does not currently have access to any worlds."
        />
      </WorldListFrame>
    );
  }

  return (
    <WorldListFrame>
      <ul className="grid gap-3" aria-label="Accessible worlds">
        {worldsQuery.data.map((world) => (
          <WorldListItem key={world.id} world={world} />
        ))}
      </ul>
    </WorldListFrame>
  );
}

function WorldListFrame({
  children,
}: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">Worlds</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose an accessible simulation world to continue.
        </p>
      </header>
      {children}
    </div>
  );
}

function WorldListItem({
  world,
}: {
  readonly world: AccessibleWorld;
}): JSX.Element {
  return (
    <li>
      <Link
        to="/worlds/$worldId"
        params={{ worldId: world.id }}
        className="group grid gap-4 rounded-md border border-border bg-card p-4 text-card-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-medium">{world.name}</h2>
            <WorldBadge world={world} />
          </div>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Turn</dt>
              <dd>{world.currentTurnNumber}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Status</dt>
              <dd className="capitalize">{world.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Visibility</dt>
              <dd className="capitalize">{world.visibility}</dd>
            </div>
          </dl>
        </div>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function WorldBadge({
  world,
}: {
  readonly world: AccessibleWorld;
}): JSX.Element {
  if (world.isArchived) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Archive className="size-3" aria-hidden="true" />
        Archived
      </span>
    );
  }

  if (world.isHidden) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <LockKeyhole className="size-3" aria-hidden="true" />
        Hidden
      </span>
    );
  }

  if (world.canManage) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3" aria-hidden="true" />
        Manage
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Globe2 className="size-3" aria-hidden="true" />
      Public
    </span>
  );
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
