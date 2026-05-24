import { z } from "zod";

import { textInputLimits } from "@/lib/inputLimits";

const settlementIdSchema = z.guid("Settlement id must be a valid UUID.");
const nationIdSchema = z.guid("Nation id must be a valid UUID.");
const worldIdSchema = z.guid("World id must be a valid UUID.");

const settlementNameSchema = z
  .string()
  .max(textInputLimits.settlementNameMax, "Settlement name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Settlement name is required.",
  );

const settlementDescriptionSchema = z
  .string()
  .max(
    textInputLimits.settlementDescriptionMax,
    "Settlement description is too long.",
  )
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalSettlementDescriptionSchema = z
  .union([settlementDescriptionSchema, z.null()])
  .optional();

const coordinateSchema = z
  .number()
  .finite("Coordinates must be finite numbers.");

const optionalCoordinateSchema = z
  .union([coordinateSchema, z.null()])
  .optional();
const nullableCoordinateSchema = z.union([coordinateSchema, z.null()]);

export const createSettlementInputSchema = z.strictObject({
  coordX: optionalCoordinateSchema,
  coordZ: optionalCoordinateSchema,
  description: optionalSettlementDescriptionSchema,
  name: settlementNameSchema,
  nationId: nationIdSchema,
  worldId: worldIdSchema,
});

export const updateSettlementDetailsInputSchema = z.strictObject({
  description: optionalSettlementDescriptionSchema,
  name: settlementNameSchema,
  nationId: nationIdSchema,
  settlementId: settlementIdSchema,
  worldId: worldIdSchema,
});

export const updateSettlementCoordinatesInputSchema = z.strictObject({
  coordX: nullableCoordinateSchema,
  coordZ: nullableCoordinateSchema,
  nationId: nationIdSchema,
  settlementId: settlementIdSchema,
  worldId: worldIdSchema,
});

export const deleteSettlementInputSchema = z.strictObject({
  nationId: nationIdSchema,
  settlementId: settlementIdSchema,
  worldId: worldIdSchema,
});

export type CreateSettlementInput = z.input<typeof createSettlementInputSchema>;
export type CreateSettlementValues = z.output<
  typeof createSettlementInputSchema
>;
export type UpdateSettlementDetailsInput = z.input<
  typeof updateSettlementDetailsInputSchema
>;
export type UpdateSettlementDetailsValues = z.output<
  typeof updateSettlementDetailsInputSchema
>;
export type UpdateSettlementCoordinatesInput = z.input<
  typeof updateSettlementCoordinatesInputSchema
>;
export type UpdateSettlementCoordinatesValues = z.output<
  typeof updateSettlementCoordinatesInputSchema
>;
export type DeleteSettlementInput = z.input<typeof deleteSettlementInputSchema>;
export type DeleteSettlementValues = z.output<
  typeof deleteSettlementInputSchema
>;
