import type {
  TurnCalendarDate,
  WorldCalendarConfig,
} from "@/features/calendar";

export type BasicEndTurnReadinessRow = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
};

export type BasicEndTurnTransitionInput = {
  readonly actorId: string;
  readonly calendarConfig: WorldCalendarConfig;
  readonly currentTurnNumber: number;
  readonly expectedCurrentTurnNumber: number;
  readonly isWorldArchived: boolean;
  readonly readinessRows: readonly BasicEndTurnReadinessRow[];
  readonly worldId: string;
};

export type BasicEndTurnReadinessSummary = {
  readonly notReadySettlementCount: number;
  readonly readyPercentage: number;
  readonly readySettlementCount: number;
  readonly totalSettlementCount: number;
};

export type BasicEndTurnLogPayload = {
  readonly category: "turn_transition";
  readonly fromTurnNumber: number;
  readonly nextDate: TurnCalendarDate;
  readonly previousDate: TurnCalendarDate;
  readonly readinessSummary: BasicEndTurnReadinessSummary;
  readonly toTurnNumber: number;
};

export type BasicEndTurnNotificationPayload = {
  readonly messageText: string;
  readonly notificationType: "turn_advanced";
};

export type BasicEndTurnTransitionResult = {
  readonly fromTurnNumber: number;
  readonly logPayload: BasicEndTurnLogPayload;
  readonly nextDate: TurnCalendarDate;
  readonly notificationPayload: BasicEndTurnNotificationPayload;
  readonly previousDate: TurnCalendarDate;
  readonly readinessSummary: BasicEndTurnReadinessSummary;
  readonly toTurnNumber: number;
};
