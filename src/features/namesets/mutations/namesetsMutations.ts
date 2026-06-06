import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { nationsQueryKeys } from "@/features/nations";
import { settlementsQueryKeys } from "@/features/settlements";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import { requireSupabaseClient } from "@/lib/supabase";

import { NAMESET_SELECT, toNameset } from "../queries/namesetsQueries";
import { namesetsQueryKeys } from "../queries/namesetsQueryKeys";
import {
  createNamesetInputSchema,
  hardDeleteNamesetInputSchema,
  restoreNamesetInputSchema,
  setDefaultNamesetInputSchema,
  setNationNamesetInputSchema,
  setSettlementNamesetInputSchema,
  softDeleteNamesetInputSchema,
  updateNamesetInputSchema,
  type CreateNamesetInput,
  type HardDeleteNamesetInput,
  type RestoreNamesetInput,
  type SetDefaultNamesetInput,
  type SetNationNamesetInput,
  type SetSettlementNamesetInput,
  type SoftDeleteNamesetInput,
  type UpdateNamesetInput,
} from "../schemas/namesetSchemas";

import type {
  HardDeleteNamesetResult,
  Nameset,
  RestoreNamesetResult,
  SetDefaultNamesetResult,
  SetEntityNamesetResult,
  SoftDeleteNamesetResult,
} from "../types/namesetTypes";
import type { z } from "zod";

type NamesetMutationErrorCode =
  | "nameset_input_invalid"
  | "nameset_not_authorized"
  | "nameset_not_found"
  | "nameset_is_default";

export type NamesetMutationIssue = MutationIssue;

export const {
  ErrorClass: NamesetMutationError,
  isError: isNamesetMutationError,
} = createMutationError<NamesetMutationErrorCode>("NamesetMutationError");
export type NamesetMutationError = InstanceType<typeof NamesetMutationError>;

type MutationOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

type CreateNamesetMutationOptions = UseMutationOptions<
  Nameset,
  AuthUiError | NamesetMutationError,
  CreateNamesetInput
>;
type UpdateNamesetMutationOptions = UseMutationOptions<
  Nameset,
  AuthUiError | NamesetMutationError,
  UpdateNamesetInput
>;
type SoftDeleteNamesetMutationOptions = UseMutationOptions<
  SoftDeleteNamesetResult,
  AuthUiError | NamesetMutationError,
  SoftDeleteNamesetInput
>;
type RestoreNamesetMutationOptions = UseMutationOptions<
  RestoreNamesetResult,
  AuthUiError | NamesetMutationError,
  RestoreNamesetInput
>;
type HardDeleteNamesetMutationOptions = UseMutationOptions<
  HardDeleteNamesetResult,
  AuthUiError | NamesetMutationError,
  HardDeleteNamesetInput
>;
type SetDefaultNamesetMutationOptions = UseMutationOptions<
  SetDefaultNamesetResult,
  AuthUiError | NamesetMutationError,
  SetDefaultNamesetInput
>;
type SetNationNamesetMutationOptions = UseMutationOptions<
  SetEntityNamesetResult,
  AuthUiError | NamesetMutationError,
  SetNationNamesetInput
>;
type SetSettlementNamesetMutationOptions = UseMutationOptions<
  SetEntityNamesetResult,
  AuthUiError | NamesetMutationError,
  SetSettlementNamesetInput
>;

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new NamesetMutationError({
        code: "nameset_input_invalid",
        issues,
        message: "Nameset input is invalid.",
      }),
  );
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export function createNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): CreateNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateNamesetInput) => createNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "create-nameset"],
    onSuccess: async (entity: Nameset): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.byWorld(entity.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(entity.worldId),
        }),
      ]);
    },
  });
}

async function createNameset(
  client: GubernatorSupabaseClient,
  input: CreateNamesetInput,
): Promise<Nameset> {
  const values = parseInput(createNamesetInputSchema, input);

  const { data, error } = await client
    .from("namesets")
    .insert({
      world_id: values.worldId,
      name: values.name,
      config_json: values.configJson,
    })
    .select(NAMESET_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nameset could not be created.",
    });
  }

  return toNameset(data);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export function updateNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): UpdateNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateNamesetInput) => updateNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "update-nameset"],
    onSuccess: async (entity: Nameset): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.byWorld(entity.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(entity.worldId),
        }),
      ]);
    },
  });
}

async function updateNameset(
  client: GubernatorSupabaseClient,
  input: UpdateNamesetInput,
): Promise<Nameset> {
  const values = parseInput(updateNamesetInputSchema, input);

  const { data, error } = await client
    .from("namesets")
    .update({
      name: values.name,
      config_json: values.configJson,
    })
    .eq("id", values.namesetId)
    .eq("world_id", values.worldId)
    .select(NAMESET_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nameset could not be updated.",
    });
  }

  return toNameset(data);
}

// ---------------------------------------------------------------------------
// soft delete
// ---------------------------------------------------------------------------

export function softDeleteNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): SoftDeleteNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: SoftDeleteNamesetInput) =>
      softDeleteNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "soft-delete-nameset"],
    onSuccess: async (result: SoftDeleteNamesetResult): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

