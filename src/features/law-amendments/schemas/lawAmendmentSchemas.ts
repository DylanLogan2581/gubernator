import { z } from "zod";

import { lawAmendmentInputLimits } from "@/lib/inputLimits";

const titleSchema = z
  .string()
  .max(lawAmendmentInputLimits.titleMax, "Title is too long.")
  .refine((value): boolean => value.trim().length > 0, "Title is required.");

const rationaleSchema = z
  .string()
  .max(lawAmendmentInputLimits.rationaleMax, "Rationale is too long.")
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalRationaleSchema = z.union([rationaleSchema, z.null()]).optional();

// operations_json entries are a discriminated union enforced server-side
// (propose_law_amendment); client-side we only need "a non-empty array of
// plain objects with an op string", matching this repo's "server is the
// real gate" convention for RPC payloads built from typed form state.
const operationSchema = z.looseObject({ op: z.string() });

export const proposeLawAmendmentInputSchema = z.strictObject({
  documentId: z.guid(),
  operations: z.array(operationSchema).min(1, "Add at least one operation."),
  proposingCitizenId: z.guid(),
  rationaleMarkdown: optionalRationaleSchema,
  title: titleSchema,
});

export const castLawAmendmentVoteInputSchema = z.strictObject({
  amendmentId: z.guid(),
  vote: z.boolean(),
  voterCitizenId: z.guid(),
});

export const withdrawLawAmendmentInputSchema = z.strictObject({
  amendmentId: z.guid(),
});

export type ProposeLawAmendmentInput = z.input<
  typeof proposeLawAmendmentInputSchema
>;
export type ProposeLawAmendmentValues = z.output<
  typeof proposeLawAmendmentInputSchema
>;
export type CastLawAmendmentVoteInput = z.input<
  typeof castLawAmendmentVoteInputSchema
>;
export type WithdrawLawAmendmentInput = z.input<
  typeof withdrawLawAmendmentInputSchema
>;
