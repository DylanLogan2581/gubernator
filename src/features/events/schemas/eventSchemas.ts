import { z } from "zod";

import { eventInputLimits } from "@/lib/inputLimits";

// Base ID schemas
const worldIdSchema = z.guid("Select a world.");
const eventIdSchema = z.guid("Event ID is invalid.");
const groupIdSchema = z.guid("Group ID is invalid.");

// Target object in create wizard
export const eventTargetSchema = z.strictObject({
  scope_id: z.string().uuid().optional().nullable(),
  nation_id: z.string().uuid().optional().nullable(),
  settlement_id: z.string().uuid().optional().nullable(),
  job_id: z.number().int().optional().nullable(),
  building_blueprint_id: z.string().uuid().optional().nullable(),
  managed_population_type_id: z.string().uuid().optional().nullable(),
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
  | "building_damage"
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
    "building_damage",
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
  resourceId: z.string().uuid().optional().nullable(),
  jobId: z.number().int().optional().nullable(),
  managedPopulationInstanceId: z.string().uuid().optional().nullable(),
  depositInstanceId: z.string().uuid().optional().nullable(),
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
  effects: z
    .array(eventEffectSchema)
    .min(1, "At least one effect is required."),
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
