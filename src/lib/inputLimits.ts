/**
 * Shared input size limits enforced at the database boundary.
 *
 * Values must be kept in sync with the matching CHECK constraints in
 * `supabase/migrations/20260519000004_add_input_size_limits.sql`. The DB is
 * the source of truth for safety; this module mirrors the same numbers for
 * client validation so users get a friendly error before a 23514.
 */

export const textInputLimits = {
  worldNameMax: 64,
  nationNameMax: 64,
  nationDescriptionMax: 1000,
  settlementNameMax: 64,
  settlementDescriptionMax: 1000,
  citizenNameMax: 64,
  citizenNpcTextMax: 1000,
  citizenNpcTraitMax: 200,
} as const;

export const calendarInputLimits = {
  weekdayCountMax: 32,
  monthCountMax: 32,
  weekdayNameMax: 64,
  monthNameMax: 64,
  monthDayCountMax: 1000,
  dateFormatTemplateMax: 200,
  startingYearMin: -1_000_000,
  startingYearMax: 1_000_000,
} as const;

export const resourceInputLimits = {
  resourceNameMax: 64,
  resourceSlugMax: 64,
} as const;

export const npcFlavorInputLimits = {
  poolSizeMax: 100,
  poolEntryMax: 200,
} as const;

export const namingInputLimits = {
  namePoolSizeMax: 100,
  namePoolEntryMax: 64,
} as const;
