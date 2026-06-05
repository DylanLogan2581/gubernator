import { z } from "zod";

import { textInputLimits } from "@/lib/inputLimits";

const worldIdSchema = z.guid("World id must be a valid UUID.");

export const renameWorldInputSchema = z.strictObject({
  name: z
    .string()
    .max(textInputLimits.worldNameMax, "World name is too long.")
    .refine((v): boolean => v.trim().length > 0, "World name is required."),
  worldId: worldIdSchema,
});

export const setWorldCurrentTurnNumberInputSchema = z.strictObject({
  turnNumber: z
    .number()
    .int("Turn number must be an integer.")
    .min(0, "Turn number must be a non-negative integer."),
  worldId: worldIdSchema,
});

export type RenameWorldInput = z.input<typeof renameWorldInputSchema>;
export type SetWorldCurrentTurnNumberInput = z.input<
  typeof setWorldCurrentTurnNumberInputSchema
>;
