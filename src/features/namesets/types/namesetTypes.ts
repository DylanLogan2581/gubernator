import type { WorldNamingConfig } from "@/features/worlds";

export type Nameset = {
  readonly id: string;
  readonly worldId: string;
  readonly name: string;
  readonly configJson: WorldNamingConfig;
  readonly isDefault: boolean;
  readonly isTrashed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SoftDeleteNamesetResult = {
  readonly namesetId: string;
  readonly worldId: string;
};

export type RestoreNamesetResult = {
  readonly namesetId: string;
  readonly worldId: string;
};

export type HardDeleteNamesetResult = {
  readonly namesetId: string;
  readonly worldId: string;
};

export type SetDefaultNamesetResult = {
  readonly namesetId: string;
  readonly worldId: string;
};

export type SetEntityNamesetResult = {
  readonly entityId: string;
  readonly worldId: string;
  readonly namesetId: string | null;
};
