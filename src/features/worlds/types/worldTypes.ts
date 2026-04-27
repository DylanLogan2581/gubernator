export type WorldPermissionContext = {
  readonly canAccessWorld: (world: {
    readonly id: string;
    readonly ownerId?: string;
    readonly visibility?: string;
  }) => boolean;
  readonly canAdminWorld: (worldId: string) => boolean;
  readonly canManageWorld: (world: {
    readonly id: string;
    readonly ownerId?: string;
    readonly visibility?: string;
  }) => boolean;
  readonly isAuthenticated: boolean;
  readonly isSuperAdmin: boolean;
  readonly userId: string | null;
  readonly worldAdminWorldIds: readonly string[];
};

export type AccessibleWorld = {
  readonly archivedAt: string | null;
  readonly canAccess: boolean;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly createdAt: string;
  readonly currentTurnNumber: number;
  readonly id: string;
  readonly isArchived: boolean;
  readonly isHidden: boolean;
  readonly name: string;
  readonly ownerId: string;
  readonly slug: string;
  readonly status: string;
  readonly updatedAt: string;
  readonly visibility: string;
};
