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

import {
  CULTURE_SELECT,
  toCulture,
  type CultureRow,
} from "../queries/cultureRow";
import { culturesQueryKeys } from "../queries/culturesQueryKeys";
import {
  createCultureInputSchema,
  deleteCultureInputSchema,
  updateCultureInputSchema,
  type CreateCultureInput,
  type DeleteCultureInput,
  type UpdateCultureInput,
} from "../schemas/cultureSchemas";
import {
  CULTURE_LORE_FIELD_KEYS,
  type CultureLoreFieldKey,
  type Culture,
} from "../types/cultureTypes";

import type { z } from "zod";

const CULTURE_LORE_FIELD_COLUMNS: Readonly<
  Record<CultureLoreFieldKey, string>
> = {
  architectureCraftsmanship: "architecture_craftsmanship",
  artsAesthetics: "arts_aesthetics",
  attitudesToOutsiders: "attitudes_to_outsiders",
  coreValues: "core_values",
  cuisineMeals: "cuisine_meals",
  demonym: "demonym",
  dressFashion: "dress_fashion",
  etiquette: "etiquette",
  festivalsHolidays: "festivals_holidays",
  funeraryCustoms: "funerary_customs",
  genderFamilyNorms: "gender_family_norms",
  languageDialects: "language_dialects",
  leadershipOccupations: "leadership_occupations",
  namingConventions: "naming_conventions",
  origins: "origins",
  ritesOfPassage: "rites_of_passage",
  sayingsIdioms: "sayings_idioms",
  socialHierarchy: "social_hierarchy",
  superstitionsFolklore: "superstitions_folklore",
  taboos: "taboos",
};

type CultureMutationErrorCode =
  | "culture_forbidden"
  | "culture_input_invalid"
  | "culture_name_taken"
  | "culture_not_found";

export type CultureMutationIssue = MutationIssue;

export const {
  ErrorClass: CultureMutationError,
  isError: isCultureMutationError,
} = createMutationError<CultureMutationErrorCode>("CultureMutationError");
export type CultureMutationError = InstanceType<typeof CultureMutationError>;

export type DeleteCultureResult = {
  readonly cultureId: string;
  readonly worldId: string;
};

type CreateCultureMutationOptions = UseMutationOptions<
  Culture,
  AuthUiError | CultureMutationError,
  CreateCultureInput
>;
type UpdateCultureMutationOptions = UseMutationOptions<
  Culture,
  AuthUiError | CultureMutationError,
  UpdateCultureInput
>;
type DeleteCultureMutationOptions = UseMutationOptions<
  DeleteCultureResult,
  AuthUiError | CultureMutationError,
  DeleteCultureInput
>;

export function createCultureMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateCultureMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateCultureInput) => createCulture(client, input),
    mutationKey: [...culturesQueryKeys.all, "create-culture"],
    onSuccess: async (culture): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: culturesQueryKeys.byWorld(culture.worldId),
      });
    },
  });
}

export function updateCultureMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateCultureMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateCultureInput) => updateCulture(client, input),
    mutationKey: [...culturesQueryKeys.all, "update-culture"],
    onSuccess: async (culture): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: culturesQueryKeys.byWorld(culture.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: culturesQueryKeys.detail(culture.id),
        }),
      ]);
    },
  });
}

export function deleteCultureMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteCultureMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteCultureInput) => deleteCulture(client, input),
    mutationKey: [...culturesQueryKeys.all, "delete-culture"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: culturesQueryKeys.detail(result.cultureId),
      });
      await queryClient.invalidateQueries({
        queryKey: culturesQueryKeys.byWorld(result.worldId),
      });
    },
  });
}

async function createCulture(
  client: GubernatorSupabaseClient,
  input: CreateCultureInput,
): Promise<Culture> {
  const values = parseInput(createCultureInputSchema, input);

  const { data, error } = await client
    .from("cultures")
    .insert({
      color: values.color,
      description: values.description ?? null,
      name: values.name.trim(),
      world_id: values.worldId,
    })
    .select(CULTURE_SELECT)
    .maybeSingle<CultureRow>();

  if (error !== null) {
    throw translateCultureError(error);
  }

  if (data === null) {
    throw new CultureMutationError({
      code: "culture_not_found",
      message: "Culture could not be created.",
    });
  }

  return toCulture(data);
}

async function updateCulture(
  client: GubernatorSupabaseClient,
  input: UpdateCultureInput,
): Promise<Culture> {
  const values = parseInput(updateCultureInputSchema, input);

  const updatePayload: Record<string, string | null> = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.description !== undefined) {
    updatePayload.description = values.description;
  }
  if (values.color !== undefined) {
    updatePayload.color = values.color;
  }
  for (const key of CULTURE_LORE_FIELD_KEYS) {
    const value = values[key];
    if (value !== undefined) {
      updatePayload[CULTURE_LORE_FIELD_COLUMNS[key]] = value;
    }
  }

  const { data, error } = await client
    .from("cultures")
    .update(updatePayload)
    .eq("id", values.cultureId)
    .eq("world_id", values.worldId)
    .select(CULTURE_SELECT)
    .maybeSingle<CultureRow>();

  if (error !== null) {
    throw translateCultureError(error);
  }

  if (data === null) {
    throw new CultureMutationError({
      code: "culture_not_found",
      message: "Culture could not be updated.",
    });
  }

  return toCulture(data);
}

async function deleteCulture(
  client: GubernatorSupabaseClient,
  input: DeleteCultureInput,
): Promise<DeleteCultureResult> {
  const values = parseInput(deleteCultureInputSchema, input);

  // p_reassign_to_id is a nullable uuid (default null) -- generated types
  // don't reflect that (see setNationCultureReligion in
  // src/features/nations/mutations/nationsMutations.ts for the same cast).
  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };

  const { data, error } = (await clientAsRpcCapable
    .rpc("delete_culture", {
      p_culture_id: values.cultureId,
      p_reassign_to_id: values.reassignToId ?? null,
    })
    .maybeSingle()) as {
    data: { readonly id: string; readonly world_id: string } | null;
    error: { readonly code?: string | null; readonly message: string } | null;
  };

  if (error !== null) {
    throw translateCultureError(error);
  }

  if (data === null) {
    throw new CultureMutationError({
      code: "culture_not_found",
      message: "Culture could not be deleted.",
    });
  }

  return { cultureId: data.id, worldId: data.world_id };
}

function translateCultureError(error: {
  readonly code?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "23505") {
    return new CultureMutationError({
      code: "culture_name_taken",
      message: "A culture with this name already exists.",
    });
  }
  if (error.code === "42501") {
    return new CultureMutationError({
      code: "culture_forbidden",
      message: "You do not have permission to manage cultures.",
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
      new CultureMutationError({
        code: "culture_input_invalid",
        issues,
        message: "Culture input is invalid.",
      }),
  );
}
