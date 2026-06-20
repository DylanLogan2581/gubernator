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

import { superadminQueryKeys } from "../queries/superadminQueryKeys";

import type {
  CreateUserInput,
  PruneWorldDataInput,
  PruneWorldDataResult,
} from "../types/superadminTypes";

type SuperadminErrorCode =
  | "superadmin_not_authorized"
  | "superadmin_last_guard"
  | "superadmin_user_exists"
  | "superadmin_operation_failed";

export const {
  ErrorClass: SuperadminMutationError,
  isError: isSuperadminMutationError,
} = createMutationError<SuperadminErrorCode>("SuperadminMutationError");
export type SuperadminMutationError = InstanceType<
  typeof SuperadminMutationError
>;

type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

type GrantWorldAdminInput = {
  readonly userId: string;
  readonly worldId: string;
};

type RevokeWorldAdminInput = {
  readonly userId: string;
  readonly worldId: string;
};

type SetUserSuperAdminInput = {
  readonly userId: string;
  readonly value: boolean;
};

type CreateUserResult = {
  readonly email: string;
  readonly userId: string;
  readonly username: string;
};

export function grantWorldAdminMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  SuperadminMutationError,
  GrantWorldAdminInput
> {
  return mutationOptions({
    mutationFn: (input: GrantWorldAdminInput) => grantWorldAdmin(client, input),
    mutationKey: [...superadminQueryKeys.all, "grant-world-admin"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.worldAdminsForUser(input.userId),
      });
    },
  });
}

export function revokeWorldAdminMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  SuperadminMutationError,
  RevokeWorldAdminInput
> {
  return mutationOptions({
    mutationFn: (input: RevokeWorldAdminInput) =>
      revokeWorldAdmin(client, input),
    mutationKey: [...superadminQueryKeys.all, "revoke-world-admin"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.worldAdminsForUser(input.userId),
      });
    },
  });
}

export function setUserSuperAdminMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  SuperadminMutationError,
  SetUserSuperAdminInput
> {
  return mutationOptions({
    mutationFn: (input: SetUserSuperAdminInput) =>
      setUserSuperAdmin(client, input),
    mutationKey: [...superadminQueryKeys.all, "set-super-admin"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.users(),
      });
    },
  });
}

export function createUserMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  CreateUserResult,
  SuperadminMutationError,
  CreateUserInput
> {
  return mutationOptions({
    mutationFn: (input: CreateUserInput) => createUser(client, input),
    mutationKey: [...superadminQueryKeys.all, "create-user"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.users(),
      });
    },
  });
}

