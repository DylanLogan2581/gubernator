import { z } from "zod";

import { eventInputLimits } from "@/lib/inputLimits";

// Base ID schemas
const worldIdSchema = z.guid("Select a world.");
const eventIdSchema = z.guid("Event ID is invalid.");
const groupIdSchema = z.guid("Group ID is invalid.");

// Target object in create wizard
export const eventTargetSchema = z.strictObject({
  scope_id: z.guid().optional().nullable(),
  nation_id: z.guid().optional().nullable(),
  settlement_id: z.guid().optional().nullable(),
  job_id: z.number().int().optional().nullable(),
  building_blueprint_id: z.guid().optional().nullable(),
  managed_population_type_id: z.guid().optional().nullable(),
  amount_value: z.number().optional().nullable(),
  multiplier_value: z.number().optional().nullable(),
  scope_name: z.string(), // Display name for the target
});

export type EventTargetSchema = z.input<typeof eventTargetSchema>;

/**
 * Input for creating an event group with multiple events atomically.
 */
// Effect type definitions for structured event effects
export type EventEffectType =
  | "building_destroyed"
  | "consumption_multiplier"
  | "deposit_destroyed"
  | "deposit_discovered"
  | "managed_population_change"
  | "population_boost"
  | "population_loss"
  | "production_multiplier"
  | "resource_drain"
  | "resource_grant"
  | "upkeep_multiplier";

// Base effect schema with common fields
const eventEffectBaseSchema = z.strictObject({
  effectType: z.enum([
    "building_destroyed",
    "consumption_multiplier",
    "deposit_destroyed",
    "deposit_discovered",
    "managed_population_change",
    "population_boost",
    "population_loss",
    "production_multiplier",
    "resource_drain",
    "resource_grant",
    "upkeep_multiplier",
  ]),
  isPercent: z.boolean().default(false),
  amountValue: z.number().optional().nullable(),
  multiplierValue: z.number().optional().nullable(),
  resourceId: z.guid().optional().nullable(),
  jobId: z.guid().optional().nullable(),
  managedPopulationInstanceId: z.guid().optional().nullable(),
  managedPopulationTypeId: z.guid().optional().nullable(),
  managedPopulationMode: z
    .enum(["all", "type", "instance"])
    .optional()
    .nullable(),
  depositInstanceId: z.guid().optional().nullable(),
  settlementBuildingId: z.guid().optional().nullable(),
  buildingBlueprintMode: z.enum(["all", "select"]).optional().nullable(),
  buildingBlueprintIds: z.array(z.guid()).optional().nullable(),
});

export const eventEffectSchema = eventEffectBaseSchema;

export type EventEffectSchema = z.input<typeof eventEffectSchema>;

export const createEventGroupInputSchema = z.strictObject({
  worldId: worldIdSchema,
  groupName: z
    .string()
    .max(eventInputLimits.eventGroupNameMax, "Group name is too long.")
    .refine((v): boolean => v.trim().length > 0, "Group name is required."),
  groupDescription: z
    .string()
    .max(eventInputLimits.eventGroupDescriptionMax, "Description is too long.")
    .optional()
    .nullable(),
  effects: z.array(eventEffectSchema),
  scopeType: z.enum(["world", "nation", "settlement"]),
  targets: z
    .array(eventTargetSchema)
    .min(1, "At least one target is required."),
  durationType: z.enum(["instant", "sustained"]),
  durationTransitions: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 transition.")
    .optional()
    .nullable(),
  activationTurn: z
    .number()
    .int()
    .min(0, "Activation turn must be non-negative."),
  createCitizenMemories: z.boolean().default(false),
  memoryText: z
    .string()
    .max(eventInputLimits.eventMemoryTextMax, "Memory text is too long.")
    .optional()
    .nullable(),
});

export type CreateEventGroupInput = z.input<typeof createEventGroupInputSchema>;

/**
 * Input for canceling an event or group.
 */
export const cancelEventInputSchema = z.strictObject({
  eventId: eventIdSchema,
  worldId: worldIdSchema,
});

export type CancelEventInput = z.input<typeof cancelEventInputSchema>;

/**
 * Input for canceling a full event group.
 */
export const cancelEventGroupInputSchema = z.strictObject({
  groupId: groupIdSchema,
  worldId: worldIdSchema,
});

export type CancelEventGroupInput = z.input<typeof cancelEventGroupInputSchema>;

/**
 * Input for editing an event group.
 * Note: scope and targets are locked (cannot be changed).
 */
export const editEventGroupInputSchema = z.strictObject({
  groupId: groupIdSchema,
  worldId: worldIdSchema,
  groupName: z
    .string()
    .max(eventInputLimits.eventGroupNameMax, "Group name is too long.")
    .refine((v): boolean => v.trim().length > 0, "Group name is required."),
  groupDescription: z
    .string()
    .max(eventInputLimits.eventGroupDescriptionMax, "Description is too long.")
    .optional()
    .nullable(),
  effects: z.array(eventEffectSchema),
  durationType: z.enum(["instant", "sustained"]),
  durationTransitions: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 transition.")
    .optional()
    .nullable(),
  activationTurn: z
    .number()
    .int()
    .min(0, "Activation turn must be non-negative."),
  createCitizenMemories: z.boolean().default(false),
  memoryText: z
    .string()
    .max(eventInputLimits.eventMemoryTextMax, "Memory text is too long.")
    .optional()
    .nullable(),
});

export type EditEventGroupInput = z.input<typeof editEventGroupInputSchema>;

/**
 * Input for deleting a single event.
 */
export const deleteEventInputSchema = z.strictObject({
  eventId: eventIdSchema,
  worldId: worldIdSchema,
});

export type DeleteEventInput = z.input<typeof deleteEventInputSchema>;

/**
 * Input for deleting an entire event group.
 */
export const deleteEventGroupInputSchema = z.strictObject({
  groupId: groupIdSchema,
  worldId: worldIdSchema,
});

export type DeleteEventGroupInput = z.input<typeof deleteEventGroupInputSchema>;
