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

export type CreateUserInput = {
  readonly email: string;
  readonly password?: string;
  readonly sendMagicLink?: boolean;
  readonly username: string;
};
