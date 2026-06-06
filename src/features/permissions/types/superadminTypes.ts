export type SuperadminWorld = {
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
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

export type CreateUserInput = {
  readonly email: string;
  readonly password?: string;
  readonly sendMagicLink?: boolean;
  readonly username: string;
};
