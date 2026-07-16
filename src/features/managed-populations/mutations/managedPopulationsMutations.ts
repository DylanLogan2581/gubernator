import { normalizeSupabaseError } from "@/features/auth";
import { buildTrashLifecycleMutations } from "@/lib/buildTrashLifecycleMutations";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import { toSnakeCaseEntries } from "@/lib/toSnakeCaseEntries";
import type { Json } from "@/types/database";

import {
  MANAGED_POPULATION_TYPE_SELECT,
  toManagedPopulationType,
  type ManagedPopulationTypeRow,
} from "../queries/managedPopulationRow";
import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";
import {
  createManagedPopulationTypeInputSchema,
  hardDeleteManagedPopulationTypeInputSchema,
  restoreManagedPopulationTypeInputSchema,
  softDeleteManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeInputSchema,
  type CreateManagedPopulationTypeInput,
  type HardDeleteManagedPopulationTypeInput,
  type ManagedPopulationCullingJobValues,
  type ManagedPopulationHusbandryJobValues,
  type RestoreManagedPopulationTypeInput,
  type SoftDeleteManagedPopulationTypeInput,
  type UpdateManagedPopulationTypeInput,
} from "../schemas/managedPopulationSchemas";

import type {
  HardDeleteManagedPopulationTypeResult,
  ManagedPopulationType,
  PopulationResourceEntry,
  RestoreManagedPopulationTypeResult,
  SoftDeleteManagedPopulationTypeResult,
} from "../types/managedPopulationTypes";
import type { z } from "zod";

type ManagedPopulationTypeMutationErrorCode =
  | "managed_population_type_culling_job_already_linked"
  | "managed_population_type_husbandry_job_already_linked"
  | "managed_population_type_input_invalid"
  | "managed_population_type_not_authorized"
  | "managed_population_type_not_found";

// Explicit typed payloads prevent RejectExcessProperties conflicts in Supabase's strict overloads.
type ManagedPopulationTypeInsertPayload = {
  culling_outputs_json?: Json;
  growth_rate: number;
  icon?: string | null;
  icon_color?: number | null;
  maintenance_rules_json?: Json;
  name: string;
  slug: string;
  world_id: string;
};

type ManagedPopulationTypeUpdatePayload = {
  culling_outputs_json?: Json;
  growth_rate?: number;
  icon?: string | null;
  icon_color?: number | null;
  maintenance_rules_json?: Json;
  name?: string;
  slug?: string;
};

// world_id is redundant with managed_population_type_id (a BEFORE INSERT
// trigger would derive it if omitted) but the generated Supabase types
// require it on insert, so it's passed through explicitly from the parent
// mutation's worldId.
type ManagedPopulationHusbandryJobInsertPayload = {
  job_id: string;
  managed_population_type_id: string;
  workers_per_n_animals: number;
  world_id: string;
};

type ManagedPopulationCullingJobInsertPayload = {
  job_id: string;
  managed_population_type_id: string;
  max_cull_per_worker: number;
  world_id: string;
};

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

const managedPopulationTypeMutations = buildTrashLifecycleMutations<
  ManagedPopulationType,
  CreateManagedPopulationTypeInput,
  UpdateManagedPopulationTypeInput,
  SoftDeleteManagedPopulationTypeInput,
  SoftDeleteManagedPopulationTypeResult,
  RestoreManagedPopulationTypeInput,
  RestoreManagedPopulationTypeResult,
  HardDeleteManagedPopulationTypeInput,
  HardDeleteManagedPopulationTypeResult
>({
  actionNames: {
    create: "create-managed-population-type",
    hardDelete: "hard-delete-managed-population-type",
    restore: "restore-managed-population-type",
    softDelete: "soft-delete-managed-population-type",
    update: "update-managed-population-type",
  },
  getDetailId: {
    restore: (result) => result.managedPopulationTypeId,
    softDelete: (result) => result.managedPopulationTypeId,
  },
  mutationFns: {
    create: createManagedPopulationType,
    hardDelete: hardDeleteManagedPopulationType,
    restore: restoreManagedPopulationType,
    softDelete: softDeleteManagedPopulationType,
    update: updateManagedPopulationType,
  },
  queryKeys: {
    activeByWorld: managedPopulationsQueryKeys.activeByWorld,
    all: managedPopulationsQueryKeys.all,
    byWorld: managedPopulationsQueryKeys.byWorld,
    detail: managedPopulationsQueryKeys.detail,
  },
});

