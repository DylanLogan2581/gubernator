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

import { toCitizen, type CitizenRow } from "../queries/citizensQueries";
import { citizensQueryKeys } from "../queries/citizensQueryKeys";
import {
  createNpcInputSchema,
  createPlayerCharacterInputSchema,
  markCitizenDeadInputSchema,
  reviveCitizenInputSchema,
  updateCitizenCoreInputSchema,
  updateCitizenNpcFieldsInputSchema,
  type CreateNpcInput,
  type CreatePlayerCharacterInput,
  type MarkCitizenDeadInput,
  type ReviveCitizenInput,
  type UpdateCitizenCoreInput,
  type UpdateCitizenNpcFieldsInput,
} from "../schemas/citizenSchemas";

import type { Citizen } from "../types/citizenTypes";
import type { z } from "zod";

type CitizenMutationErrorCode =
  | "citizen_creation_blocked"
  | "citizen_input_invalid"
  | "citizen_not_found";

type CreateNpcMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | CitizenMutationError,
  CreateNpcInput
>;
type CreatePlayerCharacterMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | CitizenMutationError,
  CreatePlayerCharacterInput
>;
type UpdateCitizenCoreMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | CitizenMutationError,
  UpdateCitizenCoreInput
>;
type UpdateCitizenNpcFieldsMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | CitizenMutationError,
  UpdateCitizenNpcFieldsInput
>;
type MarkCitizenDeadMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | CitizenMutationError,
  MarkCitizenDeadInput
>;
type ReviveCitizenMutationOptions = UseMutationOptions<
  Citizen,
  AuthUiError | CitizenMutationError,
  ReviveCitizenInput
>;

export type CitizenMutationIssue = MutationIssue;

export const {
  ErrorClass: CitizenMutationError,
  isError: isCitizenMutationError,
} = createMutationError<CitizenMutationErrorCode>("CitizenMutationError");
export type CitizenMutationError = InstanceType<typeof CitizenMutationError>;

const CITIZEN_SELECT =
  "id,world_id,settlement_id,citizen_type,given_name,surname,name,sex,status,born_on_turn_number,parent_a_citizen_id,parent_b_citizen_id,user_id,profile_photo_url,role_type,role_nation_id,role_settlement_id,personality_text,skills_text,npc_trait_1,npc_trait_2,npc_secret_contradiction,npc_goal,npc_flaw,death_cause,created_at,updated_at";

export function createNpcMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateNpcMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateNpcInput) => createNpc(client, input),
    mutationKey: [...citizensQueryKeys.all, "create-npc"],
    onSuccess: (citizen) => invalidateAfterCitizenChange(queryClient, citizen),
  });
}

export function createPlayerCharacterMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreatePlayerCharacterMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreatePlayerCharacterInput) =>
      createPlayerCharacter(client, input),
    mutationKey: [...citizensQueryKeys.all, "create-player-character"],
    onSuccess: (citizen) => invalidateAfterCitizenChange(queryClient, citizen),
  });
}

export function updateCitizenCoreMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateCitizenCoreMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateCitizenCoreInput) =>
      updateCitizenCore(client, input),
    mutationKey: [...citizensQueryKeys.all, "update-citizen-core"],
    onSuccess: (citizen) => invalidateAfterCitizenChange(queryClient, citizen),
  });
}

export function updateCitizenNpcFieldsMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateCitizenNpcFieldsMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateCitizenNpcFieldsInput) =>
      updateCitizenNpcFields(client, input),
    mutationKey: [...citizensQueryKeys.all, "update-citizen-npc-fields"],
    onSuccess: async (citizen): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: citizensQueryKeys.detail(citizen.id),
      });
    },
  });
}

export function markCitizenDeadMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MarkCitizenDeadMutationOptions {
  return mutationOptions({
    mutationFn: (input: MarkCitizenDeadInput) => markCitizenDead(client, input),
    mutationKey: [...citizensQueryKeys.all, "mark-citizen-dead"],
    onSuccess: (citizen) => invalidateAfterCitizenChange(queryClient, citizen),
  });
}

export function reviveCitizenMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ReviveCitizenMutationOptions {
  return mutationOptions({
    mutationFn: (input: ReviveCitizenInput) => reviveCitizen(client, input),
    mutationKey: [...citizensQueryKeys.all, "revive-citizen"],
    onSuccess: (citizen) => invalidateAfterCitizenChange(queryClient, citizen),
  });
}

async function invalidateAfterCitizenChange(
  queryClient: QueryClient,
  citizen: Citizen,
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.detail(citizen.id),
    }),
  ];

  if (citizen.settlementId !== null) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: citizensQueryKeys.settlementList(citizen.settlementId),
      }),
      queryClient.invalidateQueries({
        queryKey: citizensQueryKeys.settlementAggregateStats(
          citizen.settlementId,
        ),
      }),
    );
  }

  await Promise.all(invalidations);
}

