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

import { resourceCategoriesQueryKeys } from "../queries/resourceCategoriesQueryKeys";
import {
  RESOURCE_CATEGORY_SELECT,
  toResourceCategory,
  type ResourceCategoryRow,
} from "../queries/resourceCategoryRow";
import {
  createResourceCategoryInputSchema,
  deleteResourceCategoryInputSchema,
  reorderResourceCategoryInputSchema,
  updateResourceCategoryInputSchema,
  type CreateResourceCategoryInput,
  type DeleteResourceCategoryInput,
  type ReorderResourceCategoryInput,
  type UpdateResourceCategoryInput,
} from "../schemas/resourceCategorySchemas";

import type { ResourceCategory } from "../types/resourceCategoryTypes";
import type { z } from "zod";

type ResourceCategoryMutationErrorCode =
  | "resource_category_forbidden"
  | "resource_category_input_invalid"
  | "resource_category_name_taken"
  | "resource_category_not_found";

export type ResourceCategoryMutationIssue = MutationIssue;

export const {
  ErrorClass: ResourceCategoryMutationError,
  isError: isResourceCategoryMutationError,
} = createMutationError<ResourceCategoryMutationErrorCode>(
  "ResourceCategoryMutationError",
);
export type ResourceCategoryMutationError = InstanceType<
  typeof ResourceCategoryMutationError
>;

export type DeleteResourceCategoryResult = {
  readonly categoryId: string;
  readonly worldId: string;
};

type CreateResourceCategoryMutationOptions = UseMutationOptions<
  ResourceCategory,
  AuthUiError | ResourceCategoryMutationError,
  CreateResourceCategoryInput
>;
type UpdateResourceCategoryMutationOptions = UseMutationOptions<
  ResourceCategory,
  AuthUiError | ResourceCategoryMutationError,
  UpdateResourceCategoryInput
>;
type DeleteResourceCategoryMutationOptions = UseMutationOptions<
  DeleteResourceCategoryResult,
  AuthUiError | ResourceCategoryMutationError,
  DeleteResourceCategoryInput
>;
type ReorderResourceCategoryMutationOptions = UseMutationOptions<
  readonly ResourceCategory[],
  AuthUiError | ResourceCategoryMutationError,
  ReorderResourceCategoryInput
>;

export function createResourceCategoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateResourceCategoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateResourceCategoryInput) =>
      createResourceCategory(client, input),
    mutationKey: [...resourceCategoriesQueryKeys.all, "create-category"],
    onSuccess: async (category): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: resourceCategoriesQueryKeys.byWorld(category.worldId),
      });
    },
  });
}

export function updateResourceCategoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateResourceCategoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateResourceCategoryInput) =>
      updateResourceCategory(client, input),
    mutationKey: [...resourceCategoriesQueryKeys.all, "update-category"],
    onSuccess: async (category): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourceCategoriesQueryKeys.byWorld(category.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourceCategoriesQueryKeys.detail(category.id),
        }),
      ]);
    },
  });
}

export function deleteResourceCategoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteResourceCategoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteResourceCategoryInput) =>
      deleteResourceCategory(client, input),
    mutationKey: [...resourceCategoriesQueryKeys.all, "delete-category"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: resourceCategoriesQueryKeys.detail(result.categoryId),
      });
      await queryClient.invalidateQueries({
        queryKey: resourceCategoriesQueryKeys.byWorld(result.worldId),
      });
    },
  });
}

export function reorderResourceCategoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ReorderResourceCategoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: ReorderResourceCategoryInput) =>
      reorderResourceCategory(client, input),
    mutationKey: [...resourceCategoriesQueryKeys.all, "reorder-category"],
    onSuccess: async (categories): Promise<void> => {
      const worldId = categories[0]?.worldId;
      if (worldId === undefined) return;
      await queryClient.invalidateQueries({
        queryKey: resourceCategoriesQueryKeys.byWorld(worldId),
      });
    },
  });
}

async function createResourceCategory(
  client: GubernatorSupabaseClient,
  input: CreateResourceCategoryInput,
): Promise<ResourceCategory> {
  const values = parseInput(createResourceCategoryInputSchema, input);

  const nextSortOrder = await getNextSortOrder(client, values.worldId);

  const { data, error } = await client
    .from("resource_categories")
    .insert({
      color: values.color,
      name: values.name.trim(),
      sort_order: nextSortOrder,
      world_id: values.worldId,
    })
    .select(RESOURCE_CATEGORY_SELECT)
    .maybeSingle<ResourceCategoryRow>();

  if (error !== null) {
    throw translateResourceCategoryError(error);
  }

  if (data === null) {
    throw new ResourceCategoryMutationError({
      code: "resource_category_not_found",
      message: "Resource category could not be created.",
    });
  }

  return toResourceCategory(data);
}

