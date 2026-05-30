import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { WorldCalendarConfigPanel } from "@/features/calendar";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import { worldRouteAccessQueryOptions } from "../queries/worldQueries";

import { WorldBuildingsConfigPanel } from "./WorldBuildingsConfigPanel";
import { WorldDepositsConfigPanel } from "./WorldDepositsConfigPanel";
import { WorldJobsConfigPanel } from "./WorldJobsConfigPanel";
import { WorldManagedPopulationsConfigPanel } from "./WorldManagedPopulationsConfigPanel";
import { WorldNamingConfigPanel } from "./WorldNamingConfigPanel";
import { WorldNpcFlavorConfigPanel } from "./WorldNpcFlavorConfigPanel";
import { WorldPopulationRulesConfigPanel } from "./WorldPopulationRulesConfigPanel";
import { WorldResourcesConfigPanel } from "./WorldResourcesConfigPanel";

import type { JSX } from "react";

const TABS = [
  { key: "resources", label: "Resources" },
  { key: "jobs", label: "Jobs" },
  { key: "buildings", label: "Buildings" },
  { key: "deposits", label: "Deposits" },
  { key: "managed-populations", label: "Managed Populations" },
  { key: "calendar", label: "Calendar" },
  { key: "naming", label: "Naming" },
  { key: "npc-flavor", label: "NPC Flavor" },
  { key: "population-rules", label: "Population Rules" },
] as const;

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
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to world
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-normal">Configuration</h1>
      <div
        role="tablist"
        aria-label="Configuration sections"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            to="/worlds/$worldId/configuration"
            params={{ worldId }}
            search={{ tab: key }}
            className={cn(
              "rounded-t-sm px-3 py-2 text-sm font-medium transition-colors",
              activeTab === key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      <section
        role="tabpanel"
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
  selectedBlueprintId,
  worldId,
}: {
  readonly accessContext: Parameters<typeof worldRouteAccessQueryOptions>[1];
  readonly activeTab: string;
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

  if (activeTab === "resources") {
    return (
      <WorldResourcesConfigPanel
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "jobs") {
    return (
      <WorldJobsConfigPanel
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "buildings") {
    return (
      <WorldBuildingsConfigPanel
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        selectedBlueprintId={selectedBlueprintId}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "deposits") {
    return (
      <WorldDepositsConfigPanel
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "managed-populations") {
    return (
      <WorldManagedPopulationsConfigPanel
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "calendar") {
    return (
      <WorldCalendarConfigPanel
        accessContext={accessContext}
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "naming") {
    return (
      <WorldNamingConfigPanel
        accessContext={accessContext}
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "npc-flavor") {
    return (
      <WorldNpcFlavorConfigPanel
        accessContext={accessContext}
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  if (activeTab === "population-rules") {
    return (
      <WorldPopulationRulesConfigPanel
        accessContext={accessContext}
        canAdmin={worldQuery.data.canAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
    );
  }

  return null;
}
