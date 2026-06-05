import { z } from "zod";

import { textInputLimits } from "@/lib/inputLimits";

const citizenIdSchema = z.guid("Citizen id must be a valid UUID.");
const worldIdSchema = z.guid("World id must be a valid UUID.");
const settlementIdSchema = z.guid("Settlement id must be a valid UUID.");
const nationIdSchema = z.guid("Nation id must be a valid UUID.");
const userIdSchema = z.guid("User id must be a valid UUID.");

const givenNameSchema = z
  .string()
  .max(textInputLimits.citizenNameMax, "Given name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Given name is required.",
  );

const surnameSchema = z
  .union([
    z.string().max(textInputLimits.citizenNameMax, "Surname is too long."),
    z.null(),
  ])
  .optional()
  .transform((value): string | null => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalTrimmedTextSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalNpcTextSchema = z
  .union([
    z.string().max(textInputLimits.citizenNpcTextMax, "Text is too long."),
    z.null(),
  ])
  .optional()
  .transform((value): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalNpcTraitSchema = z
  .union([
    z.string().max(textInputLimits.citizenNpcTraitMax, "Trait is too long."),
    z.null(),
  ])
  .optional()
  .transform((value): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalCitizenIdSchema = z.union([citizenIdSchema, z.null()]).optional();
const optionalSettlementIdSchema = z
  .union([settlementIdSchema, z.null()])
  .optional();

const optionalIntegerSchema = z
  .union([z.number().int("Turn number must be an integer."), z.null()])
  .optional();

const citizenRoleTypeSchema = z.enum([
  "none",
  "nation_manager",
  "settlement_manager",
]);

const baseCitizenWriteShape = {
  bornOnTurnNumber: optionalIntegerSchema,
  givenName: givenNameSchema,
  npcFlaw: optionalNpcTextSchema,
  npcGoal: optionalNpcTextSchema,
  npcSecretContradiction: optionalNpcTextSchema,
  npcTrait1: optionalNpcTraitSchema,
  npcTrait2: optionalNpcTraitSchema,
  parentACitizenId: optionalCitizenIdSchema,
  parentBCitizenId: optionalCitizenIdSchema,
  personalityText: optionalNpcTextSchema,
  profilePhotoUrl: optionalTrimmedTextSchema,
  settlementId: optionalSettlementIdSchema,
  sex: optionalTrimmedTextSchema,
  skillsText: optionalNpcTextSchema,
  surname: surnameSchema,
  worldId: worldIdSchema,
};

export const createNpcInputSchema = z
  .strictObject({
    ...baseCitizenWriteShape,
    userId: z
      .undefined({ error: "NPCs cannot be linked to a user." })
      .optional(),
  })
  .transform((value) => ({ ...value, citizenType: "npc" as const }));

export const createPlayerCharacterInputSchema = z
  .strictObject({
    ...baseCitizenWriteShape,
    userId: userIdSchema,
  })
  .transform((value) => ({
    ...value,
    citizenType: "player_character" as const,
  }));

export const updateCitizenCoreInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  givenName: givenNameSchema,
  sex: optionalTrimmedTextSchema,
  surname: surnameSchema,
  worldId: worldIdSchema,
});

export const updateCitizenNpcFieldsInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  npcFlaw: optionalNpcTextSchema,
  npcGoal: optionalNpcTextSchema,
  npcSecretContradiction: optionalNpcTextSchema,
  npcTrait1: optionalNpcTraitSchema,
  npcTrait2: optionalNpcTraitSchema,
  personalityText: optionalNpcTextSchema,
  skillsText: optionalNpcTextSchema,
  worldId: worldIdSchema,
});

export const markCitizenDeadInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  deathCause: optionalNpcTextSchema,
  worldId: worldIdSchema,
});

export const reviveCitizenInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  worldId: worldIdSchema,
});

export const linkUserToCitizenInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  userId: userIdSchema,
  worldId: worldIdSchema,
});

export const unlinkUserFromCitizenInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  worldId: worldIdSchema,
});

const assignableCitizenRoleTypeSchema = z.enum([
  "nation_manager",
  "settlement_manager",
]);

export const assignCitizenRoleInputSchema = z
  .strictObject({
    citizenId: citizenIdSchema,
    roleNationId: z.union([nationIdSchema, z.null()]).optional(),
    roleSettlementId: z.union([settlementIdSchema, z.null()]).optional(),
    roleType: assignableCitizenRoleTypeSchema,
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    const nationId = value.roleNationId ?? null;
    const settlementId = value.roleSettlementId ?? null;

    if (value.roleType === "nation_manager") {
      if (nationId === null) {
        ctx.addIssue({
          code: "custom",
          message: "Nation manager role requires a role nation.",
          path: ["roleNationId"],
        });
      }
      if (settlementId !== null) {
        ctx.addIssue({
          code: "custom",
          message: "Nation manager role must not set a role settlement.",
          path: ["roleSettlementId"],
        });
      }
      return;
    }

    if (settlementId === null) {
      ctx.addIssue({
        code: "custom",
        message: "Settlement manager role requires a role settlement.",
        path: ["roleSettlementId"],
      });
    }
    if (nationId !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Settlement manager role must not set a role nation.",
        path: ["roleNationId"],
      });
    }
  });

