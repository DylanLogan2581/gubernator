import { z } from "zod";

import { lawDocumentInputLimits } from "@/lib/inputLimits";
import { VOTE_THRESHOLDS } from "@/shared/government";

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

// Mirrors the shape validate_law_amendment_procedure_json (DB, #1138) and
// validateAmendmentProcedure (@/shared/government) enforce -- a discriminated
// union so an omitted/unknown kind is rejected client-side instead of
// silently falling back to `{}`, which the DB trigger rejects at creation.
const decreeAuthorityInputSchema = z.union([
  z.literal("ruler"),
  z.strictObject({ officeTypeId: z.guid() }),
]);

const decreeProcedureInputSchema = z.strictObject({
  authority: decreeAuthorityInputSchema,
  kind: z.literal("decree"),
});

const voteProcedureInputSchema = z.strictObject({
  bodyId: z.guid(),
  kind: z.literal("vote"),
  secondBodyId: z.union([z.guid(), z.null()]),
  threshold: z.enum(VOTE_THRESHOLDS),
  votingPeriodTurns: z
    .number()
    .int("Voting period must be a whole number of turns.")
    .min(1, "Voting period must be at least 1 turn."),
});

const lockedProcedureInputSchema = z.strictObject({
  kind: z.literal("locked"),
});

export const amendmentProcedureInputSchema = z
  .discriminatedUnion("kind", [
    decreeProcedureInputSchema,
    voteProcedureInputSchema,
    lockedProcedureInputSchema,
  ])
  .refine(
    (value) =>
      value.kind !== "vote" ||
      value.secondBodyId === null ||
      value.secondBodyId !== value.bodyId,
    {
      message: "Second body must differ from first.",
      path: ["secondBodyId"] satisfies PropertyKey[],
    },
  );

export const createLawDocumentInputSchema = z
  .strictObject({
    amendmentProcedure: amendmentProcedureInputSchema,
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

export type AmendmentProcedureInput = z.output<
  typeof amendmentProcedureInputSchema
>;
export type CreateLawDocumentInput = z.input<
  typeof createLawDocumentInputSchema
>;
export type CreateLawDocumentValues = z.output<
  typeof createLawDocumentInputSchema
>;
export type RepealLawDocumentInput = z.input<
  typeof repealLawDocumentInputSchema
>;
