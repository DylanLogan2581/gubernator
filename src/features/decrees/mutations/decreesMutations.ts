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

import { decreesQueryKeys } from "../queries/decreesQueryKeys";
import {
  issueDecreeInputSchema,
  revokeDecreeInputSchema,
  type IssueDecreeInput,
  type RevokeDecreeInput,
} from "../schemas/decreeSchemas";

import type { z } from "zod";

type DecreeMutationErrorCode = "decree_input_invalid";

export type DecreeMutationIssue = MutationIssue;

export const {
  ErrorClass: DecreeMutationError,
  isError: isDecreeMutationError,
} = createMutationError<DecreeMutationErrorCode>("DecreeMutationError");
export type DecreeMutationError = InstanceType<typeof DecreeMutationError>;

export type IssueDecreeMutationOptions = UseMutationOptions<
  void,
  AuthUiError | DecreeMutationError,
  IssueDecreeInput
>;

export type RevokeDecreeMutationOptions = UseMutationOptions<
  void,
  AuthUiError | DecreeMutationError,
  RevokeDecreeInput & {
    readonly nationId: string | null;
    readonly settlementId: string | null;
  }
>;

function invalidateDecreeQueries(
  queryClient: QueryClient,
  {
    nationId,
    settlementId,
  }: { nationId: string | null; settlementId: string | null },
): Promise<void> {
  return Promise.all([
    nationId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: decreesQueryKeys.nationList(nationId),
        }),
    settlementId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: decreesQueryKeys.settlementList(settlementId),
        }),
  ]).then(() => undefined);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new DecreeMutationError({
        code: "decree_input_invalid",
        issues,
        message: "Decree input is invalid.",
      }),
  );
}

export function issueDecreeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): IssueDecreeMutationOptions {
  return mutationOptions({
    mutationFn: (input: IssueDecreeInput) => issueDecree(client, input),
    mutationKey: [...decreesQueryKeys.all, "issue-decree"],
    onSuccess: (_result, input) =>
      invalidateDecreeQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

async function issueDecree(
  client: GubernatorSupabaseClient,
  input: IssueDecreeInput,
): Promise<void> {
  const values = parseInput(issueDecreeInputSchema, input);

  const { error } = await client.rpc("issue_decree", {
    p_body_markdown: values.bodyMarkdown,
    p_issued_by_citizen_id: values.issuedByCitizenId,
    p_nation_id: values.nationId as string,
    // Generated types don't reflect nullable parameters; null is valid.
    p_settlement_id: values.settlementId as string,
    p_title: values.title,
    p_world_id: values.worldId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

export function revokeDecreeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RevokeDecreeMutationOptions {
  return mutationOptions({
    mutationFn: (
      input: RevokeDecreeInput & {
        readonly nationId: string | null;
        readonly settlementId: string | null;
      },
    ) => revokeDecree(client, input),
    mutationKey: [...decreesQueryKeys.all, "revoke-decree"],
    onSuccess: (_result, input) =>
      invalidateDecreeQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

async function revokeDecree(
  client: GubernatorSupabaseClient,
  input: RevokeDecreeInput,
): Promise<void> {
  const values = parseInput(revokeDecreeInputSchema, input);

  const { error } = await client.rpc("revoke_decree", {
    p_decree_id: values.id,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