export const revokeCitizenRoleInputSchema = z.strictObject({
  citizenId: citizenIdSchema,
  worldId: worldIdSchema,
});

// Role assignment shape used by the dedicated character-link and
// role-assignment surface that ships in a later issue. Exported here so the
// scope-matching invariant is validated in one place; the listed mutations in
// this issue do not write role columns directly because the DB locks them
// down via column-level grants.
export const citizenRoleAssignmentSchema = z
  .strictObject({
    citizenId: citizenIdSchema,
    roleNationId: z.union([nationIdSchema, z.null()]).optional(),
    roleSettlementId: z.union([settlementIdSchema, z.null()]).optional(),
    roleType: citizenRoleTypeSchema,
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    const nationId = value.roleNationId ?? null;
    const settlementId = value.roleSettlementId ?? null;

    if (value.roleType === "none") {
      if (nationId !== null) {
        ctx.addIssue({
          code: "custom",
          message: "Role nation must be null when role type is none.",
          path: ["roleNationId"],
        });
      }
      if (settlementId !== null) {
        ctx.addIssue({
          code: "custom",
          message: "Role settlement must be null when role type is none.",
          path: ["roleSettlementId"],
        });
      }
      return;
    }

    if (value.roleType === "nation_manager") {
      if (nationId === null) {
        ctx.addIssue({
          code: "custom",
          message: "Nation manager role requires a role nation.",
          path: ["roleNationId"],
        });
      }
      if (settlementId !== null) {
        ctx.addIssue({
          code: "custom",
          message: "Nation manager role must not set a role settlement.",
          path: ["roleSettlementId"],
        });
      }
      return;
    }

    if (settlementId === null) {
      ctx.addIssue({
        code: "custom",
        message: "Settlement manager role requires a role settlement.",
        path: ["roleSettlementId"],
      });
    }
    if (nationId !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Settlement manager role must not set a role nation.",
        path: ["roleNationId"],
      });
    }
  });

export type CreateNpcInput = z.input<typeof createNpcInputSchema>;
export type CreateNpcValues = z.output<typeof createNpcInputSchema>;
export type CreatePlayerCharacterInput = z.input<
  typeof createPlayerCharacterInputSchema
>;
export type CreatePlayerCharacterValues = z.output<
  typeof createPlayerCharacterInputSchema
>;
export type UpdateCitizenCoreInput = z.input<
  typeof updateCitizenCoreInputSchema
>;
export type UpdateCitizenCoreValues = z.output<
  typeof updateCitizenCoreInputSchema
>;
export type UpdateCitizenNpcFieldsInput = z.input<
  typeof updateCitizenNpcFieldsInputSchema
>;
export type UpdateCitizenNpcFieldsValues = z.output<
  typeof updateCitizenNpcFieldsInputSchema
>;
export type MarkCitizenDeadInput = z.input<typeof markCitizenDeadInputSchema>;
export type MarkCitizenDeadValues = z.output<typeof markCitizenDeadInputSchema>;
export type ReviveCitizenInput = z.input<typeof reviveCitizenInputSchema>;
export type ReviveCitizenValues = z.output<typeof reviveCitizenInputSchema>;
export type CitizenRoleAssignmentInput = z.input<
  typeof citizenRoleAssignmentSchema
>;
export type CitizenRoleAssignmentValues = z.output<
  typeof citizenRoleAssignmentSchema
>;
export type LinkUserToCitizenInput = z.input<
  typeof linkUserToCitizenInputSchema
>;
export type LinkUserToCitizenValues = z.output<
  typeof linkUserToCitizenInputSchema
>;
export type UnlinkUserFromCitizenInput = z.input<
  typeof unlinkUserFromCitizenInputSchema
>;
export type UnlinkUserFromCitizenValues = z.output<
  typeof unlinkUserFromCitizenInputSchema
>;
export type AssignCitizenRoleInput = z.input<
  typeof assignCitizenRoleInputSchema
>;
export type AssignCitizenRoleValues = z.output<
  typeof assignCitizenRoleInputSchema
>;
export type RevokeCitizenRoleInput = z.input<
  typeof revokeCitizenRoleInputSchema
>;
export type RevokeCitizenRoleValues = z.output<
  typeof revokeCitizenRoleInputSchema
>;
