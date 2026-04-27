export const permissionQueryKeys = {
  all: ["permissions"] as const,
  currentAccessContext: () =>
    [...permissionQueryKeys.all, "current-access-context"] as const,
} as const;
