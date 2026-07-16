import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  AdminPausedHint,
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
  type AccessContext,
} from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
  type WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { cultureByIdQueryOptions } from "../../queries/culturesQueries";

import { CultureDetailFrame } from "./CultureDetailFrame";
import { CultureLoreForm } from "./CultureLoreForm";

import type { Culture } from "../../types/cultureTypes";
import type { JSX } from "react";

type CultureDetailPageProps = {
  readonly cultureId: string;
  readonly worldId: string;
};

export function CultureDetailPage({
  cultureId,
  worldId,
}: CultureDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </CultureDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </CultureDetailFrame>
    );
  }

  return (
    <CultureDetailWorldGate
      accessContext={accessContextQuery.data}
      cultureId={cultureId}
      worldId={worldId}
    />
  );
}

function CultureDetailWorldGate({
  accessContext,
  cultureId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly cultureId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </CultureDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </CultureDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <CultureDetailFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </CultureDetailFrame>
      );
    }

    return (
      <CultureDetailFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </CultureDetailFrame>
    );
  }

  return (
    <CultureDetailContent
      cultureId={cultureId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function CultureDetailContent({
  cultureId,
  worldAccess,
  worldId,
}: {
  readonly cultureId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const cultureQuery = useQuery(cultureByIdQueryOptions(cultureId));
  // Must be called unconditionally before any early returns to satisfy rules-of-hooks.
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  if (cultureQuery.isPending) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <LoadingState label="Loading culture…" />
      </CultureDetailFrame>
    );
  }

  if (cultureQuery.isError) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <ErrorState
          title="Culture could not be loaded"
          description={getErrorDescription(cultureQuery.error)}
        />
      </CultureDetailFrame>
    );
  }

  const culture = cultureQuery.data;
  if (culture === null || culture.worldId !== worldId) {
    return (
      <CultureDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Culture unavailable"
          description="This culture does not exist or is not part of this world."
        />
      </CultureDetailFrame>
    );
  }

  const canEdit = effectiveCanAdmin && !worldAccess.header.isArchived;

  return (
    <CultureDetailLoaded
      canEdit={canEdit}
      culture={culture}
      rawCanAdmin={worldAccess.canAdmin}
      worldId={worldId}
    />
  );
}

function CultureDetailLoaded({
  canEdit,
  culture,
  rawCanAdmin,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly culture: Culture;
  readonly rawCanAdmin: boolean;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();

  return (
    <CultureDetailFrame worldId={worldId}>
      <AdminPausedHint canAdmin={rawCanAdmin} />

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full"
          style={{ backgroundColor: culture.color }}
        />
        <h1 className="text-xl font-semibold">{culture.name}</h1>
      </div>
      {culture.description !== null ? (
        <p className="text-sm text-muted-foreground">{culture.description}</p>
      ) : null}

      <CultureLoreForm
        canEdit={canEdit}
        culture={culture}
        queryClient={queryClient}
      />
    </CultureDetailFrame>
  );
}
