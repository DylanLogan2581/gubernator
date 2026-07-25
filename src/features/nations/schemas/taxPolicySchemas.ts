import { z } from "zod";

const nationIdSchema = z.guid("Select a nation.");
const settlementIdSchema = z.guid("Select a settlement.");
const resourceIdSchema = z.guid("Select a resource.");

const taxMethodSchema = z.enum([
  "percent_production",
  "percent_stockpile",
  "flat",
]);

export const upsertNationTaxPolicyInputSchema = z.strictObject({
  exempt: z.boolean(),
  flatAmount: z.number().min(0, "Flat amount cannot be negative."),
  method: taxMethodSchema,
  minStockpileFloor: z
    .number()
    .min(0, "Minimum stockpile floor cannot be negative."),
  nationId: nationIdSchema,
  rate: z
    .number()
    .min(0, "Rate cannot be negative.")
    .max(1, "Rate cannot exceed 100%."),
  // null => the nation-wide default rule; a guid => a per-settlement override.
  settlementId: settlementIdSchema.nullable(),
  // null => all resources; a list => only those resource ids.
  taxedResourceIds: z.array(resourceIdSchema).nullable(),
});

export const deleteNationTaxPolicyInputSchema = z.strictObject({
  nationId: nationIdSchema,
  settlementId: settlementIdSchema,
});

export const demandTributeInputSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        quantity: z.number().positive("Quantity must be greater than zero."),
        resourceId: resourceIdSchema,
      }),
    )
    .min(1, "Add at least one resource to demand."),
  nationId: nationIdSchema,
  settlementId: settlementIdSchema,
});

export type UpsertNationTaxPolicyInput = z.input<
  typeof upsertNationTaxPolicyInputSchema
>;
export type UpsertNationTaxPolicyValues = z.output<
  typeof upsertNationTaxPolicyInputSchema
>;
export type DeleteNationTaxPolicyInput = z.input<
  typeof deleteNationTaxPolicyInputSchema
>;
export type DeleteNationTaxPolicyValues = z.output<
  typeof deleteNationTaxPolicyInputSchema
>;
export type DemandTributeInput = z.input<typeof demandTributeInputSchema>;
export type DemandTributeValues = z.output<typeof demandTributeInputSchema>;
