export type WorldAccessTarget = {
  readonly id: string;
  readonly ownerId?: string;
  readonly visibility?: string;
};

export type AccessContextPredicates = {
  /**
   * Mirrors database admin authorization for world access operations:
   * active world owners, explicit world_admins rows, and super admins.
   */
  readonly canAdminWorld: (world: WorldAccessTarget) => boolean;
  readonly canAccessWorld: (world: WorldAccessTarget) => boolean;
  readonly canManageWorld: (world: WorldAccessTarget) => boolean;
};

export type AccessContext = AccessContextPredicates & {
  readonly isActiveUser: boolean;
  readonly isAuthenticated: boolean;
  readonly isSuperAdmin: boolean;
  readonly userId: string | null;
  readonly worldAdminWorldIds: readonly string[];
};
