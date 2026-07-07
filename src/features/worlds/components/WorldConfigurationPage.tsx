import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { BuildingsConfigPanel } from "@/features/buildings";
import { WorldCalendarConfigPanel } from "@/features/calendar";
import { DepositsConfigPanel } from "@/features/deposits";
import { JobsConfigPanel } from "@/features/jobs";
import { ManagedPopulationsConfigPanel } from "@/features/managed-populations";
import { NamesetsConfigPanel } from "@/features/namesets";
import { NationDiscoveryConfigPanel } from "@/features/nations";
import {
  AdminSuppressedNotice,
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
} from "@/features/permissions";
import { ResourcesConfigPanel } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";

import { getVisibleConfigTabs } from "../configTabs";
import { worldRouteAccessQueryOptions } from "../queries/worldQueries";

import { WorldImagesPanel } from "./WorldImagesPanel";
import { WorldNpcFlavorConfigPanel } from "./WorldNpcFlavorConfigPanel";
import { WorldPopulationRulesConfigPanel } from "./WorldPopulationRulesConfigPanel";
import { WorldSettingsPanel } from "./WorldSettingsPanel";
import { WorldTemplateExportButton } from "./WorldTemplateExportButton";

import type { ConfigTabId } from "../configTabs";
import type { JSX, ReactNode } from "react";

type WorldConfigurationPageProps = {
  readonly activeTab: string;
  readonly selectedBlueprintId?: string;
  readonly worldId: string;
};

export function WorldConfigurationPage({
  activeTab,
  selectedBlueprintId,
  worldId,
}: WorldConfigurationPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  const isSuperAdmin = accessContextQuery.data?.isSuperAdmin ?? false;
  const visibleTabs = useMemo(
    () => getVisibleConfigTabs(isSuperAdmin),
    [isSuperAdmin],
  );

  const isTabVisible = visibleTabs.some((t) => t.id === activeTab);

  useEffect(() => {
    if (
      !accessContextQuery.isPending &&
      !isTabVisible &&
      visibleTabs.length > 0
    ) {
      void navigate({
        to: "/worlds/$worldId/configuration",
        params: { worldId },
        search: { tab: visibleTabs[0].id },
        replace: true,
      });
    }
  }, [
    accessContextQuery.isPending,
    isTabVisible,
    navigate,
    visibleTabs,
    worldId,
  ]);

  function handleTabSelect(id: ConfigTabId): void {
    void navigate({
      to: "/worlds/$worldId/configuration",
      params: { worldId },
      search: { tab: id },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to world
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-normal">Configuration</h1>

      {/* Mobile select — one-tap switching below md breakpoint; desktop
          navigation lives in the sidebar submenu. */}
      <div className="md:hidden">
        <NativeSelect
          aria-label="Configuration section"
          className="w-full"
          value={activeTab}
          onChange={(e) => handleTabSelect(e.target.value as ConfigTabId)}
        >
          {visibleTabs.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <section aria-label={`${activeTab} configuration`}>
        {accessContextQuery.isPending ? (
          <LoadingState label="Loading configuration…" />
        ) : accessContextQuery.isError ? (
          <ErrorState
            title="Configuration could not be loaded"
            description={getErrorDescription(accessContextQuery.error)}
          />
        ) : (
          <WorldConfigurationContent
            accessContext={accessContextQuery.data}
            activeTab={activeTab}
            queryClient={queryClient}
            selectedBlueprintId={selectedBlueprintId}
            worldId={worldId}
          />
        )}
      </section>
    </div>
  );
}

function WorldConfigurationContent({
  accessContext,
  activeTab,
  queryClient,
  selectedBlueprintId,
  worldId,
}: {
  readonly accessContext: Parameters<typeof worldRouteAccessQueryOptions>[1];
  readonly activeTab: string;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly selectedBlueprintId?: string;
  readonly worldId: string;
}): JSX.Element | null {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );
  // Must be called unconditionally before any early returns to satisfy
  // rules-of-hooks.
  const effectiveCanAdmin = useEffectiveCanAdmin(
    worldQuery.data?.canAdmin ?? false,
  );

  if (worldQuery.isPending) {
    return <LoadingState label="Loading configuration…" />;
  }

  if (worldQuery.isError) {
    return (
      <ErrorState
        title="Configuration could not be loaded"
        description={getErrorDescription(worldQuery.error)}
      />
    );
  }

  const { canAdmin, header } = worldQuery.data;

  // The route guard only rejects viewers who lack `canAdmin` outright; admin
  // capability suppressed by an active player character (see
  // useEffectiveCanAdmin) is explained here instead of being silently
  // redirected away.
  if (canAdmin && !effectiveCanAdmin) {
    return <AdminSuppressedNotice />;
  }

  function renderPanel(): JSX.Element | null {
    if (activeTab === "resources") {
      return (
        <ConfigPanelShell>
          <ResourcesConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "jobs") {
      return (
        <ConfigPanelShell>
          <JobsConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "buildings") {
      return (
        <ConfigPanelShell>
          <BuildingsConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            selectedBlueprintId={selectedBlueprintId}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "deposits") {
      return (
        <ConfigPanelShell>
          <DepositsConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "managed-populations") {
      return (
        <ConfigPanelShell>
          <ManagedPopulationsConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "calendar") {
      return (
        <ConfigPanelShell>
          <WorldCalendarConfigPanel
            accessContext={accessContext}
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "namesets") {
      return (
        <ConfigPanelShell>
          <NamesetsConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "discovery") {
      return (
        <ConfigPanelShell>
          <NationDiscoveryConfigPanel
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "npc-flavor") {
      return (
        <ConfigPanelShell>
          <WorldNpcFlavorConfigPanel
            accessContext={accessContext}
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "population-rules") {
      return (
        <ConfigPanelShell>
          <WorldPopulationRulesConfigPanel
            accessContext={accessContext}
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "images") {
      return (
        <ConfigPanelShell>
          <WorldImagesPanel
            accessContext={accessContext}
            canAdmin={canAdmin}
            isArchived={header.isArchived}
            worldId={worldId}
            worldName={header.name}
          />
        </ConfigPanelShell>
      );
    }

    if (activeTab === "world-settings") {
      if (!accessContext.isSuperAdmin) {
        return null;
      }
      return (
        <ConfigPanelShell>
          <WorldSettingsPanel
            currentTurnNumber={header.currentTurnNumber}
            queryClient={queryClient}
            worldId={worldId}
            worldName={header.name}
          />
        </ConfigPanelShell>
      );
    }

    return null;
  }

  return (
    <>
      {canAdmin && (
        <div className="mb-4 flex justify-end">
          <WorldTemplateExportButton
            worldId={worldId}
            worldName={header.name}
          />
        </div>
      )}
      {renderPanel()}
    </>
  );
}

function ConfigPanelShell({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-md border border-border bg-card p-4 text-card-foreground">
      {children}
    </section>
  );
}
