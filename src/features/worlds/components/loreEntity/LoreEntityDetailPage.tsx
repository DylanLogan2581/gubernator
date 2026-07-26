import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { DetailPageFrame } from "@/components/shared/DetailPageFrame";
import { DetailPageHeader } from "@/components/shared/DetailPageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  AdminPausedHint,
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
  type AccessContext,
} from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "../../queries/worldQueries";

import { LoreEntityLoreForm } from "./LoreEntityLoreForm";

import type {
  LoreEntityBase,
  LoreEntityDescriptor,
  LoreEntityLabels,
} from "./LoreEntityTypes";
import type { ConfigTabId } from "../../configTabs";
import type { WorldRouteAccess } from "../../types/worldTypes";
import type { JSX, ReactNode } from "react";

function LoreEntityDetailFrame({
  children,
  configTab,
  labels,
  worldId,
}: {
  readonly children: ReactNode;
  readonly configTab: ConfigTabId;
  readonly labels: LoreEntityLabels;
  readonly worldId: string;
}): JSX.Element {
  return (
    <DetailPageFrame
      backLink={
        <Link
          to="/worlds/$worldId/configuration"
          params={{ worldId }}
          search={{ tab: configTab }}
        >
          <ArrowLeft aria-hidden="true" />
          Back to {labels.plural}
        </Link>
      }
    >
      {children}
    </DetailPageFrame>
  );
}

type LoreEntityDetailPageProps<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
> = {
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entityId: string;
  readonly worldId: string;
};

export function LoreEntityDetailPage<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  descriptor,
  entityId,
  worldId,
}: LoreEntityDetailPageProps<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError
>): JSX.Element {
  const { labels } = descriptor;
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <LoadingState label="Loading world access…" />
      </LoreEntityDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </LoreEntityDetailFrame>
    );
  }

  return (
    <LoreEntityDetailWorldGate
      accessContext={accessContextQuery.data}
      descriptor={descriptor}
      entityId={entityId}
      worldId={worldId}
    />
  );
}

function LoreEntityDetailWorldGate<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  accessContext,
  descriptor,
  entityId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entityId: string;
  readonly worldId: string;
}): JSX.Element {
  const { labels } = descriptor;
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </LoreEntityDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <LoadingState label="Loading world…" />
      </LoreEntityDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <LoreEntityDetailFrame
          configTab={descriptor.configTab}
          labels={labels}
          worldId={worldId}
        >
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </LoreEntityDetailFrame>
      );
    }

    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </LoreEntityDetailFrame>
    );
  }

  return (
    <LoreEntityDetailContent
      descriptor={descriptor}
      entityId={entityId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function LoreEntityDetailContent<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  descriptor,
  entityId,
  worldAccess,
  worldId,
}: {
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entityId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const { labels } = descriptor;
  const entityQuery = useQuery(descriptor.queries.byId(entityId));
  // Must be called unconditionally before any early returns to satisfy rules-of-hooks.
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  if (entityQuery.isPending) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <LoadingState label={`Loading ${labels.singular}…`} />
      </LoreEntityDetailFrame>
    );
  }

  if (entityQuery.isError) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <ErrorState
          title={`${labels.singularCapital} could not be loaded`}
          description={getErrorDescription(entityQuery.error)}
        />
      </LoreEntityDetailFrame>
    );
  }

  const entity = entityQuery.data;
  if (entity === null || entity.worldId !== worldId) {
    return (
      <LoreEntityDetailFrame
        configTab={descriptor.configTab}
        labels={labels}
        worldId={worldId}
      >
        <AccessDeniedState
          title={`${labels.singularCapital} unavailable`}
          description={`This ${labels.singular} does not exist or is not part of this world.`}
        />
      </LoreEntityDetailFrame>
    );
  }

  const canEdit = effectiveCanAdmin && !worldAccess.header.isArchived;

  return (
    <LoreEntityDetailLoaded
      canEdit={canEdit}
      descriptor={descriptor}
      entity={entity}
      rawCanAdmin={worldAccess.canAdmin}
      worldId={worldId}
    />
  );
}

function LoreEntityDetailLoaded<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  canEdit,
  descriptor,
  entity,
  rawCanAdmin,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entity: TEntity;
  readonly rawCanAdmin: boolean;
  readonly worldId: string;
}): JSX.Element {
  const { labels } = descriptor;
  const queryClient = useQueryClient();

  return (
    <LoreEntityDetailFrame
      configTab={descriptor.configTab}
      labels={labels}
      worldId={worldId}
    >
      <AdminPausedHint canAdmin={rawCanAdmin} />

      <DetailPageHeader
        media={
          <span
            aria-hidden="true"
            className="size-12 shrink-0 rounded-md"
            style={{ backgroundColor: entity.color }}
          />
        }
        title={entity.name}
        context={entity.description ?? undefined}
      />

      <LoreEntityLoreForm
        canEdit={canEdit}
        descriptor={descriptor}
        entity={entity}
        queryClient={queryClient}
      />
    </LoreEntityDetailFrame>
  );
}
