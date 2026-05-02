// Calendar feature — in-world calendar state tied to turn progression.
// Implemented in Epic 2.
export { calendarQueryKeys } from "./queries/calendarQueryKeys";
export {
  WorldCalendarConfigError,
  isWorldCalendarConfigError,
  shouldRetryWorldCalendarConfigQuery,
  worldCalendarConfigQueryOptions,
} from "./queries/calendarQueries";
export {
  worldCalendarConfigSchema,
  type WorldCalendarConfig,
} from "./schemas/calendarConfigSchemas";
export {
  resolveTurnCalendarDate,
  type TurnCalendarDate,
} from "./utils/turnCalendarDates";
export {
  formatCalendarDate,
  formatCalendarYear,
  type CalendarDateDisplayVariant,
  type CalendarDateFormatOptions,
} from "./utils/calendarDateFormatting";
