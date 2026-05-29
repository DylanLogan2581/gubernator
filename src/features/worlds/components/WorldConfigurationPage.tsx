import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  readonly worldId: string;
};

export function WorldConfigurationPage({
  activeTab,
  worldId,
}: WorldConfigurationPageProps): JSX.Element {
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
      />
    </div>
  );
}
