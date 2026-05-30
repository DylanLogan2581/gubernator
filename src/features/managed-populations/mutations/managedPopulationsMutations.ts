import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Json } from "@/types/database";

import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";
import {
  createManagedPopulationTypeInputSchema,
  setManagedPopulationTypeActiveInputSchema,
  updateManagedPopulationTypeInputSchema,
  type CreateManagedPopulationTypeInput,
  type SetManagedPopulationTypeActiveInput,
  type UpdateManagedPopulationTypeInput,
} from "../schemas/managedPopulationSchemas";

import type {
  ManagedPopulationType,
  PopulationResourceEntry,
  SetManagedPopulationTypeActiveResult,
} from "../types/managedPopulationTypes";
import type { z } from "zod";

type ManagedPopulationTypeMutationErrorCode =
  | "managed_population_type_input_invalid"
  | "managed_population_type_not_found";

type CreateManagedPopulationTypeMutationOptions = UseMutationOptions<
  ManagedPopulationType,
  AuthUiError | ManagedPopulationTypeMutationError,
  CreateManagedPopulationTypeInput
>;
type UpdateManagedPopulationTypeMutationOptions = UseMutationOptions<
  ManagedPopulationType,
  AuthUiError | ManagedPopulationTypeMutationError,
  UpdateManagedPopulationTypeInput
>;
type SetManagedPopulationTypeActiveMutationOptions = UseMutationOptions<
  SetManagedPopulationTypeActiveResult,
  AuthUiError | ManagedPopulationTypeMutationError,
  SetManagedPopulationTypeActiveInput
>;

// Explicit typed payloads prevent RejectExcessProperties conflicts in Supabase's strict overloads.
type ManagedPopulationTypeInsertPayload = {
  culling_job_id: string;
  culling_outputs_json?: Json;
  growth_rate: number;
  husbandry_job_id: string;
  husbandry_workers_per_n_animals: number;
  maintenance_rules_json?: Json;
  name: string;
  slug: string;
  world_id: string;
};

type ManagedPopulationTypeUpdatePayload = {
  culling_job_id?: string;
  culling_outputs_json?: Json;
  growth_rate?: number;
  husbandry_job_id?: string;
  husbandry_workers_per_n_animals?: number;
  maintenance_rules_json?: Json;
  name?: string;
  slug?: string;
};

type PopulationResourceEntryRow = {
  readonly amount_per_n_animals: number;
  readonly resource_id: string;
};

type ManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_job_id: string;
  readonly culling_outputs_json: readonly PopulationResourceEntryRow[];
  readonly growth_rate: number;
  readonly husbandry_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly id: string;
  readonly is_active: boolean;
  readonly maintenance_rules_json: readonly PopulationResourceEntryRow[];
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

const MANAGED_POPULATION_TYPE_SELECT =
  "id,world_id,name,slug,husbandry_job_id,culling_job_id,husbandry_workers_per_n_animals,growth_rate,maintenance_rules_json,culling_outputs_json,is_active,created_at,updated_at";

export type ManagedPopulationTypeMutationIssue = MutationIssue;

export const {
  ErrorClass: ManagedPopulationTypeMutationError,
  isError: isManagedPopulationTypeMutationError,
} = createMutationError<ManagedPopulationTypeMutationErrorCode>(
  "ManagedPopulationTypeMutationError",
);
export type ManagedPopulationTypeMutationError = InstanceType<
  typeof ManagedPopulationTypeMutationError
>;

export function createManagedPopulationTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateManagedPopulationTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateManagedPopulationTypeInput) =>
      createManagedPopulationType(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "create-managed-population-type",
    ],
    onSuccess: async (managedPopulationType): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.byWorld(
            managedPopulationType.worldId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.activeByWorld(
            managedPopulationType.worldId,
          ),
        }),
      ]);
    },
  });
}

export function updateManagedPopulationTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateManagedPopulationTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateManagedPopulationTypeInput) =>
      updateManagedPopulationType(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "update-managed-population-type",
    ],
    onSuccess: async (managedPopulationType): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.byWorld(
            managedPopulationType.worldId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.activeByWorld(
            managedPopulationType.worldId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.detail(
            managedPopulationType.id,
          ),
        }),
      ]);
    },
  });
}

export function setManagedPopulationTypeActiveMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetManagedPopulationTypeActiveMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetManagedPopulationTypeActiveInput) =>
      setManagedPopulationTypeActive(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "set-managed-population-type-active",
    ],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.detail(
            result.managedPopulationTypeId,
          ),
        }),
      ]);
    },
  });
}

