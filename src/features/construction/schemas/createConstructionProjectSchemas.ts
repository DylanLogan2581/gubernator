import { z } from "zod";

export const createConstructionProjectInputSchema = z.strictObject({
  blueprintId: z.guid("Select a blueprint."),
  settlementId: z.guid("Select a settlement."),
  targetTierId: z.guid("Select a target tier."),
  // When set, upgrades the referenced existing building in place instead of
  // creating a new one (#1372). Omit for direct builds.
  upgradeSettlementBuildingId: z
    .guid("Select a building to upgrade.")
    .optional(),
});

export type CreateConstructionProjectInput = z.input<
  typeof createConstructionProjectInputSchema
>;
export type CreateConstructionProjectValues = z.output<
  typeof createConstructionProjectInputSchema
>;
