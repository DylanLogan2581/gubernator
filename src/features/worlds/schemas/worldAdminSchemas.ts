import { z } from "zod";

import { textInputLimits } from "@/lib/inputLimits";

const worldIdSchema = z.guid("Select a world.");

export const createWorldInputSchema = z.strictObject({
  name: z
    .string()
    .max(textInputLimits.worldNameMax, "World name is too long.")
    .refine((v): boolean => v.trim().length > 0, "World name is required."),
  visibility: z.enum(["public", "private"]).default("private"),
});

export const trashWorldInputSchema = z.strictObject({
  worldId: worldIdSchema,
});

export const restoreWorldInputSchema = z.strictObject({
  worldId: worldIdSchema,
});

export const hardDeleteWorldInputSchema = z.strictObject({
  worldId: worldIdSchema,
});

export type CreateWorldInput = z.input<typeof createWorldInputSchema>;
export type TrashWorldInput = z.input<typeof trashWorldInputSchema>;
export type RestoreWorldInput = z.input<typeof restoreWorldInputSchema>;
export type HardDeleteWorldInput = z.input<typeof hardDeleteWorldInputSchema>;
