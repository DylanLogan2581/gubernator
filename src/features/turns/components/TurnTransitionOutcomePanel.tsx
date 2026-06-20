import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  latestSettlementTransitionOutcomeQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
} from "../queries/turnTransitionOutcomeQueries";
import {
  computeDeltas,
  groupNotificationsByType,
  notificationTypeLabel,
  sortNotificationsBySettlement,
} from "../utils/transitionOutcome";

import { MetricTile } from "./EndTurnMetric";
import { ForecastComparisonSection } from "./ForecastComparisonSection";

import type { TurnTransitionOutcome } from "../queries/turnTransitionOutcomeQueries";
import type { JSX, ReactNode } from "react";

type TurnTransitionOutcomePanelProps = {
  readonly id: string;
  readonly scope: "settlement" | "world";
};

export function TurnTransitionOutcomePanel({
  id,
  scope,
}: TurnTransitionOutcomePanelProps): JSX.Element {
  if (scope === "world") {
    return <WorldTransitionOutcomePanel worldId={id} />;
  }
  return <SettlementTransitionOutcomePanel settlementId={id} />;
}

function WorldTransitionOutcomePanel({
  worldId,
}: {
  readonly worldId: string;
}): JSX.Element {
  const query = useQuery(latestWorldTransitionOutcomeQueryOptions(worldId));
  return <OutcomePanelQueryResult query={query} />;
}

function SettlementTransitionOutcomePanel({
  settlementId,
}: {
  readonly settlementId: string;
}): JSX.Element {
  const query = useQuery(
    latestSettlementTransitionOutcomeQueryOptions(settlementId),
  );
  return <OutcomePanelQueryResult query={query} />;
}

function TurnTransitionOutcomeSkeleton(): JSX.Element {
  return (
    <OutcomePanelFrame>
      <div className="space-y-1">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>
      <dl className="grid gap-3 sm:grid-cols-4">
        {([0, 1, 2, 3] as const).map((i) => (
          <div
            key={i}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <Skeleton className="mb-1 h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </dl>
    </OutcomePanelFrame>
  );
}

function OutcomePanelQueryResult({
  query,
}: {
  readonly query: {
    readonly data?: TurnTransitionOutcome | null;
    readonly isError: boolean;
    readonly isSuccess: boolean;
    readonly isPending: boolean;
    readonly error: Error | null;
  };
}): JSX.Element {
  if (query.isPending) {
    return <TurnTransitionOutcomeSkeleton />;
  }

  if (query.isError) {
    return (
      <OutcomePanelFrame>
        <ErrorState
          title="Transition outcome could not be loaded"
          description={getErrorDescription(
            query.error ?? new Error("Unknown error"),
          )}
        />
      </OutcomePanelFrame>
    );
  }

  if (!query.isSuccess || query.data === null || query.data === undefined) {
    return <TurnTransitionOutcomeEmptyState />;
  }

  return <TurnTransitionOutcomeContent outcome={query.data} />;
}

export function TurnTransitionOutcomeEmptyState(): JSX.Element {
  return (
    <section
      aria-labelledby="turn-transition-outcome-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="space-y-1">
        <h2
          id="turn-transition-outcome-title"
          className="text-lg font-semibold tracking-normal"
        >
          Last transition
        </h2>
        <p className="text-sm text-muted-foreground">
          No transitions have run yet on the new simulation engine.
        </p>
      </div>
    </section>
  );
}

export function TurnTransitionOutcomeContent({
  outcome,
}: {
  readonly outcome: TurnTransitionOutcome;
}): JSX.Element {
  const notificationGroups = useMemo(
    () => groupNotificationsByType(outcome.notifications),
    [outcome.notifications],
  );
  const deltas = useMemo(
    () => computeDeltas(outcome.settlementSnapshots, outcome.notifications),
    [outcome.settlementSnapshots, outcome.notifications],
  );

  const allCategories = useMemo(
    () =>
      notificationGroups.map((g) => g.type).sort((a, b) => a.localeCompare(b)),
    [notificationGroups],
  );

  // Empty = no filter = show all. Selecting tags narrows to those categories.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const resetFilter = (): void => {
    setSelectedCategories([]);
  };

  const filteredGroups = useMemo(
    () =>
      selectedCategories.length === 0
        ? notificationGroups
        : notificationGroups.filter((group) =>
            selectedCategories.includes(group.type),
          ),
    [notificationGroups, selectedCategories],
  );

  const visibleGroups = useMemo(
    () =>
      filteredGroups.map((group) => ({
        ...group,
        notifications: sortNotificationsBySettlement(group.notifications),
      })),
    [filteredGroups],
  );

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="turn-transition-outcome-title"
        className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <div className="space-y-1">
          <h2
            id="turn-transition-outcome-title"
            className="text-lg font-semibold tracking-normal"
          >
            Last transition
          </h2>
          <p className="text-sm text-muted-foreground">
            {`Turn ${outcome.fromTurnNumber.toString()} → ${outcome.toTurnNumber.toString()}`}
            {outcome.finishedAt !== null
              ? ` · ${outcome.finishedAt.slice(0, 10)}`
              : null}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-4">
          <MetricTile label="Births" value={deltas.births} />
          <MetricTile label="Deaths" value={deltas.deaths} />
          <MetricTile
            label="Buildings Suspended"
            value={deltas.buildingsSuspended}
          />
          <MetricTile
            label="Deposits Depleted"
            value={deltas.depositsDepleted}
          />
        </dl>

        {notificationGroups.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Notifications this turn</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetFilter}
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategories.length === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary"
                }`}
              >
                All
              </button>
              <ToggleGroup
                type="multiple"
                value={selectedCategories}
                onValueChange={setSelectedCategories}
                className="justify-start"
              >
                {allCategories.map((category) => (
                  <ToggleGroupItem
                    key={category}
                    value={category}
                    className="rounded-full border px-3 py-1 text-xs font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    aria-label={`Filter by ${notificationTypeLabel(category)}`}
                  >
                    {notificationTypeLabel(category)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {visibleGroups.map((group) => (
                <AccordionItem
                  key={group.type}
                  value={group.type}
                  className="rounded-md border border-border"
                >
                  <AccordionTrigger className="flex cursor-pointer items-center justify-between bg-muted/50 px-4 py-3 font-medium text-sm hover:bg-muted hover:no-underline">
                    <span>
                      {notificationTypeLabel(group.type)} (
                      {group.notifications.length.toString()})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    <ul className="space-y-1">
                      {group.notifications.map((n) => (
                        <li key={n.id}>{n.messageText}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No notifications for this transition.
          </p>
        )}
      </section>

      <ForecastComparisonSection outcome={outcome} />
    </div>
  );
}

// -- Components --

function OutcomePanelFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      aria-labelledby="turn-transition-outcome-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      {children}
    </section>
  );
}
