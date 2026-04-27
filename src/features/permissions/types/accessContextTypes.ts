export type WorldAccessTarget = {
  readonly id: string;
  readonly ownerId?: string;
  readonly visibility?: string;
};

export type AccessContextPredicates = {
  readonly canAccessWorld: (world: WorldAccessTarget) => boolean;
  readonly canAdminWorld: (worldId: string) => boolean;
  readonly canManageWorld: (world: WorldAccessTarget) => boolean;
};

export type AccessContext = AccessContextPredicates & {
  readonly isAuthenticated: boolean;
  readonly isSuperAdmin: boolean;
  readonly userId: string | null;
  readonly worldAdminWorldIds: readonly string[];
};
