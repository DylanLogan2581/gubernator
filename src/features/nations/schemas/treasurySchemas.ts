import { z } from "zod";

const nationIdSchema = z.guid("Select a nation.");
const worldIdSchema = z.guid("Select a world.");
const settlementIdSchema = z.guid("Select a settlement.");

export const grantNationResourcesInputSchema = z.strictObject({
  nationId: nationIdSchema,
  quantity: z.number().positive("Quantity must be greater than zero."),
  resourceId: z.guid("Select a resource."),
  settlementId: settlementIdSchema,
  worldId: worldIdSchema,
});

export const subsidizeConstructionProjectInputSchema = z.strictObject({
  nationId: nationIdSchema,
  projectId: z.guid("Select a construction project."),
  settlementId: settlementIdSchema,
  worldId: worldIdSchema,
});

export const setNationTaxRateInputSchema = z.strictObject({
  nationId: nationIdSchema,
  rate: z
    .number()
    .min(0, "Tax rate cannot be negative.")
    .max(0.5, "Tax rate cannot exceed 50%."),
  worldId: worldIdSchema,
});

export type GrantNationResourcesInput = z.input<
  typeof grantNationResourcesInputSchema
>;
export type GrantNationResourcesValues = z.output<
  typeof grantNationResourcesInputSchema
>;
export type SubsidizeConstructionProjectInput = z.input<
  typeof subsidizeConstructionProjectInputSchema
>;
export type SubsidizeConstructionProjectValues = z.output<
  typeof subsidizeConstructionProjectInputSchema
>;
export type SetNationTaxRateInput = z.input<typeof setNationTaxRateInputSchema>;
export type SetNationTaxRateValues = z.output<
  typeof setNationTaxRateInputSchema
>;
