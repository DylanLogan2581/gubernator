import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const permissionQueryKeys = {
  all: authStateQueryCacheKeys.permissionsAll,
  activePlayerCharacterRow: (userId: string, worldId: string) =>
    [
      ...permissionQueryKeys.all,
      "active-player-character-row",
      userId,
      worldId,
    ] as const,
  currentAccessContext: () =>
    [...permissionQueryKeys.all, "current-access-context"] as const,
  selectablePlayerCharacters: (userId: string, worldId: string) =>
    [
      ...permissionQueryKeys.all,
      "selectable-player-characters",
      userId,
      worldId,
    ] as const,
} as const;
