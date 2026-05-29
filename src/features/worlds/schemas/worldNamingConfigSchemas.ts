import { z } from "zod";

import { namingInputLimits } from "@/lib/inputLimits";

export const NAME_CONVENTIONS = [
  "random",
  "patronymic",
  "matronymic",
  "inherited family name",
] as const;

export type NameConvention = (typeof NAME_CONVENTIONS)[number];

const nameConventionSchema = z.enum(NAME_CONVENTIONS);

const namePoolEntrySchema = z
  .string()
  .min(1, "Entry cannot be empty.")
  .max(namingInputLimits.namePoolEntryMax, "Entry is too long.");

const namePoolSchema = z
  .array(namePoolEntrySchema)
  .max(namingInputLimits.namePoolSizeMax, "Pool has too many entries.")
  .refine(
    (entries) => new Set(entries).size === entries.length,
    "Pool entries must be unique.",
  );

export const worldNamingConfigSchema = z.object({
  convention: nameConventionSchema,
  female_names: namePoolSchema,
  male_names: namePoolSchema,
  manual_only: z.boolean(),
});

export type WorldNamingConfig = z.infer<typeof worldNamingConfigSchema>;
