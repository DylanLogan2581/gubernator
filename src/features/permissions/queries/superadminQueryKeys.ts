export const superadminQueryKeys = {
  all: ["superadmin"] as const,
  users: () => [...superadminQueryKeys.all, "users"] as const,
  worlds: () => [...superadminQueryKeys.all, "worlds"] as const,
  worldAdminsForUser: (userId: string) =>
    [...superadminQueryKeys.all, "world-admins", userId] as const,
} as const;
