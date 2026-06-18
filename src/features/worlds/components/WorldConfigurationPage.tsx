import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuildingsConfigPanel } from "@/features/buildings";
import { WorldCalendarConfigPanel } from "@/features/calendar";
import { DepositsConfigPanel } from "@/features/deposits";
import { JobsConfigPanel } from "@/features/jobs";
import { ManagedPopulationsConfigPanel } from "@/features/managed-populations";
import { NamesetsConfigPanel } from "@/features/namesets";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import { ResourcesConfigPanel } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";

import { worldRouteAccessQueryOptions } from "../queries/worldQueries";

import { WorldNpcFlavorConfigPanel } from "./WorldNpcFlavorConfigPanel";
import { WorldPopulationRulesConfigPanel } from "./WorldPopulationRulesConfigPanel";
import { WorldSettingsPanel } from "./WorldSettingsPanel";
import { WorldTemplateExportButton } from "./WorldTemplateExportButton";

import type { JSX, ReactNode } from "react";

const BASE_TABS = [
  { key: "resources", label: "Resources" },
  { key: "jobs", label: "Jobs" },
  { key: "buildings", label: "Buildings" },
  { key: "deposits", label: "Deposits" },
  { key: "managed-populations", label: "Managed Populations" },
  { key: "calendar", label: "Calendar" },
  { key: "namesets", label: "Namesets" },
  { key: "npc-flavor", label: "NPC Flavor" },
  { key: "population-rules", label: "Population Rules" },
] as const;

const SUPER_ADMIN_TABS = [
  { key: "world-settings", label: "World settings" },
] as const;

type TabKey =
  | (typeof BASE_TABS)[number]["key"]
  | (typeof SUPER_ADMIN_TABS)[number]["key"];

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
  const visibleTabs: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
  }> = isSuperAdmin ? [...BASE_TABS, ...SUPER_ADMIN_TABS] : [...BASE_TABS];

  function handleTabSelect(key: TabKey): void {
    void navigate({
      to: "/worlds/$worldId/configuration",
      params: { worldId },
      search: { tab: key },
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to world
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-normal">Configuration</h1>

      {/* Mobile select — visible below md breakpoint */}
      <div className="md:hidden">
        <NativeSelect
          aria-label="Configuration section"
          className="w-full"
          value={activeTab}
          onChange={(e) => handleTabSelect(e.target.value as TabKey)}
        >
          {visibleTabs.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Desktop tab strip — scrollable, visible from md up */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          handleTabSelect(v as TabKey);
        }}
      >
        <TabsList className="hidden overflow-x-auto [scrollbar-width:none] md:flex">
          {visibleTabs.map(({ key, label }) => (
            <TabsTrigger key={key} value={key} className="shrink-0">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <section
        aria-label={`${activeTab} configuration`}
        className="min-h-[200px]"
      >
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
    <section className="rounded-md border border-border bg-card p-5 text-card-foreground">
      {children}
    </section>
  );
}
