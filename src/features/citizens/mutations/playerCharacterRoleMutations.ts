import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { toCitizen, type CitizenRow } from "../queries/citizensQueries";
import { citizensQueryKeys } from "../queries/citizensQueryKeys";
import {
  assignCitizenRoleInputSchema,
  linkUserToCitizenInputSchema,
  revokeCitizenRoleInputSchema,
  unlinkUserFromCitizenInputSchema,
  type AssignCitizenRoleInput,
  type LinkUserToCitizenInput,
  type RevokeCitizenRoleInput,
  type UnlinkUserFromCitizenInput,
} from "../schemas/citizenSchemas";

import type { Citizen } from "../types/citizenTypes";
import type { z } from "zod";

type PlayerCharacterRoleMutationErrorCode =
  | "citizen_role_input_invalid"
  | "citizen_role_unauthorized";

type LinkUserToCitizenMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | PlayerCharacterRoleMutationError,
  LinkUserToCitizenInput
>;
type UnlinkUserFromCitizenMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | PlayerCharacterRoleMutationError,
  UnlinkUserFromCitizenInput
>;
type AssignCitizenRoleMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | PlayerCharacterRoleMutationError,
  AssignCitizenRoleInput
>;
type RevokeCitizenRoleMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | PlayerCharacterRoleMutationError,
  RevokeCitizenRoleInput
>;

export type PlayerCharacterRoleMutationIssue = MutationIssue;

export const {
  ErrorClass: PlayerCharacterRoleMutationError,
  isError: isPlayerCharacterRoleMutationError,
} = createMutationError<PlayerCharacterRoleMutationErrorCode>(
  "PlayerCharacterRoleMutationError",
);
export type PlayerCharacterRoleMutationError = InstanceType<
  typeof PlayerCharacterRoleMutationError
>;

export function linkUserToCitizenMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): LinkUserToCitizenMutationOptions {
  return mutationOptions({
    mutationFn: (input: LinkUserToCitizenInput) =>
      linkUserToCitizen(client, input),
    mutationKey: [...citizensQueryKeys.all, "link-user-to-citizen"],
    onSuccess: (citizen) => invalidateAfterRoleChange(queryClient, citizen),
  });
}

export function unlinkUserFromCitizenMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UnlinkUserFromCitizenMutationOptions {
  return mutationOptions({
    mutationFn: (input: UnlinkUserFromCitizenInput) =>
      unlinkUserFromCitizen(client, input),
    mutationKey: [...citizensQueryKeys.all, "unlink-user-from-citizen"],
    onSuccess: (citizen) => invalidateAfterRoleChange(queryClient, citizen),
  });
}

export function assignCitizenRoleMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): AssignCitizenRoleMutationOptions {
  return mutationOptions({
    mutationFn: (input: AssignCitizenRoleInput) =>
      assignCitizenRole(client, input),
    mutationKey: [...citizensQueryKeys.all, "assign-citizen-role"],
    onSuccess: (citizen) => invalidateAfterRoleChange(queryClient, citizen),
  });
}

export function revokeCitizenRoleMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RevokeCitizenRoleMutationOptions {
  return mutationOptions({
    mutationFn: (input: RevokeCitizenRoleInput) =>
      revokeCitizenRole(client, input),
    mutationKey: [...citizensQueryKeys.all, "revoke-citizen-role"],
    onSuccess: (citizen) => invalidateAfterRoleChange(queryClient, citizen),
  });
}

async function invalidateAfterRoleChange(
  queryClient: QueryClient,
  _citizen: Citizen,
): Promise<void> {
  // Role changes affect the citizen detail, settlement lists, aggregate stats,
  // and the player-character-by-nation lookup. Invalidating the full citizens
  // namespace is cheaper than enumerating every key, and the data is small.
  await queryClient.invalidateQueries({ queryKey: citizensQueryKeys.all });
}

async function linkUserToCitizen(
  client: GubernatorSupabaseClient,
  input: LinkUserToCitizenInput,
): Promise<Citizen> {
  const values = parseInput(linkUserToCitizenInputSchema, input);

  const { data, error } = await client
    .rpc("link_user_to_citizen", {
      p_citizen_id: values.citizenId,
      p_user_id: values.userId,
    })
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw unauthorizedError("Citizen could not be linked to user.");
  }

  return toCitizen(data);
}

async function unlinkUserFromCitizen(
  client: GubernatorSupabaseClient,
  input: UnlinkUserFromCitizenInput,
): Promise<Citizen> {
  const values = parseInput(unlinkUserFromCitizenInputSchema, input);

  const { data, error } = await client
    .rpc("unlink_user_from_citizen", { p_citizen_id: values.citizenId })
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw unauthorizedError("Citizen could not be unlinked from user.");
  }

  return toCitizen(data);
}

async function assignCitizenRole(
  client: GubernatorSupabaseClient,
  input: AssignCitizenRoleInput,
): Promise<Citizen> {
  const values = parseInput(assignCitizenRoleInputSchema, input);

  const { data, error } = await client
    .rpc("assign_citizen_role", {
      p_citizen_id: values.citizenId,
      p_role_nation_id: values.roleNationId ?? null,
      p_role_settlement_id: values.roleSettlementId ?? null,
      p_role_type: values.roleType,
    })
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw unauthorizedError("Citizen role could not be assigned.");
  }

  return toCitizen(data);
}

async function revokeCitizenRole(
  client: GubernatorSupabaseClient,
  input: RevokeCitizenRoleInput,
): Promise<Citizen> {
  const values = parseInput(revokeCitizenRoleInputSchema, input);

  const { data, error } = await client
    .rpc("revoke_citizen_role", { p_citizen_id: values.citizenId })
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw unauthorizedError("Citizen role could not be revoked.");
  }

  return toCitizen(data);
}

function unauthorizedError(message: string): PlayerCharacterRoleMutationError {
  return new PlayerCharacterRoleMutationError({
    code: "citizen_role_unauthorized",
    message,
  });
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new PlayerCharacterRoleMutationError({
      code: "citizen_role_input_invalid",
      issues: result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
      message: "Citizen role input is invalid.",
    });
  }

  return result.data;
}