async function createManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: CreateManagedPopulationTypeInput,
): Promise<ManagedPopulationType> {
  const values = parseInput(createManagedPopulationTypeInputSchema, input);

  const insertPayload: ManagedPopulationTypeInsertPayload = {
    culling_job_id: values.cullingJobId,
    growth_rate: values.growthRate,
    husbandry_job_id: values.husbandryJobId,
    husbandry_workers_per_n_animals: values.husbandryWorkersPerNAnimals,
    name: values.name.trim(),
    slug: values.slug.trim(),
    world_id: values.worldId,
  };

  if (values.maintenanceRulesJson !== undefined) {
    insertPayload.maintenance_rules_json = toPopulationResourceJson(
      values.maintenanceRulesJson,
    );
  }

  if (values.cullingOutputsJson !== undefined) {
    insertPayload.culling_outputs_json = toPopulationResourceJson(
      values.cullingOutputsJson,
    );
  }

  const { data, error } = await client
    .from("managed_population_types")
    .insert(insertPayload)
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .maybeSingle<ManagedPopulationTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be created.",
    });
  }

  return toManagedPopulationType(data);
}

async function updateManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: UpdateManagedPopulationTypeInput,
): Promise<ManagedPopulationType> {
  const values = parseInput(updateManagedPopulationTypeInputSchema, input);

  const updatePayload: ManagedPopulationTypeUpdatePayload = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.slug !== undefined) {
    updatePayload.slug = values.slug.trim();
  }
  if (values.husbandryJobId !== undefined) {
    updatePayload.husbandry_job_id = values.husbandryJobId;
  }
  if (values.cullingJobId !== undefined) {
    updatePayload.culling_job_id = values.cullingJobId;
  }
  if (values.husbandryWorkersPerNAnimals !== undefined) {
    updatePayload.husbandry_workers_per_n_animals =
      values.husbandryWorkersPerNAnimals;
  }
  if (values.growthRate !== undefined) {
    updatePayload.growth_rate = values.growthRate;
  }
  if (values.maintenanceRulesJson !== undefined) {
    updatePayload.maintenance_rules_json = toPopulationResourceJson(
      values.maintenanceRulesJson,
    );
  }
  if (values.cullingOutputsJson !== undefined) {
    updatePayload.culling_outputs_json = toPopulationResourceJson(
      values.cullingOutputsJson,
    );
  }

  const { data, error } = await client
    .from("managed_population_types")
    .update(updatePayload)
    .eq("id", values.managedPopulationTypeId)
    .eq("world_id", values.worldId)
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .maybeSingle<ManagedPopulationTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be updated.",
    });
  }

  return toManagedPopulationType(data);
}

async function setManagedPopulationTypeActive(
  client: GubernatorSupabaseClient,
  input: SetManagedPopulationTypeActiveInput,
): Promise<SetManagedPopulationTypeActiveResult> {
  const values = parseInput(setManagedPopulationTypeActiveInputSchema, input);

  const { data, error } = await client
    .from("managed_population_types")
    .update({ is_active: values.isActive })
    .eq("id", values.managedPopulationTypeId)
    .eq("world_id", values.worldId)
    .select("id,world_id,is_active")
    .maybeSingle<{
      readonly id: string;
      readonly is_active: boolean;
      readonly world_id: string;
    }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be updated.",
    });
  }

  return {
    isActive: data.is_active,
    managedPopulationTypeId: data.id,
    worldId: data.world_id,
  };
}

function toPopulationResourceJson(
  entries: readonly PopulationResourceEntry[],
): Json {
  return entries.map(
    (e): Record<string, Json> => ({
      amount_per_n_animals: e.amountPerNAnimals,
      resource_id: e.resourceId,
    }),
  );
}

function toPopulationResourceEntry(
  row: PopulationResourceEntryRow,
): PopulationResourceEntry {
  return {
    amountPerNAnimals: row.amount_per_n_animals,
    resourceId: row.resource_id,
  };
}

function toManagedPopulationType(
  row: ManagedPopulationTypeRow,
): ManagedPopulationType {
  return {
    createdAt: row.created_at,
    cullingJobId: row.culling_job_id,
    cullingOutputsJson: row.culling_outputs_json.map(toPopulationResourceEntry),
    growthRate: row.growth_rate,
    husbandryJobId: row.husbandry_job_id,
    husbandryWorkersPerNAnimals: row.husbandry_workers_per_n_animals,
    id: row.id,
    isActive: row.is_active,
    maintenanceRulesJson: row.maintenance_rules_json.map(
      toPopulationResourceEntry,
    ),
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ManagedPopulationTypeMutationError({
        code: "managed_population_type_input_invalid",
        issues,
        message: "Managed population type input is invalid.",
      }),
  );
}
