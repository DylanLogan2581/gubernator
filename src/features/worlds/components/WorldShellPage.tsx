import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Globe2 } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { currentAccessContextQueryOptions } from "@/features/permissions";

import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "../queries/worldQueries";

import type { JSX } from "react";

type WorldShellPageProps = {
  readonly worldSlug: string;
};

export function WorldShellPage({
  worldSlug,
}: WorldShellPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <WorldShellFrame>
        <LoadingState label="Loading world access…" />
      </WorldShellFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <WorldShellFrame>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </WorldShellFrame>
    );
  }

  return (
    <WorldShellContent
      accessContext={accessContextQuery.data}
      worldSlug={worldSlug}
    />
  );
}

function WorldShellContent({
  accessContext,
  worldSlug,
}: {
  readonly accessContext: Parameters<typeof worldRouteAccessQueryOptions>[1];
  readonly worldSlug: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldSlug, accessContext),
  );

  if (worldQuery.isPending) {
    return (
      <WorldShellFrame>
        <LoadingState label="Loading world…" />
      </WorldShellFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <WorldShellFrame>
          <EmptyState
            icon={Globe2}
            title="World not found"
            description="This world does not exist or your account does not have access."
          />
        </WorldShellFrame>
      );
    }

    return (
      <WorldShellFrame>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </WorldShellFrame>
    );
  }

  return (
    <WorldShellFrame>
      <section
        aria-labelledby="world-shell-title"
        className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              id="world-shell-title"
              className="text-2xl font-semibold tracking-normal"
            >
              {worldQuery.data.header.name}
            </h1>
            <dl className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Current turn</dt>
                <dd>{worldQuery.data.header.currentTurnNumber}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Status</dt>
                <dd className="capitalize">{worldQuery.data.header.status}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Visibility</dt>
                <dd className="capitalize">
                  {worldQuery.data.header.visibility}
                </dd>
              </div>
            </dl>
          </div>
          {worldQuery.data.header.isArchived ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Archive className="size-3" aria-hidden="true" />
              Read-only archive
            </span>
          ) : null}
        </div>

        {worldQuery.data.header.isArchived ? (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            This world is archived. It is available for review, but gameplay
            actions are read-only.
          </p>
        ) : null}
      </section>
    </WorldShellFrame>
  );
}

function WorldShellFrame({
  children,
}: {
  readonly children: JSX.Element;
}): JSX.Element {
  return <div className="mx-auto max-w-5xl py-6">{children}</div>;
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
