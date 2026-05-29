import type { Json } from "@/types/database";

export type Resource = {
  readonly baseStockpileCap: number;
  readonly createdAt: string;
  readonly id: string;
  readonly isDeleted: boolean;
  readonly isSystemResource: boolean;
  readonly lastCleanupSummaryJson: Json;
  readonly name: string;
  readonly slug: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type SoftDeleteResourceResult = {
  readonly resourceId: string;
  readonly worldId: string;
};
