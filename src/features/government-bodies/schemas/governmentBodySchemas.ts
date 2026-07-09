import { z } from "zod";

import { governmentBodyInputLimits } from "@/lib/inputLimits";

const officeTypeRuleSchema = z.strictObject({
  kind: z.literal("office_type"),
  officeTypeId: z.guid("Select an office."),
});

const citizensRuleSchema = z.strictObject({
  kind: z.literal("citizens"),
  citizenIds: z.array(z.guid()).min(1, "Select at least one citizen."),
});

const rulerRuleSchema = z.strictObject({
  kind: z.literal("ruler"),
});

const settlementManagersRuleSchema = z.strictObject({
  kind: z.literal("settlement_managers"),
});

export const bodyCompositionRuleSchema = z.discriminatedUnion("kind", [
  officeTypeRuleSchema,
  citizensRuleSchema,
  rulerRuleSchema,
  settlementManagersRuleSchema,
]);

export const bodyCompositionSchema = z
  .array(bodyCompositionRuleSchema)
  .min(1, "Add at least one composition rule.");

const bodyNameSchema = z
  .string()
  .max(governmentBodyInputLimits.nameMax, "Name is too long.")
  .refine((value): boolean => value.trim().length > 0, "Name is required.");

const bodyDescriptionSchema = z
  .string()
  .max(governmentBodyInputLimits.descriptionMax, "Description is too long.")
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalBodyDescriptionSchema = z
  .union([bodyDescriptionSchema, z.null()])
  .optional();

export const createGovernmentBodyInputSchema = z
  .strictObject({
    composition: bodyCompositionSchema,
    description: optionalBodyDescriptionSchema,
    name: bodyNameSchema,
    nationId: z.union([z.guid(), z.null()]),
    settlementId: z.union([z.guid(), z.null()]),
    worldId: z.guid(),
  })
  .refine(
    (value) => (value.nationId !== null) !== (value.settlementId !== null),
    {
      message: "A body belongs to exactly one nation or settlement.",
      path: ["nationId"] satisfies PropertyKey[],
    },
  );

export const updateGovernmentBodyInputSchema = z.strictObject({
  composition: bodyCompositionSchema,
  description: optionalBodyDescriptionSchema,
  id: z.guid(),
  name: bodyNameSchema,
});

export const deleteGovernmentBodyInputSchema = z.strictObject({
  id: z.guid(),
});

export type CreateGovernmentBodyInput = z.input<
  typeof createGovernmentBodyInputSchema
>;
export type CreateGovernmentBodyValues = z.output<
  typeof createGovernmentBodyInputSchema
>;
export type UpdateGovernmentBodyInput = z.input<
  typeof updateGovernmentBodyInputSchema
>;
export type UpdateGovernmentBodyValues = z.output<
  typeof updateGovernmentBodyInputSchema
>;
export type DeleteGovernmentBodyInput = z.input<
  typeof deleteGovernmentBodyInputSchema
>;
