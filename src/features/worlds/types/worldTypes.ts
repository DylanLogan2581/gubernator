export type WorldPermissionContext = {
  readonly canAccessWorld: (world: {
    readonly id: string;
    readonly ownerId?: string;
    readonly visibility?: string;
  }) => boolean;
  readonly canAdminWorld: (world: {
    readonly id: string;
    readonly ownerId?: string;
    readonly visibility?: string;
  }) => boolean;
  readonly canManageWorld: (world: {
    readonly id: string;
    readonly ownerId?: string;
    readonly visibility?: string;
  }) => boolean;
  readonly isActiveUser: boolean;
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
  readonly fullInWorldDateLabel: string;
  readonly id: string;
  readonly inWorldDateLabel: string;
  readonly isArchived: boolean;
  readonly isHidden: boolean;
  readonly name: string;
  readonly nextFullInWorldDateLabel: string;
  readonly nextInWorldDateLabel: string;
  readonly nextTurnNumber: number;
  readonly ownerId: string;
  readonly planningTurnNumber: number;
  readonly slug: string;
  readonly status: string;
  readonly updatedAt: string;
  readonly visibility: string;
};

export type WorldShellHeader = {
  readonly archivedAt: string | null;
  readonly currentTurnNumber: number;
  readonly fullInWorldDateLabel: string;
  readonly inWorldDateLabel: string;
  readonly isArchived: boolean;
  readonly name: string;
  readonly nextFullInWorldDateLabel: string;
  readonly nextInWorldDateLabel: string;
  readonly nextTurnNumber: number;
  readonly planningTurnNumber: number;
  readonly slug: string;
  readonly status: string;
  readonly visibility: string;
};

export type WorldRouteAccess = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly header: WorldShellHeader;
  readonly world: AccessibleWorld;
};
