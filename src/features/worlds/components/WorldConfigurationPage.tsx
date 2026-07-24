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
import { CulturesConfigPanel } from "@/features/cultures";
import { DepositsConfigPanel } from "@/features/deposits";
import { EducationConfigPanel } from "@/features/education";
import { JobsConfigPanel } from "@/features/jobs";
import { ManagedPopulationsConfigPanel } from "@/features/managed-populations";
import { MilitaryConfigPanel } from "@/features/military";
import { NamesetsConfigPanel } from "@/features/namesets";
import { NationDiscoveryConfigPanel } from "@/features/nations";
import {
  AdminSuppressedNotice,
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
} from "@/features/permissions";
import { ReligionsConfigPanel } from "@/features/religions";
import { ResourcesConfigPanel } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";

import { CONFIG_TAB_IDS, getVisibleConfigTabs } from "../configTabs";
import { worldRouteAccessQueryOptions } from "../queries/worldQueries";

import { WorldImagesPanel } from "./WorldImagesPanel";
import { WorldNpcFlavorConfigPanel } from "./WorldNpcFlavorConfigPanel";
import { WorldPopulationRulesConfigPanel } from "./WorldPopulationRulesConfigPanel";
import { WorldSettingsPanel } from "./WorldSettingsPanel";
import { WorldTemplateExportButton } from "./WorldTemplateExportButton";

import type { ConfigTabId } from "../configTabs";
import type { WorldRouteAccess } from "../types/worldTypes";
import type { JSX, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Panel lookup table — companion to `getVisibleConfigTabs` / CONFIG_TABS in
// ../configTabs. Every ConfigTabId must map to a renderer (Record enforces
// exhaustiveness).
// ---------------------------------------------------------------------------

type PanelRenderProps = {
  readonly accessContext: Parameters<typeof worldRouteAccessQueryOptions>[1];
  readonly canAdmin: boolean;
  readonly header: WorldRouteAccess["header"];
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly worldId: string;
};

function basePanelProps({ canAdmin, header, worldId }: PanelRenderProps): {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
} {
  return { canAdmin, isArchived: header.isArchived, worldId };
}

const CONFIG_PANEL_RENDERERS: Record<
  ConfigTabId,
  (props: PanelRenderProps) => JSX.Element | null
> = {
  resources: (p) => <ResourcesConfigPanel {...basePanelProps(p)} />,
  jobs: (p) => <JobsConfigPanel {...basePanelProps(p)} />,
  buildings: (p) => <BuildingsConfigPanel {...basePanelProps(p)} />,
  deposits: (p) => <DepositsConfigPanel {...basePanelProps(p)} />,
  "managed-populations": (p) => (
    <ManagedPopulationsConfigPanel {...basePanelProps(p)} />
  ),
  cultures: (p) => (
    <ConfigPanelShell>
      <CulturesConfigPanel {...basePanelProps(p)} />
    </ConfigPanelShell>
  ),
  religions: (p) => (
    <ConfigPanelShell>
      <ReligionsConfigPanel {...basePanelProps(p)} />
    </ConfigPanelShell>
  ),
  education: (p) => <EducationConfigPanel {...basePanelProps(p)} />,
  military: (p) => <MilitaryConfigPanel {...basePanelProps(p)} />,
  calendar: (p) => (
    <WorldCalendarConfigPanel
      accessContext={p.accessContext}
      {...basePanelProps(p)}
    />
  ),
  namesets: (p) => <NamesetsConfigPanel {...basePanelProps(p)} />,
  discovery: (p) => <NationDiscoveryConfigPanel {...basePanelProps(p)} />,
  "npc-flavor": (p) => (
    <WorldNpcFlavorConfigPanel
      accessContext={p.accessContext}
      {...basePanelProps(p)}
    />
  ),
  "population-rules": (p) => (
    <WorldPopulationRulesConfigPanel
      accessContext={p.accessContext}
      {...basePanelProps(p)}
    />
  ),
  images: (p) => (
    <WorldImagesPanel
      accessContext={p.accessContext}
      {...basePanelProps(p)}
      worldName={p.header.name}
    />
  ),
  "world-settings": (p) =>
    p.accessContext.isSuperAdmin ? (
      <WorldSettingsPanel
        currentTurnNumber={p.header.currentTurnNumber}
        queryClient={p.queryClient}
        worldId={p.worldId}
        worldName={p.header.name}
      />
    ) : null,
};

function isConfigTabId(id: string): id is ConfigTabId {
  return (CONFIG_TAB_IDS as readonly string[]).includes(id);
}

type WorldConfigurationPageProps = {
  readonly activeTab: string;
  readonly worldId: string;
};

export function WorldConfigurationPage({
  activeTab,
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
  worldId,
}: {
  readonly accessContext: Parameters<typeof worldRouteAccessQueryOptions>[1];
  readonly activeTab: string;
  readonly queryClient: ReturnType<typeof useQueryClient>;
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
      {isConfigTabId(activeTab)
        ? CONFIG_PANEL_RENDERERS[activeTab]({
            accessContext,
            canAdmin,
            header,
            queryClient,
            worldId,
          })
        : null}
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
