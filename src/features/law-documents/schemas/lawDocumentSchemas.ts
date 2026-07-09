import { z } from "zod";

import { lawDocumentInputLimits } from "@/lib/inputLimits";

const titleSchema = z
  .string()
  .max(lawDocumentInputLimits.titleMax, "Title is too long.")
  .refine((value): boolean => value.trim().length > 0, "Title is required.");

const preambleSchema = z
  .string()
  .max(lawDocumentInputLimits.preambleMax, "Preamble is too long.")
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalPreambleSchema = z.union([preambleSchema, z.null()]).optional();

const headingSchema = z
  .string()
  .max(lawDocumentInputLimits.headingMax, "Heading is too long.")
  .refine((value): boolean => value.trim().length > 0, "Heading is required.");

const bodyMarkdownSchema = z
  .string()
  .refine((value): boolean => value.trim().length > 0, "Body is required.");

export const lawDocumentArticleInputSchema = z.strictObject({
  bodyMarkdown: bodyMarkdownSchema,
  heading: headingSchema,
});

export const createLawDocumentInputSchema = z
  .strictObject({
    amendmentProcedure: z.unknown().optional(),
    articles: z
      .array(lawDocumentArticleInputSchema)
      .min(1, "Add at least one article."),
    nationId: z.union([z.guid(), z.null()]),
    preambleMarkdown: optionalPreambleSchema,
    settlementId: z.union([z.guid(), z.null()]),
    title: titleSchema,
    worldId: z.guid(),
  })
  .refine(
    (value) => (value.nationId !== null) !== (value.settlementId !== null),
    {
      message: "A document belongs to exactly one nation or settlement.",
      path: ["nationId"] satisfies PropertyKey[],
    },
  );

export const repealLawDocumentInputSchema = z.strictObject({
  id: z.guid(),
});

export type CreateLawDocumentInput = z.input<
  typeof createLawDocumentInputSchema
>;
export type CreateLawDocumentValues = z.output<
  typeof createLawDocumentInputSchema
>;
export type RepealLawDocumentInput = z.input<
  typeof repealLawDocumentInputSchema
>;
