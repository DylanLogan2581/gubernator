import { z } from "zod";

const nationIdSchema = z.guid("Select a nation.");
const worldIdSchema = z.guid("Select a world.");

// Domain decision (issue #955): hostile and at_war are conflict states and are
// mirrored server-side to the reciprocal row (see the
// mirror_bilateral_nation_relationship_stance trigger in
// supabase/migrations/20260812000000_mirror_hostile_and_at_war_nation_relationships.sql).
// neutral and friendly stay directional/asymmetric by design — one nation's
// disposition toward another need not be reciprocated.
const unilateralStanceSchema = z.enum([
  "neutral",
  "friendly",
  "hostile",
  "at_war",
]);

const bilateralStanceSchema = z.enum(["allied", "non_aggression_pact"]);

const bilateralResponseSchema = z.enum(["accepted", "declined"]);

const orderedPairRefinement = {
  message: "A nation cannot have a relationship with itself.",
  path: ["toNationId"] satisfies PropertyKey[],
};

export const setUnilateralStanceInputSchema = z
  .strictObject({
    fromNationId: nationIdSchema,
    stance: unilateralStanceSchema,
    toNationId: nationIdSchema,
    worldId: worldIdSchema,
  })
  .refine(
    (value): boolean => value.fromNationId !== value.toNationId,
    orderedPairRefinement,
  );

export const proposeBilateralInputSchema = z
  .strictObject({
    fromNationId: nationIdSchema,
    stance: bilateralStanceSchema,
    toNationId: nationIdSchema,
    worldId: worldIdSchema,
  })
  .refine(
    (value): boolean => value.fromNationId !== value.toNationId,
    orderedPairRefinement,
  );

export const respondToBilateralInputSchema = z
  .strictObject({
    fromNationId: nationIdSchema,
    response: bilateralResponseSchema,
    toNationId: nationIdSchema,
  })
  .refine(
    (value): boolean => value.fromNationId !== value.toNationId,
    orderedPairRefinement,
  );

export const withdrawFromBilateralInputSchema = z
  .strictObject({
    fromNationId: nationIdSchema,
    toNationId: nationIdSchema,
  })
  .refine(
    (value): boolean => value.fromNationId !== value.toNationId,
    orderedPairRefinement,
  );

export type SetUnilateralStanceInput = z.input<
  typeof setUnilateralStanceInputSchema
>;
export type SetUnilateralStanceValues = z.output<
  typeof setUnilateralStanceInputSchema
>;
export type ProposeBilateralInput = z.input<typeof proposeBilateralInputSchema>;
export type ProposeBilateralValues = z.output<
  typeof proposeBilateralInputSchema
>;
export type RespondToBilateralInput = z.input<
  typeof respondToBilateralInputSchema
>;
export type RespondToBilateralValues = z.output<
  typeof respondToBilateralInputSchema
>;
export type WithdrawFromBilateralInput = z.input<
  typeof withdrawFromBilateralInputSchema
>;
export type WithdrawFromBilateralValues = z.output<
  typeof withdrawFromBilateralInputSchema
>;