async function grantWorldAdmin(
  client: GubernatorSupabaseClient,
  input: GrantWorldAdminInput,
): Promise<void> {
  const { error } = await client.rpc("grant_world_admin", {
    p_user_id: input.userId,
    p_world_id: input.worldId,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function revokeWorldAdmin(
  client: GubernatorSupabaseClient,
  input: RevokeWorldAdminInput,
): Promise<void> {
  const { error } = await client.rpc("revoke_world_admin", {
    p_user_id: input.userId,
    p_world_id: input.worldId,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function setUserSuperAdmin(
  client: GubernatorSupabaseClient,
  input: SetUserSuperAdminInput,
): Promise<void> {
  const { error } = await client.rpc("set_user_super_admin", {
    p_user_id: input.userId,
    p_value: input.value,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    if (error.code === "P0001") {
      throw new SuperadminMutationError({
        code: "superadmin_last_guard",
        message: "Cannot remove the last remaining superadmin.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

type AdminCreateUserFunctionResponse =
  | {
      readonly ok: true;
      readonly data: CreateUserResult;
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

async function createUser(
  client: GubernatorSupabaseClient,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const response = await client.functions.invoke<unknown>("admin-create-user", {
    body: {
      email: input.email,
      password: input.password,
      sendMagicLink: input.sendMagicLink ?? false,
      username: input.username,
    },
  });

  if (response.error !== null) {
    const errorPayload = await readFunctionErrorPayload(response.error);

    if (errorPayload !== null) {
      if (errorPayload.error.code === "email_conflict") {
        throw new SuperadminMutationError({
          code: "superadmin_user_exists",
          message: errorPayload.error.message,
        });
      }
      if (errorPayload.error.code === "superadmin_required") {
        throw new SuperadminMutationError({
          code: "superadmin_not_authorized",
          message: errorPayload.error.message,
        });
      }
      if (errorPayload.error.code === "unauthenticated") {
        throw new SuperadminMutationError({
          code: "superadmin_not_authorized",
          message: "Sign-in expired, please sign in again.",
        });
      }
      if (errorPayload.error.code === "auth_admin_error") {
        throw new SuperadminMutationError({
          code: "superadmin_operation_failed",
          message:
            "Something went wrong creating the user. Try again or contact support.",
        });
      }
      throw new SuperadminMutationError({
        code: "superadmin_operation_failed",
        message: errorPayload.error.message,
      });
    }

    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: "User creation failed.",
    });
  }

  if (isAdminCreateUserSuccessResponse(response.data)) {
    return response.data.data;
  }

  if (isAdminCreateUserErrorResponse(response.data)) {
    if (response.data.error.code === "email_conflict") {
      throw new SuperadminMutationError({
        code: "superadmin_user_exists",
        message: response.data.error.message,
      });
    }
    if (response.data.error.code === "superadmin_required") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: response.data.error.message,
      });
    }
    if (response.data.error.code === "unauthenticated") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Sign-in expired, please sign in again.",
      });
    }
    if (response.data.error.code === "auth_admin_error") {
      throw new SuperadminMutationError({
        code: "superadmin_operation_failed",
        message:
          "Something went wrong creating the user. Try again or contact support.",
      });
    }
    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: response.data.error.message,
    });
  }

  throw new SuperadminMutationError({
    code: "superadmin_operation_failed",
    message: "Unexpected response from user creation service.",
  });
}

export function pruneWorldDataMutationOptions({
  client = requireSupabaseClient(),
}: {
  readonly client?: GubernatorSupabaseClient;
}): UseMutationOptions<
  PruneWorldDataResult,
  SuperadminMutationError,
  PruneWorldDataInput
> {
  return mutationOptions({
    mutationFn: (input: PruneWorldDataInput) => pruneWorldData(client, input),
    mutationKey: [...superadminQueryKeys.all, "prune-world-data"],
  });
}

async function pruneWorldData(
  client: GubernatorSupabaseClient,
  input: PruneWorldDataInput,
): Promise<PruneWorldDataResult> {
  const { data, error } = await client.rpc("prune_old_snapshots_and_logs", {
    p_world_id: input.worldId,
    p_retention_turns: input.retentionTurns,
    p_dry_run: input.dryRun,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: error.message,
    });
  }

  return data as PruneWorldDataResult;
}

async function readFunctionErrorPayload(
  error: unknown,
): Promise<Extract<AdminCreateUserFunctionResponse, { ok: false }> | null> {
  if (typeof error !== "object" || error === null || !("context" in error)) {
    return null;
  }

  const maybeContext = (error as Record<string, unknown>)["context"];
  if (typeof maybeContext !== "object" || maybeContext === null) {
    return null;
  }

  const context = maybeContext as Record<string, unknown>;
  if (typeof context["json"] !== "function") {
    return null;
  }

  try {
    const payload: unknown = await (
      context as { json: () => Promise<unknown> }
    ).json();
    if (isAdminCreateUserErrorResponse(payload)) {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}

function isAdminCreateUserSuccessResponse(
  value: unknown,
): value is Extract<AdminCreateUserFunctionResponse, { ok: true }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok: unknown }).ok === true &&
    typeof (value as { data: unknown }).data === "object"
  );
}

function isAdminCreateUserErrorResponse(
  value: unknown,
): value is Extract<AdminCreateUserFunctionResponse, { ok: false }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok: unknown }).ok === false &&
    typeof (value as { error: unknown }).error === "object"
  );
}
