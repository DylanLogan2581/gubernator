import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { worldQueryKeys } from "../queries/worldQueryKeys";
import {
  renameWorldInputSchema,
  setWorldCurrentTurnNumberInputSchema,
  type RenameWorldInput,
  type SetWorldCurrentTurnNumberInput,
} from "../schemas/worldSettingsSchemas";

type WorldSettingsErrorCode =
  | "world_settings_input_invalid"
  | "world_settings_not_authorized"
  | "world_settings_not_found"
  | "world_settings_snapshot_conflict";

export const { ErrorClass: WorldSettingsError, isError: isWorldSettingsError } =
  createMutationError<WorldSettingsErrorCode>("WorldSettingsError");
export type WorldSettingsError = InstanceType<typeof WorldSettingsError>;

type WorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: unknown;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

function makeOpts(queryClient: QueryClient): {
  onSuccess: () => Promise<void>;
} {
  return {
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  };
}

export function renameWorldMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<WorldRow, Error, RenameWorldInput> {
  return mutationOptions({
    mutationFn: (input: RenameWorldInput) => renameWorld(client, input),
    mutationKey: [...worldQueryKeys.all, "rename-world"],
    ...makeOpts(queryClient),
  });
}

export function setWorldCurrentTurnNumberMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  WorldRow,
  Error,
  SetWorldCurrentTurnNumberInput
> {
  return mutationOptions({
    mutationFn: (input: SetWorldCurrentTurnNumberInput) =>
      setWorldCurrentTurnNumber(client, input),
    mutationKey: [...worldQueryKeys.all, "set-world-current-turn-number"],
    ...makeOpts(queryClient),
  });
}

async function renameWorld(
  client: GubernatorSupabaseClient,
  input: RenameWorldInput,
): Promise<WorldRow> {
  const values = renameWorldInputSchema.parse(input);

  const { data, error } = await client
    .rpc("rename_world", {
      p_name: values.name.trim(),
      p_world_id: values.worldId,
    })
    .maybeSingle<WorldRow>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldSettingsError({
        code: "world_settings_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldSettingsError({
      code: "world_settings_not_found",
      message: "World could not be renamed.",
    });
  }

  return data;
}

async function setWorldCurrentTurnNumber(
  client: GubernatorSupabaseClient,
  input: SetWorldCurrentTurnNumberInput,
): Promise<WorldRow> {
  const values = setWorldCurrentTurnNumberInputSchema.parse(input);

  const { data, error } = await client
    .rpc("set_world_current_turn_number", {
      p_turn_number: values.turnNumber,
      p_world_id: values.worldId,
    })
    .maybeSingle<WorldRow>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldSettingsError({
        code: "world_settings_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "23514") {
      throw new WorldSettingsError({
        code: "world_settings_snapshot_conflict",
        message:
          "Snapshots exist for later turns. Remove the conflicting snapshots first.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldSettingsError({
      code: "world_settings_not_found",
      message: "World could not be updated.",
    });
  }

  return data;
}
