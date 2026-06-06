import { z } from "zod";

import { worldNamingConfigSchema } from "@/features/worlds";

const NAMESET_NAME_MAX = 64;

export const createNamesetInputSchema = z.object({
  worldId: z.string().uuid(),
  name: z
    .string()
    .min(1, "Name is required.")
    .max(
      NAMESET_NAME_MAX,
      `Name must be ${NAMESET_NAME_MAX} characters or fewer.`,
    )
    .transform((s) => s.trim()),
  configJson: worldNamingConfigSchema,
});

export type CreateNamesetInput = z.input<typeof createNamesetInputSchema>;

export const updateNamesetInputSchema = z.object({
  namesetId: z.string().uuid(),
  worldId: z.string().uuid(),
  name: z
    .string()
    .min(1, "Name is required.")
    .max(
      NAMESET_NAME_MAX,
      `Name must be ${NAMESET_NAME_MAX} characters or fewer.`,
    )
    .transform((s) => s.trim()),
  configJson: worldNamingConfigSchema,
});

export type UpdateNamesetInput = z.input<typeof updateNamesetInputSchema>;

export const softDeleteNamesetInputSchema = z.object({
  namesetId: z.string().uuid(),
  worldId: z.string().uuid(),
});

export type SoftDeleteNamesetInput = z.input<
  typeof softDeleteNamesetInputSchema
>;

export const restoreNamesetInputSchema = z.object({
  namesetId: z.string().uuid(),
  worldId: z.string().uuid(),
});

export type RestoreNamesetInput = z.input<typeof restoreNamesetInputSchema>;

export const hardDeleteNamesetInputSchema = z.object({
  namesetId: z.string().uuid(),
  worldId: z.string().uuid(),
});

export type HardDeleteNamesetInput = z.input<
  typeof hardDeleteNamesetInputSchema
>;

export const setDefaultNamesetInputSchema = z.object({
  namesetId: z.string().uuid(),
  worldId: z.string().uuid(),
});

export type SetDefaultNamesetInput = z.input<
  typeof setDefaultNamesetInputSchema
>;

export const setNationNamesetInputSchema = z.object({
  nationId: z.string().uuid(),
  worldId: z.string().uuid(),
  namesetId: z.string().uuid().nullable(),
});

export type SetNationNamesetInput = z.input<typeof setNationNamesetInputSchema>;

export const setSettlementNamesetInputSchema = z.object({
  settlementId: z.string().uuid(),
  worldId: z.string().uuid(),
  namesetId: z.string().uuid().nullable(),
});

export type SetSettlementNamesetInput = z.input<
  typeof setSettlementNamesetInputSchema
>;
