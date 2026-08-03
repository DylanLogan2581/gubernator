export const superadminQueryKeys = {
  all: ["superadmin"] as const,
  users: () => [...superadminQueryKeys.all, "users"] as const,
  worlds: () => [...superadminQueryKeys.all, "worlds"] as const,
  worldAdminsForUser: (userId: string) =>
    [...superadminQueryKeys.all, "world-admins", userId] as const,
  userLivingPlayerCharacters: (userId: string) =>
    [...superadminQueryKeys.all, "user-living-pcs", userId] as const,
  userActivePlayerCharacterRows: (userId: string) =>
    [...superadminQueryKeys.all, "user-active-pc-rows", userId] as const,
  runningTransitions: () =>
    [...superadminQueryKeys.all, "running-transitions"] as const,
  trashedWorlds: () => [...superadminQueryKeys.all, "trashed-worlds"] as const,
  smtpStatus: () => [...superadminQueryKeys.all, "smtp-status"] as const,
  retentionConfig: (worldId: string) =>
    [...superadminQueryKeys.all, "retention-config", worldId] as const,
} as const;
