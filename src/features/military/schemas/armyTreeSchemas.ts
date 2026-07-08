import { z } from "zod";

import { armyNameSchema } from "./armySchemas";

const armyIdSchema = z.guid("Select an army.");
const groupIdSchema = z.guid("Select a group.");
const unitIdSchema = z.guid("Select a unit.");
const unitTypeIdSchema = z.guid("Select a unit type.");

// null = army root (no parent group / no group).
const optionalGroupIdSchema = z.guid("Select a group.").nullable();

export const createArmyGroupInputSchema = z.strictObject({
  armyId: armyIdSchema,
  name: armyNameSchema,
  parentGroupId: optionalGroupIdSchema,
  sortOrder: z.int().optional(),
});

export const renameArmyGroupInputSchema = z.strictObject({
  groupId: groupIdSchema,
  name: armyNameSchema,
});

export const moveArmyGroupInputSchema = z.strictObject({
  groupId: groupIdSchema,
  newParentGroupId: optionalGroupIdSchema,
});

export const deleteArmyGroupInputSchema = z.strictObject({
  groupId: groupIdSchema,
});

export const createArmyUnitInputSchema = z.strictObject({
  armyId: armyIdSchema,
  groupId: optionalGroupIdSchema,
  name: armyNameSchema,
  sortOrder: z.int().optional(),
  unitTypeId: unitTypeIdSchema,
});

export const renameArmyUnitInputSchema = z.strictObject({
  name: armyNameSchema,
  unitId: unitIdSchema,
});

export const moveArmyUnitInputSchema = z.strictObject({
  groupId: optionalGroupIdSchema,
  sortOrder: z.int(),
  unitId: unitIdSchema,
});

export const deleteArmyUnitInputSchema = z.strictObject({
  unitId: unitIdSchema,
});

export type CreateArmyGroupInput = z.input<typeof createArmyGroupInputSchema>;
export type CreateArmyGroupValues = z.output<typeof createArmyGroupInputSchema>;
export type RenameArmyGroupInput = z.input<typeof renameArmyGroupInputSchema>;
export type RenameArmyGroupValues = z.output<typeof renameArmyGroupInputSchema>;
export type MoveArmyGroupInput = z.input<typeof moveArmyGroupInputSchema>;
export type MoveArmyGroupValues = z.output<typeof moveArmyGroupInputSchema>;
export type DeleteArmyGroupInput = z.input<typeof deleteArmyGroupInputSchema>;
export type DeleteArmyGroupValues = z.output<typeof deleteArmyGroupInputSchema>;

export type CreateArmyUnitInput = z.input<typeof createArmyUnitInputSchema>;
export type CreateArmyUnitValues = z.output<typeof createArmyUnitInputSchema>;
export type RenameArmyUnitInput = z.input<typeof renameArmyUnitInputSchema>;
export type RenameArmyUnitValues = z.output<typeof renameArmyUnitInputSchema>;
export type MoveArmyUnitInput = z.input<typeof moveArmyUnitInputSchema>;
export type MoveArmyUnitValues = z.output<typeof moveArmyUnitInputSchema>;
export type DeleteArmyUnitInput = z.input<typeof deleteArmyUnitInputSchema>;
export type DeleteArmyUnitValues = z.output<typeof deleteArmyUnitInputSchema>;