export const createManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.create;
export const updateManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.update;
export const softDeleteManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.softDelete;
export const restoreManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.restore;
export const hardDeleteManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.hardDelete;

async function createManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: CreateManagedPopulationTypeInput,
): Promise<ManagedPopulationType> {
  const values = parseInput(createManagedPopulationTypeInputSchema, input);

  const insertPayload: ManagedPopulationTypeInsertPayload = {
    growth_rate: values.growthRate,
    icon: values.icon ?? null,
    icon_color: values.iconColor ?? null,
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

  const { data: insertedRow, error: insertError } = await client
    .from("managed_population_types")
    .insert(insertPayload)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertError !== null) {
    throw normalizeSupabaseError(insertError);
  }
  if (insertedRow === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be created.",
    });
  }

  await insertManagedPopulationHusbandryJobs(
    client,
    insertedRow.id,
    values.worldId,
    values.husbandryJobs,
  );
  await insertManagedPopulationCullingJobs(
    client,
    insertedRow.id,
    values.worldId,
    values.cullingJobs,
  );

  return fetchManagedPopulationTypeById(client, insertedRow.id);
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
  if (values.icon !== undefined) {
    updatePayload.icon = values.icon;
  }
  if (values.iconColor !== undefined) {
    updatePayload.icon_color = values.iconColor;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { data, error } = await client
      .from("managed_population_types")
      .update(updatePayload)
      .eq("id", values.managedPopulationTypeId)
      .eq("world_id", values.worldId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }
    if (data === null) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_found",
        message: "Managed population type could not be updated.",
      });
    }
  } else {
    const { data, error } = await client
      .from("managed_population_types")
      .select("id")
      .eq("id", values.managedPopulationTypeId)
      .eq("world_id", values.worldId)
      .maybeSingle<{ id: string }>();

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }
    if (data === null) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_found",
        message: "Managed population type could not be updated.",
      });
    }
  }

  if (values.husbandryJobs !== undefined) {
    await replaceManagedPopulationHusbandryJobs(
      client,
      values.managedPopulationTypeId,
      values.worldId,
      values.husbandryJobs,
    );
  }

  if (values.cullingJobs !== undefined) {
    await replaceManagedPopulationCullingJobs(
      client,
      values.managedPopulationTypeId,
      values.worldId,
      values.cullingJobs,
    );
  }

  return fetchManagedPopulationTypeById(client, values.managedPopulationTypeId);
}