async function getNextSortOrder(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<number> {
  const { data, error } = await client
    .from("resource_categories")
    .select("sort_order")
    .eq("world_id", worldId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ readonly sort_order: number }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? 0 : data.sort_order + 1;
}

async function updateResourceCategory(
  client: GubernatorSupabaseClient,
  input: UpdateResourceCategoryInput,
): Promise<ResourceCategory> {
  const values = parseInput(updateResourceCategoryInputSchema, input);

  const updatePayload: {
    color?: string;
    name?: string;
  } = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.color !== undefined) {
    updatePayload.color = values.color;
  }

  const { data, error } = await client
    .from("resource_categories")
    .update(updatePayload)
    .eq("id", values.categoryId)
    .eq("world_id", values.worldId)
    .select(RESOURCE_CATEGORY_SELECT)
    .maybeSingle<ResourceCategoryRow>();

  if (error !== null) {
    throw translateResourceCategoryError(error);
  }

  if (data === null) {
    throw new ResourceCategoryMutationError({
      code: "resource_category_not_found",
      message: "Resource category could not be updated.",
    });
  }

  return toResourceCategory(data);
}

async function deleteResourceCategory(
  client: GubernatorSupabaseClient,
  input: DeleteResourceCategoryInput,
): Promise<DeleteResourceCategoryResult> {
  const values = parseInput(deleteResourceCategoryInputSchema, input);

  const { data, error } = await client
    .from("resource_categories")
    .delete()
    .eq("id", values.categoryId)
    .eq("world_id", values.worldId)
    .select("id,world_id")
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    throw translateResourceCategoryError(error);
  }

  if (data === null) {
    throw new ResourceCategoryMutationError({
      code: "resource_category_not_found",
      message: "Resource category could not be deleted.",
    });
  }

  return { categoryId: data.id, worldId: data.world_id };
}

async function reorderResourceCategory(
  client: GubernatorSupabaseClient,
  input: ReorderResourceCategoryInput,
): Promise<readonly ResourceCategory[]> {
  const values = parseInput(reorderResourceCategoryInputSchema, input);

  const { data, error } = await client
    .from("resource_categories")
    .select(RESOURCE_CATEGORY_SELECT)
    .eq("world_id", values.worldId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<ResourceCategoryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const categories = data.map(toResourceCategory);
  const index = categories.findIndex((c) => c.id === values.categoryId);
  const neighborIndex = values.direction === "up" ? index - 1 : index + 1;

  if (index === -1 || neighborIndex < 0 || neighborIndex >= categories.length) {
    throw new ResourceCategoryMutationError({
      code: "resource_category_not_found",
      message: "Resource category cannot be moved further in that direction.",
    });
  }

  const current = categories[index];
  const neighbor = categories[neighborIndex];
  if (current === undefined || neighbor === undefined) {
    throw new ResourceCategoryMutationError({
      code: "resource_category_not_found",
      message: "Resource category could not be reordered.",
    });
  }

  const [{ error: currentError }, { error: neighborError }] = await Promise.all(
    [
      client
        .from("resource_categories")
        .update({ sort_order: neighbor.sortOrder })
        .eq("id", current.id)
        .eq("world_id", values.worldId),
      client
        .from("resource_categories")
        .update({ sort_order: current.sortOrder })
        .eq("id", neighbor.id)
        .eq("world_id", values.worldId),
    ],
  );

  if (currentError !== null) {
    throw translateResourceCategoryError(currentError);
  }
  if (neighborError !== null) {
    throw translateResourceCategoryError(neighborError);
  }

  return getResourceCategoriesByWorldOrThrow(client, values.worldId);
}

async function getResourceCategoriesByWorldOrThrow(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly ResourceCategory[]> {
  const { data, error } = await client
    .from("resource_categories")
    .select(RESOURCE_CATEGORY_SELECT)
    .eq("world_id", worldId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<ResourceCategoryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toResourceCategory);
}

function translateResourceCategoryError(error: {
  readonly code?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "23505") {
    return new ResourceCategoryMutationError({
      code: "resource_category_name_taken",
      message: "A resource category with this name already exists.",
    });
  }
  if (error.code === "42501") {
    return new ResourceCategoryMutationError({
      code: "resource_category_forbidden",
      message: "You do not have permission to manage resource categories.",
    });
  }
  return normalizeSupabaseError(error);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ResourceCategoryMutationError({
        code: "resource_category_input_invalid",
        issues,
        message: "Resource category input is invalid.",
      }),
  );
}
