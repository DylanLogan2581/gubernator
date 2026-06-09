import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  latestSettlementTransitionOutcomeQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
} from "../queries/turnTransitionOutcomeQueries";

import type {
  TurnTransitionNotification,
  TurnTransitionOutcome,
  TurnTransitionSettlementSnapshot,
} from "../queries/turnTransitionOutcomeQueries";
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
    return (
      <OutcomePanelFrame>
        <LoadingState label="Loading transition outcome…" />
      </OutcomePanelFrame>
    );
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

  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(allCategories);

  const toggleCategory = (category: string): void => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const resetFilter = (): void => {
    setSelectedCategories(allCategories);
  };

  const filteredGroups = useMemo(
    () =>
      notificationGroups.filter((group) =>
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
        <OutcomeMetric label="Births" value={deltas.births} />
        <OutcomeMetric label="Deaths" value={deltas.deaths} />
        <OutcomeMetric
          label="Buildings suspended"
          value={deltas.buildingsSuspended}
        />
        <OutcomeMetric
          label="Deposits depleted"
          value={deltas.depositsDepleted}
        />
      </dl>

      {notificationGroups.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Notifications</h3>
          <CategoryFilterChips
            categories={allCategories}
            selectedCategories={selectedCategories}
            onToggle={toggleCategory}
            onReset={resetFilter}
          />
          <div className="space-y-2">
            {visibleGroups.map((group) => (
              <NotificationGroupAccordion
                key={group.type}
                type={group.type}
                notifications={group.notifications}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No notifications for this transition.
        </p>
      )}
    </section>
  );
}

// -- Components --

function CategoryFilterChips({
  categories,
  selectedCategories,
  onToggle,
  onReset,
}: {
  readonly categories: string[];
  readonly selectedCategories: string[];
  readonly onToggle: (category: string) => void;
  readonly onReset: () => void;
}): JSX.Element {
  const isAllSelected = selectedCategories.length === categories.length;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onReset}
        className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          isAllSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground hover:border-primary"
        }`}
        aria-pressed={isAllSelected}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onToggle(category)}
          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selectedCategories.includes(category)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary"
          }`}
          aria-pressed={selectedCategories.includes(category)}
        >
          {notificationTypeLabel(category)}
        </button>
      ))}
    </div>
  );
}

function NotificationGroupAccordion({
  type,
  notifications,
}: {
  readonly type: string;
  readonly notifications: TurnTransitionNotification[];
}): JSX.Element {
  return (
    <details className="group rounded-md border border-border">
      <summary className="flex cursor-pointer items-center justify-between bg-muted/50 px-4 py-3 font-medium text-sm hover:bg-muted">
        <span>
          {notificationTypeLabel(type)} ({notifications.length.toString()})
        </span>
        <svg
          className="h-4 w-4 transition-transform group-open:rotate-180"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <ul className="space-y-1 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        {notifications.map((n) => (
          <li key={n.id}>{n.messageText}</li>
        ))}
      </ul>
    </details>
  );
}

// -- Internal helpers --

type NotificationGroup = {
  readonly notifications: TurnTransitionNotification[];
  readonly type: string;
};

type OutcomeDeltas = {
  readonly births: number;
  readonly buildingsSuspended: number;
  readonly deaths: number;
  readonly depositsDepleted: number;
};

function groupNotificationsByType(
  notifications: readonly TurnTransitionNotification[],
): NotificationGroup[] {
  const groups = new Map<string, TurnTransitionNotification[]>();
  for (const notification of notifications) {
    const existing = groups.get(notification.notificationType);
    if (existing !== undefined) {
      existing.push(notification);
    } else {
      groups.set(notification.notificationType, [notification]);
    }
  }
  return [...groups.entries()].map(([type, notifs]) => ({
    notifications: notifs,
    type,
  }));
}

function computeDeltas(
  snapshots: readonly TurnTransitionSettlementSnapshot[],
  notifications: readonly TurnTransitionNotification[],
): OutcomeDeltas {
  const births = snapshots.reduce((sum, s) => sum + s.birthCount, 0);
  const deaths = snapshots.reduce((sum, s) => sum + s.deathCount, 0);
  const buildingsSuspended = notifications.filter(
    (n) => n.notificationType === "building.suspended",
  ).length;
  const depositsDepleted = notifications.filter(
    (n) => n.notificationType === "deposit.depleted",
  ).length;
  return { births, buildingsSuspended, deaths, depositsDepleted };
}

function sortNotificationsBySettlement(
  notifications: readonly TurnTransitionNotification[],
): TurnTransitionNotification[] {
  return [...notifications].sort((a, b) => {
    // Sort by settlementId first, then by messageText
    const settlementCmp = (a.settlementId ?? "").localeCompare(
      b.settlementId ?? "",
    );
    if (settlementCmp !== 0) {
      return settlementCmp;
    }
    return a.messageText.localeCompare(b.messageText);
  });
}

const NOTIFICATION_LABELS: Readonly<Record<string, string>> = {
  "building.auto_deconstructed": "Buildings auto-deconstructed",
  "building.suspended": "Buildings suspended",
  "construction.completed": "Constructions completed",
  "construction.paused": "Constructions paused",
  "deposit.depleted": "Deposits depleted",
  "managed_population.declining": "Managed populations declining",
  "managed_population.extinct": "Managed populations extinct",
  "partnership.formed": "Partnerships formed",
  "partnership.widowed": "Widowhoods",
  "settlement.homelessness_occurred": "Homelessness events",
  "settlement.starvation_occurred": "Starvation events",
  "trade_route.paused": "Trade routes paused",
  "trade_route.resumed": "Trade routes resumed",
};

function notificationTypeLabel(type: string): string {
  return NOTIFICATION_LABELS[type] ?? type;
}

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

function OutcomeMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-normal">{value}</dd>
    </div>
  );
}
