import type { WorldCalendarConfig } from "@/features/calendar";

export type BasicEndTurnReadinessRow = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
};

export type BasicEndTurnTransitionInput = {
  readonly actorId: string;
  readonly calendarConfig: WorldCalendarConfig;
  readonly expectedCurrentTurnNumber: number;
  readonly isWorldArchived: boolean;
  readonly readinessRows: readonly BasicEndTurnReadinessRow[];
  readonly worldId: string;
};
