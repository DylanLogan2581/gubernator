import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const calendarQueryKeys = {
  all: authStateQueryCacheKeys.calendarAll,
  computedWorldDate: (worldId: string) =>
    [...calendarQueryKeys.all, "computed-world-date", worldId] as const,
  worldCalendarConfig: (worldId: string) =>
    [...calendarQueryKeys.all, "world-calendar-config", worldId] as const,
} as const;
