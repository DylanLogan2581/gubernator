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

import { religionByIdQueryOptions } from "../../queries/religionsQueries";

import { ReligionDetailFrame } from "./ReligionDetailFrame";
import { ReligionLoreForm } from "./ReligionLoreForm";

import type { Religion } from "../../types/religionTypes";
import type { JSX } from "react";

type ReligionDetailPageProps = {
  readonly religionId: string;
  readonly worldId: string;
};

export function ReligionDetailPage({
  religionId,
  worldId,
}: ReligionDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </ReligionDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </ReligionDetailFrame>
    );
  }

  return (
    <ReligionDetailWorldGate
      accessContext={accessContextQuery.data}
      religionId={religionId}
      worldId={worldId}
    />
  );
}

function ReligionDetailWorldGate({
  accessContext,
  religionId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly religionId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </ReligionDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </ReligionDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <ReligionDetailFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </ReligionDetailFrame>
      );
    }

    return (
      <ReligionDetailFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </ReligionDetailFrame>
    );
  }

  return (
    <ReligionDetailContent
      religionId={religionId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function ReligionDetailContent({
  religionId,
  worldAccess,
  worldId,
}: {
  readonly religionId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const religionQuery = useQuery(religionByIdQueryOptions(religionId));
  // Must be called unconditionally before any early returns to satisfy rules-of-hooks.
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  if (religionQuery.isPending) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <LoadingState label="Loading religion…" />
      </ReligionDetailFrame>
    );
  }

  if (religionQuery.isError) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <ErrorState
          title="Religion could not be loaded"
          description={getErrorDescription(religionQuery.error)}
        />
      </ReligionDetailFrame>
    );
  }

  const religion = religionQuery.data;
  if (religion === null || religion.worldId !== worldId) {
    return (
      <ReligionDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Religion unavailable"
          description="This religion does not exist or is not part of this world."
        />
      </ReligionDetailFrame>
    );
  }

  const canEdit = effectiveCanAdmin && !worldAccess.header.isArchived;

  return (
    <ReligionDetailLoaded
      canEdit={canEdit}
      rawCanAdmin={worldAccess.canAdmin}
      religion={religion}
      worldId={worldId}
    />
  );
}

function ReligionDetailLoaded({
  canEdit,
  rawCanAdmin,
  religion,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly rawCanAdmin: boolean;
  readonly religion: Religion;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();

  return (
    <ReligionDetailFrame worldId={worldId}>
      <AdminPausedHint canAdmin={rawCanAdmin} />

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full"
          style={{ backgroundColor: religion.color }}
        />
        <h1 className="text-xl font-semibold">{religion.name}</h1>
      </div>
      {religion.description !== null ? (
        <p className="text-sm text-muted-foreground">{religion.description}</p>
      ) : null}

      <ReligionLoreForm
        canEdit={canEdit}
        queryClient={queryClient}
        religion={religion}
      />
    </ReligionDetailFrame>
  );
}