// No DB transaction wraps the delete+insert below: the join-table mutations
// are admin-only, low-frequency, and RLS-gated, so a client-side sequential
// replace is an acceptable trade-off for the join-table shape (see issue
// #1247, mirroring #1246 for deposit_type_jobs).
async function replaceManagedPopulationHusbandryJobs(
  client: GubernatorSupabaseClient,
  managedPopulationTypeId: string,
  worldId: string,
  jobs: readonly ManagedPopulationHusbandryJobValues[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("managed_population_husbandry_jobs")
    .delete()
    .eq("managed_population_type_id", managedPopulationTypeId);

  if (deleteError !== null) {
    throw normalizeSupabaseError(deleteError);
  }

  await insertManagedPopulationHusbandryJobs(
    client,
    managedPopulationTypeId,
    worldId,
    jobs,
  );
}

async function insertManagedPopulationHusbandryJobs(
  client: GubernatorSupabaseClient,
  managedPopulationTypeId: string,
  worldId: string,
  jobs: readonly ManagedPopulationHusbandryJobValues[],
): Promise<void> {
  const insertPayload: ManagedPopulationHusbandryJobInsertPayload[] = jobs.map(
    (job) => ({
      job_id: job.jobId,
      managed_population_type_id: managedPopulationTypeId,
      workers_per_n_animals: job.workersPerNAnimals,
      world_id: worldId,
    }),
  );

  const { error } = await client
    .from("managed_population_husbandry_jobs")
    .insert(insertPayload);

  if (error !== null) {
    if (isDuplicateHusbandryJobConflict(error)) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_husbandry_job_already_linked",
        message:
          "Each job may only be linked once as a husbandry job per population type.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function replaceManagedPopulationCullingJobs(
  client: GubernatorSupabaseClient,
  managedPopulationTypeId: string,
  worldId: string,
  jobs: readonly ManagedPopulationCullingJobValues[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("managed_population_culling_jobs")
    .delete()
    .eq("managed_population_type_id", managedPopulationTypeId);

  if (deleteError !== null) {
    throw normalizeSupabaseError(deleteError);
  }

  await insertManagedPopulationCullingJobs(
    client,
    managedPopulationTypeId,
    worldId,
    jobs,
  );
}

async function insertManagedPopulationCullingJobs(
  client: GubernatorSupabaseClient,
  managedPopulationTypeId: string,
  worldId: string,
  jobs: readonly ManagedPopulationCullingJobValues[],
): Promise<void> {
  const insertPayload: ManagedPopulationCullingJobInsertPayload[] = jobs.map(
    (job) => ({
      job_id: job.jobId,
      managed_population_type_id: managedPopulationTypeId,
      max_cull_per_worker: job.maxCullPerWorker,
      world_id: worldId,
    }),
  );

  const { error } = await client
    .from("managed_population_culling_jobs")
    .insert(insertPayload);

  if (error !== null) {
    if (isDuplicateCullingJobConflict(error)) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_culling_job_already_linked",
        message:
          "Each job may only be linked once as a culling job per population type.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function fetchManagedPopulationTypeById(
  client: GubernatorSupabaseClient,
  managedPopulationTypeId: string,
): Promise<ManagedPopulationType> {
  const { data, error } = await client
    .from("managed_population_types")
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .eq("id", managedPopulationTypeId)
    .maybeSingle<ManagedPopulationTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be found.",
    });
  }

  return toManagedPopulationType(data);
}

async function softDeleteManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: SoftDeleteManagedPopulationTypeInput,
): Promise<SoftDeleteManagedPopulationTypeResult> {
  const values = parseInput(softDeleteManagedPopulationTypeInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_managed_population_type", {
      p_mpt_id: values.managedPopulationTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be trashed.",
    });
  }

  return { managedPopulationTypeId: data.id, worldId: data.world_id };
}

async function restoreManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: RestoreManagedPopulationTypeInput,
): Promise<RestoreManagedPopulationTypeResult> {
  const values = parseInput(restoreManagedPopulationTypeInputSchema, input);

  const { data, error } = await client
    .rpc("restore_managed_population_type", {
      p_mpt_id: values.managedPopulationTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be restored.",
    });
  }

  return { managedPopulationTypeId: data.id, worldId: data.world_id };
}

async function hardDeleteManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: HardDeleteManagedPopulationTypeInput,
): Promise<HardDeleteManagedPopulationTypeResult> {
  const values = parseInput(hardDeleteManagedPopulationTypeInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_managed_population_type", {
      p_mpt_id: values.managedPopulationTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be permanently deleted.",
    });
  }

  return { managedPopulationTypeId: data.id, worldId: data.world_id };
}

function toPopulationResourceJson(
  entries: readonly PopulationResourceEntry[],
): Json {
  return toSnakeCaseEntries(entries, {
    amountPerNAnimals: "amount_per_n_animals",
    resourceId: "resource_id",
  });
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

// managed_population_husbandry_jobs_unique / _culling_jobs_unique are scoped
// per population type only (managed_population_type_id, job_id), unlike the
// old world-wide-unique managed_population_types_unique_active_husbandry_job_id
// / _culling_job_id constraints — a job can now be linked to multiple
// population types, and the same job can appear as both a husbandry and a
// culling job for one type. This only fires as a defensive backstop; the
// form/schema already reject duplicate jobIds within a single submission.
function isDuplicateHusbandryJobConflict(error: {
  code: string;
  message: string;
}): boolean {
  return (
    error.code === "23505" &&
    error.message.includes("managed_population_husbandry_jobs_unique")
  );
}

function isDuplicateCullingJobConflict(error: {
  code: string;
  message: string;
}): boolean {
  return (
    error.code === "23505" &&
    error.message.includes("managed_population_culling_jobs_unique")
  );
}
