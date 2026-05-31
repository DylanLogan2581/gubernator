import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuildingsConfigPanel } from "@/features/buildings";
import { WorldCalendarConfigPanel } from "@/features/calendar";
import { DepositsConfigPanel } from "@/features/deposits";
import { JobsConfigPanel } from "@/features/jobs";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import { ResourcesConfigPanel } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import { worldRouteAccessQueryOptions } from "../queries/worldQueries";

import { WorldManagedPopulationsConfigPanel } from "./WorldManagedPopulationsConfigPanel";
import { WorldNamingConfigPanel } from "./WorldNamingConfigPanel";
import { WorldNpcFlavorConfigPanel } from "./WorldNpcFlavorConfigPanel";
import { WorldPopulationRulesConfigPanel } from "./WorldPopulationRulesConfigPanel";

import type { JSX, ReactNode } from "react";

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

type TabKey = (typeof TABS)[number]["key"];

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

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label ?? activeTab;

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
        <Select
          value={activeTab}
          onValueChange={(v) => handleTabSelect(v as TabKey)}
        >
          <SelectTrigger aria-label="Configuration section" className="w-full">
            <SelectValue>{activeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TABS.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop tab strip — scrollable, visible from md up */}
      <nav
        aria-label="Configuration sections"
        className="hidden overflow-x-auto border-b border-border [scrollbar-width:none] md:flex"
      >
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            aria-current={activeTab === key ? "page" : undefined}
            to="/worlds/$worldId/configuration"
            params={{ worldId }}
            search={{ tab: key }}
            className={cn(
              "shrink-0 rounded-t-sm px-3 py-2 text-sm font-medium transition-colors",
              activeTab === key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
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
      <ConfigPanelShell>
        <ResourcesConfigPanel
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
          worldId={worldId}
        />
      </ConfigPanelShell>
    );
  }

  if (activeTab === "jobs") {
    return (
      <ConfigPanelShell>
        <JobsConfigPanel
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
          worldId={worldId}
        />
      </ConfigPanelShell>
    );
  }

  if (activeTab === "buildings") {
    return (
      <ConfigPanelShell>
        <BuildingsConfigPanel
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
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
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
          worldId={worldId}
        />
      </ConfigPanelShell>
    );
  }

  if (activeTab === "managed-populations") {
    return (
      <ConfigPanelShell>
        <WorldManagedPopulationsConfigPanel
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
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
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
          worldId={worldId}
        />
      </ConfigPanelShell>
    );
  }

  if (activeTab === "naming") {
    return (
      <ConfigPanelShell>
        <WorldNamingConfigPanel
          accessContext={accessContext}
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
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
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
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
          canAdmin={worldQuery.data.canAdmin}
          isArchived={worldQuery.data.header.isArchived}
          worldId={worldId}
        />
      </ConfigPanelShell>
    );
  }

  return null;
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
