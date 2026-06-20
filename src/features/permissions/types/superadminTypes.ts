export type SuperadminWorld = {
  readonly id: string;
  readonly name: string;
};

export type SuperadminUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

export type SuperadminWorldAdmin = {
  readonly created_at: string;
  readonly id: string;
  readonly world_id: string;
};

export type PruneWorldDataInput = {
  readonly worldId: string;
  readonly retentionTurns: number;
  readonly dryRun: boolean;
};

export type PruneWorldDataResult = {
  readonly snapshots_deleted: number;
  readonly resource_snapshots_deleted: number;
  readonly log_entries_deleted: number;
  readonly notifications_deleted: number;
  readonly current_turn: number;
  readonly cutoff_turn: number;
  readonly retention_turns: number;
  readonly dry_run: boolean;
  readonly message: string;
};

export type SuperadminRunningTransition = {
  readonly id: string;
  readonly world_id: string;
  readonly from_turn_number: number;
  readonly to_turn_number: number;
  readonly started_at: string;
  readonly status: string;
};

export type FailStuckTransitionInput = {
  readonly worldId: string;
  readonly transitionId: string;
  readonly reason?: string;
};

export type FailStuckTransitionResult = {
  readonly transitionId: string;
  readonly fromTurnNumber: number;
  readonly toTurnNumber: number;
  readonly status: string;
  readonly markedFailedAt: string;
  readonly worldId: string;
};

export type PreviewWorldDeleteResult = {
  readonly worldId: string;
  readonly worldName: string;
  readonly isTrashed: boolean;
  readonly nations: number;
  readonly resources: number;
  readonly jobDefinitions: number;
  readonly buildingBlueprints: number;
  readonly depositTypes: number;
  readonly managedPopulationTypes: number;
  readonly namesets: number;
  readonly tradeRoutes: number;
  readonly eventGroups: number;
  readonly turnTransitions: number;
  readonly notifications: number;
  readonly worldAdmins: number;
  readonly settlements: number;
  readonly citizens: number;
  readonly settlementTurnSnapshots: number;
  readonly turnLogEntries: number;
};

export type CreateUserInput = {
  readonly email: string;
  readonly password?: string;
  readonly sendMagicLink?: boolean;
  readonly username: string;
};