async function softDeleteNameset(
  client: GubernatorSupabaseClient,
  input: SoftDeleteNamesetInput,
): Promise<SoftDeleteNamesetResult> {
  const values = parseInput(softDeleteNamesetInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_nameset", {
      p_nameset_id: values.namesetId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new NamesetMutationError({
        code: "nameset_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nameset could not be soft-deleted.",
    });
  }

  return { namesetId: data.id, worldId: data.world_id };
}

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------

export function restoreNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): RestoreNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: RestoreNamesetInput) => restoreNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "restore-nameset"],
    onSuccess: async (result: RestoreNamesetResult): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

async function restoreNameset(
  client: GubernatorSupabaseClient,
  input: RestoreNamesetInput,
): Promise<RestoreNamesetResult> {
  const values = parseInput(restoreNamesetInputSchema, input);

  const { data, error } = await client
    .rpc("restore_nameset", {
      p_nameset_id: values.namesetId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new NamesetMutationError({
        code: "nameset_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nameset could not be restored.",
    });
  }

  return { namesetId: data.id, worldId: data.world_id };
}

// ---------------------------------------------------------------------------
// hard delete
// ---------------------------------------------------------------------------

export function hardDeleteNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): HardDeleteNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: HardDeleteNamesetInput) =>
      hardDeleteNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "hard-delete-nameset"],
    onSuccess: async (result: HardDeleteNamesetResult): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

async function hardDeleteNameset(
  client: GubernatorSupabaseClient,
  input: HardDeleteNamesetInput,
): Promise<HardDeleteNamesetResult> {
  const values = parseInput(hardDeleteNamesetInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_nameset", {
      p_nameset_id: values.namesetId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new NamesetMutationError({
        code: "nameset_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nameset could not be permanently deleted.",
    });
  }

  return { namesetId: data.id, worldId: data.world_id };
}

// ---------------------------------------------------------------------------
// set default
// ---------------------------------------------------------------------------

export function setDefaultNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): SetDefaultNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetDefaultNamesetInput) =>
      setDefaultNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "set-default-nameset"],
    onSuccess: async (result: SetDefaultNamesetResult): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

async function setDefaultNameset(
  client: GubernatorSupabaseClient,
  input: SetDefaultNamesetInput,
): Promise<SetDefaultNamesetResult> {
  const values = parseInput(setDefaultNamesetInputSchema, input);

  const { data, error } = await client
    .rpc("set_world_default_nameset", {
      p_nameset_id: values.namesetId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new NamesetMutationError({
        code: "nameset_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nameset could not be set as default.",
    });
  }

  return { namesetId: data.id, worldId: data.world_id };
}

// ---------------------------------------------------------------------------
// set nation nameset
// ---------------------------------------------------------------------------

export function setNationNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): SetNationNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationNamesetInput) =>
      setNationNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "set-nation-nameset"],
    onSuccess: async (result: SetEntityNamesetResult): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(result.entityId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(result.worldId),
        }),
      ]);
    },
  });
}

async function setNationNameset(
  client: GubernatorSupabaseClient,
  input: SetNationNamesetInput,
): Promise<SetEntityNamesetResult> {
  const values = parseInput(setNationNamesetInputSchema, input);

  const { data, error } = await client
    .rpc("set_nation_nameset", {
      p_nation_id: values.nationId,
      p_world_id: values.worldId,
      // Generated types don't reflect nullable parameter; null clears the override
      p_nameset_id: values.namesetId as string,
    })
    .maybeSingle<{
      readonly id: string;
      readonly world_id: string;
      readonly nameset_id: string | null;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new NamesetMutationError({
        code: "nameset_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Nation nameset could not be updated.",
    });
  }

  return {
    entityId: data.id,
    worldId: data.world_id,
    namesetId: data.nameset_id,
  };
}

// ---------------------------------------------------------------------------
// set settlement nameset
// ---------------------------------------------------------------------------

export function setSettlementNamesetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationOpts): SetSettlementNamesetMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetSettlementNamesetInput) =>
      setSettlementNameset(client, input),
    mutationKey: [...namesetsQueryKeys.all, "set-settlement-nameset"],
    onSuccess: async (result: SetEntityNamesetResult): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: namesetsQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: settlementsQueryKeys.detail(result.entityId),
        }),
        queryClient.invalidateQueries({
          queryKey: settlementsQueryKeys.byWorld(result.worldId),
        }),
      ]);
    },
  });
}

async function setSettlementNameset(
  client: GubernatorSupabaseClient,
  input: SetSettlementNamesetInput,
): Promise<SetEntityNamesetResult> {
  const values = parseInput(setSettlementNamesetInputSchema, input);

  const { data, error } = await client
    .rpc("set_settlement_nameset", {
      p_settlement_id: values.settlementId,
      p_world_id: values.worldId,
      // Generated types don't reflect nullable parameter; null clears the override
      p_nameset_id: values.namesetId as string,
    })
    .maybeSingle<{
      readonly id: string;
      readonly world_id: string;
      readonly nameset_id: string | null;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new NamesetMutationError({
        code: "nameset_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NamesetMutationError({
      code: "nameset_not_found",
      message: "Settlement nameset could not be updated.",
    });
  }

  return {
    entityId: data.id,
    worldId: data.world_id,
    namesetId: data.nameset_id,
  };
}
