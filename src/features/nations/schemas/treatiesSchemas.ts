import { z } from "zod";

const nationIdSchema = z.guid("Select a nation.");
const citizenIdSchema = z.guid("Select a citizen.");
const treatyIdSchema = z.guid("Select a treaty.");

const tributeTermsSchema = z.strictObject({
  payer: z.enum(["proposer", "responder"], {
    message: "Select who pays the tribute.",
  }),
  quantityPerTurn: z
    .number()
    .positive("Quantity per turn must be greater than zero."),
  resourceId: z.guid("Select a resource."),
});

const tradeAgreementTermsSchema = z.strictObject({});

const royalMarriageTermsSchema = z
  .strictObject({
    citizenAId: citizenIdSchema,
    citizenBId: citizenIdSchema,
  })
  .refine((value) => value.citizenAId !== value.citizenBId, {
    message: "Select two distinct citizens.",
    path: ["citizenBId"] satisfies PropertyKey[],
  });

const durationTurnsSchema = z
  .number()
  .int()
  .positive("Duration must be greater than zero.")
  .optional();

export const proposeTreatyInputSchema = z.discriminatedUnion("treatyType", [
  z.strictObject({
    durationTurns: durationTurnsSchema,
    proposedByCitizenId: citizenIdSchema,
    proposerNationId: nationIdSchema,
    responderNationId: nationIdSchema,
    terms: tributeTermsSchema,
    treatyType: z.literal("tribute"),
  }),
  z.strictObject({
    durationTurns: durationTurnsSchema,
    proposedByCitizenId: citizenIdSchema,
    proposerNationId: nationIdSchema,
    responderNationId: nationIdSchema,
    terms: tradeAgreementTermsSchema,
    treatyType: z.literal("trade_agreement"),
  }),
  z.strictObject({
    durationTurns: durationTurnsSchema,
    proposedByCitizenId: citizenIdSchema,
    proposerNationId: nationIdSchema,
    responderNationId: nationIdSchema,
    terms: royalMarriageTermsSchema,
    treatyType: z.literal("royal_marriage"),
  }),
]);

export const respondToTreatyInputSchema = z.strictObject({
  respondedByCitizenId: citizenIdSchema,
  response: z.enum(["accept", "decline"]),
  treatyId: treatyIdSchema,
});

export const withdrawTreatyInputSchema = z.strictObject({
  treatyId: treatyIdSchema,
});

export const breakTreatyInputSchema = z.strictObject({
  brokenByCitizenId: citizenIdSchema,
  treatyId: treatyIdSchema,
});

export type ProposeTreatyInput = z.input<typeof proposeTreatyInputSchema>;
export type ProposeTreatyValues = z.output<typeof proposeTreatyInputSchema>;
export type RespondToTreatyInput = z.input<typeof respondToTreatyInputSchema>;
export type RespondToTreatyValues = z.output<typeof respondToTreatyInputSchema>;
export type WithdrawTreatyInput = z.input<typeof withdrawTreatyInputSchema>;
export type WithdrawTreatyValues = z.output<typeof withdrawTreatyInputSchema>;
export type BreakTreatyInput = z.input<typeof breakTreatyInputSchema>;
export type BreakTreatyValues = z.output<typeof breakTreatyInputSchema>;
