import { z } from "zod";

import { npcFlavorInputLimits } from "@/lib/inputLimits";

const poolEntrySchema = z
  .string()
  .min(1, "Entry cannot be empty.")
  .max(npcFlavorInputLimits.poolEntryMax, "Entry is too long.");

const poolSchema = z
  .array(poolEntrySchema)
  .max(npcFlavorInputLimits.poolSizeMax, "Pool has too many entries.");

export const worldNpcFlavorConfigSchema = z.object({
  contradictions: poolSchema,
  flaws: poolSchema,
  goals: poolSchema,
  traits: poolSchema,
});

export type WorldNpcFlavorConfig = z.infer<typeof worldNpcFlavorConfigSchema>;
