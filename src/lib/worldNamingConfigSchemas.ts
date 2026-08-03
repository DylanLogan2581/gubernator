import { z } from "zod";

import { namingInputLimits } from "@/lib/inputLimits";
import { namingGenerationCaps } from "@/shared/naming";

export const NAME_CONVENTIONS = [
  "pool",
  "patronymic",
  "matronymic",
  "family-name",
  "none",
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

export const worldListNamingConfigSchema = z.object({
  type: z.literal("list"),
  convention: nameConventionSchema,
  female_given_names: namePoolSchema,
  male_given_names: namePoolSchema,
  surnames: namePoolSchema,
});

export type WorldListNamingConfig = z.infer<typeof worldListNamingConfigSchema>;

// Fragment lists referenced by patterns; duplicate entries weight that entry
// more heavily when picked, so no uniqueness constraint here.
const namePartsEntrySchema = z
  .string()
  .min(1, "Entry cannot be empty.")
  .max(namingInputLimits.namePoolEntryMax, "Entry is too long.");

const namePartsListSchema = z
  .array(namePartsEntrySchema)
  .max(namingGenerationCaps.maxEntriesPerList, "List has too many entries.");

const namePartsKeySchema = z
  .string()
  .min(1, "List name cannot be empty.")
  .max(64, "List name is too long.");

const namePartsSchema = z
  .record(namePartsKeySchema, namePartsListSchema)
  .refine(
    (parts) => Object.keys(parts).length <= namingGenerationCaps.maxPartLists,
    "Too many part lists.",
  );

// A list-ref group: one random pick per referenced list, concatenated.
const namePatternGroupSchema = z
  .array(z.string().min(1, "List reference cannot be empty."))
  .min(1, "Pattern group must reference at least one list.");

const namePatternElementSchema = z.union([z.string(), namePatternGroupSchema]);

const namePatternSchema = z.array(namePatternElementSchema);

const namePatternsSchema = z.object({
  female_given: namePatternSchema,
  male_given: namePatternSchema,
  surname: namePatternSchema,
});

export const worldGeneratedNamingConfigSchema = z
  .object({
    type: z.literal("generated"),
    convention: nameConventionSchema,
    parts: namePartsSchema,
    patterns: namePatternsSchema,
  })
  .refine((config) => {
    const referenced = new Set<string>();
    for (const pattern of Object.values(config.patterns)) {
      for (const element of pattern) {
        if (Array.isArray(element)) {
          element.forEach((listKey) => referenced.add(listKey));
        }
      }
    }
    return [...referenced].every((listKey) => listKey in config.parts);
  }, "A pattern references a list that does not exist.")
  .refine(
    (config) =>
      JSON.stringify(config).length <= namingGenerationCaps.maxConfigBytes,
    "Configuration is too large.",
  );

export type WorldGeneratedNamingConfig = z.infer<
  typeof worldGeneratedNamingConfigSchema
>;

// Existing rows/templates predate the `type` discriminant; treat them as
// the (only) format they could have been: a static list.
export const worldNamingConfigSchema = z.preprocess(
  (value) => {
    if (typeof value === "object" && value !== null && !("type" in value)) {
      return { ...value, type: "list" };
    }
    return value;
  },
  z.discriminatedUnion("type", [
    worldListNamingConfigSchema,
    worldGeneratedNamingConfigSchema,
  ]),
);

export type WorldNamingConfig = z.infer<typeof worldNamingConfigSchema>;
