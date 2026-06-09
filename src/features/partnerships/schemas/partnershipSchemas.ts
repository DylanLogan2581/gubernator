import { z } from "zod";

const citizenIdSchema = z.guid("Citizen id must be a valid UUID.");
const partnershipIdSchema = z.guid("Partnership id must be a valid UUID.");
const turnTransitionIdSchema = z.guid(
  "Turn transition id must be a valid UUID.",
);

const turnNumberSchema = z
  .number()
  .int("Turn number must be an integer.")
  .nonnegative("Turn number must be zero or positive.");

// change_reason has no DB-level CHECK constraint, but we want a sane upper
// bound and a non-empty value so the audit trail always has something to
// read. 1000 matches the description-style text fields elsewhere in the app.
const changeReasonSchema = z
  .string()
  .max(1000, "Change reason is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Change reason is required.",
  );

const createStatusSchema = z.enum(["active", "widowed"]).optional();

export const createPartnershipInputSchema = z
  .strictObject({
    changeReason: changeReasonSchema,
    citizenAId: citizenIdSchema,
    citizenBId: citizenIdSchema,
    endedOnTurnNumber: z.union([turnNumberSchema, z.null()]).optional(),
    formedOnTurnNumber: turnNumberSchema,
    status: createStatusSchema,
    turnTransitionId: turnTransitionIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (value.citizenAId === value.citizenBId) {
      ctx.addIssue({
        code: "custom",
        message: "A citizen cannot partner with themselves.",
        path: ["citizenBId"],
      });
    }

    const status = value.status ?? "active";

    if (status === "active" && (value.endedOnTurnNumber ?? null) !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Active partnerships must not have an end turn.",
        path: ["endedOnTurnNumber"],
      });
    }

    if (status === "widowed" && (value.endedOnTurnNumber ?? null) === null) {
      ctx.addIssue({
        code: "custom",
        message: "Widowed partnerships require an end turn.",
        path: ["endedOnTurnNumber"],
      });
    }
  });

const endPartnershipShape = {
  changeReason: changeReasonSchema,
  endedOnTurnNumber: turnNumberSchema,
  partnershipId: partnershipIdSchema,
  turnTransitionId: turnTransitionIdSchema,
};

export const dissolvePartnershipInputSchema =
  z.strictObject(endPartnershipShape);

export const markPartnershipWidowedInputSchema =
  z.strictObject(endPartnershipShape);

export const reassignPartnerInputSchema = z
  .strictObject({
    changeReason: changeReasonSchema,
    endedOnTurnNumber: turnNumberSchema,
    formedOnTurnNumber: turnNumberSchema,
    newPartnerCitizenId: citizenIdSchema,
    oldPartnershipId: partnershipIdSchema,
    retainedCitizenId: citizenIdSchema,
    turnTransitionId: turnTransitionIdSchema,
  })
  .refine(
    (value): boolean => value.retainedCitizenId !== value.newPartnerCitizenId,
    {
      message: "Reassigned partner must differ from the retained citizen.",
      path: ["newPartnerCitizenId"],
    },
  );

export type CreatePartnershipInput = z.input<
  typeof createPartnershipInputSchema
>;
export type CreatePartnershipValues = z.output<
  typeof createPartnershipInputSchema
>;
export type DissolvePartnershipInput = z.input<
  typeof dissolvePartnershipInputSchema
>;
export type DissolvePartnershipValues = z.output<
  typeof dissolvePartnershipInputSchema
>;
export type MarkPartnershipWidowedInput = z.input<
  typeof markPartnershipWidowedInputSchema
>;
export type MarkPartnershipWidowedValues = z.output<
  typeof markPartnershipWidowedInputSchema
>;
export type ReassignPartnerInput = z.input<typeof reassignPartnerInputSchema>;
export type ReassignPartnerValues = z.output<typeof reassignPartnerInputSchema>;
