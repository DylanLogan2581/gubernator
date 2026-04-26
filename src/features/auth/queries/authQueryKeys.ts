export const authQueryKeys = {
  all: ["auth"] as const,
  currentAppUser: () => [...authQueryKeys.all, "current-app-user"] as const,
  currentSession: () => [...authQueryKeys.all, "current-session"] as const,
} as const;