async function createNpc(
  client: GubernatorSupabaseClient,
  input: CreateNpcInput,
): Promise<Citizen> {
  const values = parseInput(createNpcInputSchema, input);

  const { data, error } = await client
    .rpc("create_npc", {
      p_born_on_turn_number: values.bornOnTurnNumber ?? undefined,
      p_given_name: values.givenName.trim(),
      p_surname: values.surname ?? undefined,
      p_npc_flaw: values.npcFlaw ?? undefined,
      p_npc_goal: values.npcGoal ?? undefined,
      p_npc_secret_contradiction: values.npcSecretContradiction ?? undefined,
      p_npc_trait_1: values.npcTrait1 ?? undefined,
      p_npc_trait_2: values.npcTrait2 ?? undefined,
      p_parent_a_citizen_id: values.parentACitizenId ?? undefined,
      p_parent_b_citizen_id: values.parentBCitizenId ?? undefined,
      p_personality_text: values.personalityText ?? undefined,
      p_profile_photo_url: values.profilePhotoUrl ?? undefined,
      p_settlement_id: values.settlementId ?? undefined,
      p_sex: values.sex ?? undefined,
      p_skills_text: values.skillsText ?? undefined,
      p_world_id: values.worldId,
    })
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw creationBlockedError("NPC");
  }

  return toCitizen(data);
}

async function createPlayerCharacter(
  client: GubernatorSupabaseClient,
  input: CreatePlayerCharacterInput,
): Promise<Citizen> {
  const values = parseInput(createPlayerCharacterInputSchema, input);

  const { data, error } = await client
    .rpc("create_player_character", {
      p_born_on_turn_number: values.bornOnTurnNumber ?? undefined,
      p_given_name: values.givenName.trim(),
      p_surname: values.surname ?? undefined,
      p_parent_a_citizen_id: values.parentACitizenId ?? undefined,
      p_parent_b_citizen_id: values.parentBCitizenId ?? undefined,
      p_personality_text: values.personalityText ?? undefined,
      p_profile_photo_url: values.profilePhotoUrl ?? undefined,
      p_settlement_id: values.settlementId ?? undefined,
      p_sex: values.sex ?? undefined,
      p_skills_text: values.skillsText ?? undefined,
      p_user_id: values.userId,
      p_world_id: values.worldId,
    })
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw creationBlockedError("Player character");
  }

  return toCitizen(data);
}

async function updateCitizenCore(
  client: GubernatorSupabaseClient,
  input: UpdateCitizenCoreInput,
): Promise<Citizen> {
  const values = parseInput(updateCitizenCoreInputSchema, input);

  const { data, error } = await client
    .from("citizens")
    .update({
      given_name: values.givenName.trim(),
      surname: values.surname,
      sex: values.sex,
    })
    .eq("id", values.citizenId)
    .eq("world_id", values.worldId)
    .select(CITIZEN_SELECT)
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CitizenMutationError({
      code: "citizen_not_found",
      message: "Citizen could not be updated.",
    });
  }

  return toCitizen(data);
}

async function updateCitizenNpcFields(
  client: GubernatorSupabaseClient,
  input: UpdateCitizenNpcFieldsInput,
): Promise<Citizen> {
  const values = parseInput(updateCitizenNpcFieldsInputSchema, input);

  const { data, error } = await client
    .from("citizens")
    .update({
      npc_flaw: values.npcFlaw,
      npc_goal: values.npcGoal,
      npc_secret_contradiction: values.npcSecretContradiction,
      npc_trait_1: values.npcTrait1,
      npc_trait_2: values.npcTrait2,
      personality_text: values.personalityText,
      skills_text: values.skillsText,
    })
    .eq("id", values.citizenId)
    .eq("world_id", values.worldId)
    .select(CITIZEN_SELECT)
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CitizenMutationError({
      code: "citizen_not_found",
      message: "Citizen NPC fields could not be updated.",
    });
  }

  return toCitizen(data);
}

async function markCitizenDead(
  client: GubernatorSupabaseClient,
  input: MarkCitizenDeadInput,
): Promise<Citizen> {
  const values = parseInput(markCitizenDeadInputSchema, input);

  const { data, error } = await client
    .from("citizens")
    .update({
      death_cause: values.deathCause,
      status: "dead",
    })
    .eq("id", values.citizenId)
    .eq("world_id", values.worldId)
    .select(CITIZEN_SELECT)
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CitizenMutationError({
      code: "citizen_not_found",
      message: "Citizen could not be marked dead.",
    });
  }

  return toCitizen(data);
}

async function reviveCitizen(
  client: GubernatorSupabaseClient,
  input: ReviveCitizenInput,
): Promise<Citizen> {
  const values = parseInput(reviveCitizenInputSchema, input);

  const { data, error } = await client
    .from("citizens")
    .update({
      death_cause: null,
      status: "alive",
    })
    .eq("id", values.citizenId)
    .eq("world_id", values.worldId)
    .select(CITIZEN_SELECT)
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CitizenMutationError({
      code: "citizen_not_found",
      message: "Citizen could not be revived.",
    });
  }

  return toCitizen(data);
}

function creationBlockedError(subject: string): CitizenMutationError {
  // The create_npc and create_player_character RPCs return zero rows for any
  // server-side guard violation (admin check, archived world, missing user,
  // mismatched worlds, or an incest-prevention block). The RPC cannot
  // distinguish these from the wire, so the dialog layer is responsible for
  // pre-validating with citizensHaveCloseKinship and surfacing a more
  // specific message when it knows the reason.
  return new CitizenMutationError({
    code: "citizen_creation_blocked",
    message: `${subject} could not be created. Verify the world is active, the parents are not closely related, and you have admin access.`,
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
      new CitizenMutationError({
        code: "citizen_input_invalid",
        issues,
        message: "Citizen input is invalid.",
      }),
  );
}
