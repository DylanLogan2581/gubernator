// Mirrors the `generated` branch of worldGeneratedNamingConfigSchema
// (src/lib/worldNamingConfigSchemas.ts) so every emitted library entry can be
// validated before being written. Duplicated rather than imported: scripts/
// is a standalone dev-only tool built by tsconfig.node.json, outside the
// src/ TypeScript project boundary (see scripts/bootstrap-repo.ts, which
// keeps the same separation).
import { z } from "zod";

const NAME_CONVENTIONS = ["pool", "none"] as const;

const namePartsEntrySchema = z.string().min(1).max(64);
const namePartsListSchema = z.array(namePartsEntrySchema).max(500);
const namePartsKeySchema = z.string().min(1).max(64);
const namePartsSchema = z
  .record(namePartsKeySchema, namePartsListSchema)
  .refine((parts) => Object.keys(parts).length <= 40, "Too many part lists.");

const namePatternGroupSchema = z.array(z.string().min(1)).min(1);
const namePatternElementSchema = z.union([z.string(), namePatternGroupSchema]);
const namePatternSchema = z.array(namePatternElementSchema);

export const generatedConfigSchema = z
  .object({
    type: z.literal("generated"),
    convention: z.enum(NAME_CONVENTIONS),
    parts: namePartsSchema,
    patterns: z.object({
      female_given: namePatternSchema,
      male_given: namePatternSchema,
      surname: namePatternSchema,
    }),
  })
  .refine((config) => {
    const referenced = new Set<string>();
    for (const pattern of Object.values(config.patterns)) {
      for (const element of pattern) {
        if (Array.isArray(element))
          element.forEach((key) => referenced.add(key));
      }
    }
    return [...referenced].every((key) => key in config.parts);
  }, "A pattern references a list that does not exist.")
  .refine(
    (config) => JSON.stringify(config).length <= 64 * 1024,
    "Configuration is too large.",
  );
