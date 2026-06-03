import { useQuery } from "@tanstack/react-query";

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
  const notificationGroups = groupNotificationsByType(outcome.notifications);
  const deltas = computeDeltas(
    outcome.settlementSnapshots,
    outcome.notifications,
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
          {notificationGroups.map((group) => (
            <div key={group.type} className="space-y-1">
              <p className="text-sm font-medium">
                {notificationTypeLabel(group.type)} (
                {group.notifications.length.toString()})
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {group.notifications.map((n) => (
                  <li key={n.id}>{n.messageText}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No notifications for this transition.
        </p>
      )}
    </section>
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
