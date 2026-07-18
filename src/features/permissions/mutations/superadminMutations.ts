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

import { worldAccessQueryKeys } from "../../worlds/queries/worldAccessQueryKeys";
import { permissionQueryKeys } from "../queries/permissionQueryKeys";
import { superadminQueryKeys } from "../queries/superadminQueryKeys";
import { readSendEmailErrorPayload } from "../utils/sendEmailErrorPayload";

import type {
  CreateUserInput,
  FailStuckTransitionInput,
  FailStuckTransitionResult,
  PreviewWorldDeleteResult,
  PruneWorldDataInput,
  PruneWorldDataResult,
  SendEmailInput,
  SendEmailResult,
  SetWorldRetentionConfigInput,
  UpdateSmtpSettingsInput,
} from "../types/superadminTypes";

type SuperadminErrorCode =
  | "superadmin_not_authorized"
  | "superadmin_last_guard"
  | "superadmin_user_exists"
  | "superadmin_operation_failed"
  | "superadmin_no_recipients"
  | "superadmin_rate_limited"
  | "superadmin_invalid_retention";

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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: superadminQueryKeys.worldAdminsForUser(input.userId),
        }),
        queryClient.invalidateQueries({
          queryKey: worldAccessQueryKeys.currentUserAdminWorldIds(input.userId),
        }),
        queryClient.invalidateQueries({
          queryKey: permissionQueryKeys.currentAccessContext(),
        }),
      ]);
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: superadminQueryKeys.worldAdminsForUser(input.userId),
        }),
        queryClient.invalidateQueries({
          queryKey: worldAccessQueryKeys.currentUserAdminWorldIds(input.userId),
        }),
        queryClient.invalidateQueries({
          queryKey: permissionQueryKeys.currentAccessContext(),
        }),
      ]);
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

export function sendEmailMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  SendEmailResult,
  SuperadminMutationError,
  SendEmailInput
> {
  return mutationOptions({
    mutationFn: (input: SendEmailInput) => sendEmail(client, input),
    mutationKey: [...superadminQueryKeys.all, "send-email"],
    onSuccess: async (_result, input): Promise<void> => {
      if (input.dryRun === true) return;
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.smtpStatus(),
      });
    },
  });
}

type SendEmailFunctionResponse =
  | { readonly ok: true; readonly data: SendEmailResult }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

function isSendEmailSuccessResponse(
  value: unknown,
): value is Extract<SendEmailFunctionResponse, { ok: true }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok: unknown }).ok === true &&
    typeof (value as { data: unknown }).data === "object"
  );
}

function isSendEmailErrorResponse(
  value: unknown,
): value is Extract<SendEmailFunctionResponse, { ok: false }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok: unknown }).ok === false &&
    typeof (value as { error: unknown }).error === "object"
  );
}

function mapSendEmailErrorCode(
  code: string,
  message: string,
): SuperadminMutationError {
  if (code === "superadmin_required" || code === "unauthenticated") {
    return new SuperadminMutationError({
      code: "superadmin_not_authorized",
      message:
        code === "unauthenticated"
          ? "Sign-in expired, please sign in again."
          : message,
    });
  }
  if (code === "rate_limit_exceeded") {
    return new SuperadminMutationError({
      code: "superadmin_rate_limited",
      message: "Too many send attempts. Wait a moment before trying again.",
    });
  }
  if (code === "no_recipients" || code === "too_many_recipients") {
    return new SuperadminMutationError({
      code: "superadmin_no_recipients",
      message,
    });
  }
  return new SuperadminMutationError({
    code: "superadmin_operation_failed",
    message,
  });
}

async function sendEmail(
  client: GubernatorSupabaseClient,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const response = await client.functions.invoke<unknown>("send-email", {
    body: input,
  });

  if (response.error !== null) {
    const errorPayload = await readSendEmailErrorPayload(response.error);
    if (errorPayload !== null) {
      throw mapSendEmailErrorCode(
        errorPayload.error.code,
        errorPayload.error.message,
      );
    }
    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: "Sending email failed.",
    });
  }

  if (isSendEmailSuccessResponse(response.data)) {
    return response.data.data;
  }

  if (isSendEmailErrorResponse(response.data)) {
    throw mapSendEmailErrorCode(
      response.data.error.code,
      response.data.error.message,
    );
  }

  throw new SuperadminMutationError({
    code: "superadmin_operation_failed",
    message: "Unexpected response from send-email service.",
  });
}

export function updateSmtpSettingsMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  SuperadminMutationError,
  UpdateSmtpSettingsInput
