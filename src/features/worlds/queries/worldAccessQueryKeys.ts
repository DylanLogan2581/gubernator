export const worldAccessQueryKeys = {
  all: ["world-access"] as const,
  currentUserAdminWorldIds: (userId: string) =>
    [
      ...worldAccessQueryKeys.all,
      "current-user-admin-world-ids",
      userId,
    ] as const,
} as const;
