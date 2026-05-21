import type {
  TurnCalendarDate,
  WorldCalendarConfig,
} from "@/features/calendar";

export type CurrentTurnDateDisplayLabels = {
  readonly compactDateLabel: string;
  readonly dateLabel: string;
  readonly turnLabel: string;
  readonly yearLabel: string;
};

export type CurrentTurnDateDisplay = {
  readonly calendarConfig: WorldCalendarConfig;
  readonly computedDate: TurnCalendarDate;
  readonly currentTurnNumber: number;
  readonly displayLabels: CurrentTurnDateDisplayLabels;
  readonly worldId: string;
};