> {
  return mutationOptions({
    mutationFn: (input: UpdateSmtpSettingsInput) =>
      updateSmtpSettings(client, input),
    mutationKey: [...superadminQueryKeys.all, "update-smtp-settings"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.smtpStatus(),
      });
    },
  });
}

type UpdateSmtpSettingsFunctionResponse =
  | { readonly ok: true; readonly data: { readonly updated: true } }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

function isUpdateSmtpSettingsErrorResponse(
  value: unknown,
): value is Extract<UpdateSmtpSettingsFunctionResponse, { ok: false }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok: unknown }).ok === false &&
    typeof (value as { error: unknown }).error === "object"
  );
}

async function updateSmtpSettings(
  client: GubernatorSupabaseClient,
  input: UpdateSmtpSettingsInput,
): Promise<void> {
  const response = await client.functions.invoke<unknown>("send-email", {
    body: { action: "update_smtp_settings", ...input },
  });

  if (response.error !== null) {
    const errorPayload = await readSendEmailErrorPayload(response.error);
    if (errorPayload !== null) {
      throw mapSendEmailErrorCode(
        errorPayload.error.code,
        errorPayload.error.message,
      );
    }
    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: "Saving SMTP settings failed.",
    });
  }

  if (isUpdateSmtpSettingsErrorResponse(response.data)) {
    throw mapSendEmailErrorCode(
      response.data.error.code,
      response.data.error.message,
    );
  }
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

export function setWorldRetentionConfigMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  SuperadminMutationError,
  SetWorldRetentionConfigInput
> {
  return mutationOptions({
    mutationFn: (input: SetWorldRetentionConfigInput) =>
      setWorldRetentionConfig(client, input),
    mutationKey: [...superadminQueryKeys.all, "set-world-retention-config"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.retentionConfig(input.worldId),
      });
    },
  });
}

async function setWorldRetentionConfig(
  client: GubernatorSupabaseClient,
  input: SetWorldRetentionConfigInput,
): Promise<void> {
  const { error } = await client.from("world_retention_config").upsert(
    {
      log_retention_turns: input.logRetentionTurns,
      memory_retention_turns: input.memoryRetentionTurns,
      snapshot_retention_turns: input.snapshotRetentionTurns,
      world_id: input.worldId,
    },
    { onConflict: "world_id" },
  );

  if (error !== null) {
    if (error.code === "42501") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    if (error.code === "23514") {
      throw new SuperadminMutationError({
        code: "superadmin_invalid_retention",
        message:
          "Retention values must be empty (keep all) or a whole number of at least 1.",
      });
    }
    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: error.message,
    });
  }
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

export function failStuckTransitionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  FailStuckTransitionResult,
  SuperadminMutationError,
  FailStuckTransitionInput
> {
  return mutationOptions({
    mutationFn: (input: FailStuckTransitionInput) =>
      failStuckTransition(client, input),
    mutationKey: [...superadminQueryKeys.all, "fail-stuck-transition"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: superadminQueryKeys.runningTransitions(),
      });
    },
  });
}

async function failStuckTransition(
  client: GubernatorSupabaseClient,
  input: FailStuckTransitionInput,
): Promise<FailStuckTransitionResult> {
  const { data, error } = await client.rpc("fail_stuck_turn_transition", {
    p_world_id: input.worldId,
    p_transition_id: input.transitionId,
    ...(input.reason !== undefined ? { p_reason: input.reason } : {}),
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

  return data as FailStuckTransitionResult;
}

export function previewWorldDeleteMutationOptions({
  client = requireSupabaseClient(),
}: {
  readonly client?: GubernatorSupabaseClient;
}): UseMutationOptions<
  PreviewWorldDeleteResult,
  SuperadminMutationError,
  string
> {
  return mutationOptions({
    mutationFn: (worldId: string) => previewWorldDelete(client, worldId),
    mutationKey: [...superadminQueryKeys.all, "preview-world-delete"],
  });
}

async function previewWorldDelete(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<PreviewWorldDeleteResult> {
  const { data, error } = await client.rpc("preview_world_delete", {
    p_world_id: worldId,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new SuperadminMutationError({
        code: "superadmin_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    if (error.code === "P0002") {
      throw new SuperadminMutationError({
        code: "superadmin_operation_failed",
        message: "World not found.",
      });
    }
    throw new SuperadminMutationError({
      code: "superadmin_operation_failed",
      message: error.message,
    });
  }

  return data as PreviewWorldDeleteResult;
}
