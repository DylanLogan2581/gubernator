import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { NATION_IMAGES_BUCKET } from "../queries/nationImageQueries";
import { nationsQueryKeys } from "../queries/nationsQueryKeys";

type UploadNationFlagMutationOptions = UseMutationOptions<
  string,
  AuthUiError,
  UploadNationFlagInput
>;
type RemoveNationFlagMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  RemoveNationFlagInput
>;

export type UploadNationFlagInput = {
  readonly file: Blob;
  readonly nationId: string;
};

export type RemoveNationFlagInput = {
  readonly nationId: string;
};

export function nationFlagPath(nationId: string): string {
  return `${nationId}/flag.webp`;
}

export function uploadNationFlagMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UploadNationFlagMutationOptions {
  return mutationOptions({
    mutationFn: (input: UploadNationFlagInput) =>
      uploadNationFlag(client, input),
    mutationKey: [...nationsQueryKeys.all, "upload-nation-flag"],
    onSuccess: async (_data, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.detail(input.nationId),
      });
    },
  });
}

export function removeNationFlagMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveNationFlagMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveNationFlagInput) =>
      removeNationFlag(client, input),
    mutationKey: [...nationsQueryKeys.all, "remove-nation-flag"],
    onSuccess: async (_data, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.detail(input.nationId),
      });
    },
  });
}

async function uploadNationFlag(
  client: GubernatorSupabaseClient,
  input: UploadNationFlagInput,
): Promise<string> {
  const path = nationFlagPath(input.nationId);
  const { error: uploadError } = await client.storage
    .from(NATION_IMAGES_BUCKET)
    .upload(path, input.file, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError !== null) {
    throw normalizeSupabaseError(uploadError);
  }

  await setNationFlagPath(client, input.nationId, path);

  return path;
}

async function removeNationFlag(
  client: GubernatorSupabaseClient,
  input: RemoveNationFlagInput,
): Promise<void> {
  const path = nationFlagPath(input.nationId);
  const { error: removeError } = await client.storage
    .from(NATION_IMAGES_BUCKET)
    .remove([path]);

  if (removeError !== null) {
    throw normalizeSupabaseError(removeError);
  }

  await setNationFlagPath(client, input.nationId, null);
}

// nations_update_world_admin only grants direct UPDATE to world
// admins/super admins, so nations.flag_path (like capital_settlement_id and
// founded_turn_number) is written through a SECURITY DEFINER RPC that also
// admits the nation's own nation_manager citizen. TypeScript's generated
// types don't reflect this RPC's signature, so it's called directly on the
// client object (mirrors setNationCapitalAndFoundedTurn in
// src/features/nations/mutations/nationsMutations.ts).
async function setNationFlagPath(
  client: GubernatorSupabaseClient,
  nationId: string,
  flagPath: string | null,
): Promise<void> {
  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };

  const { error } = await clientAsRpcCapable
    .rpc("set_nation_flag_path", {
      p_flag_path: flagPath,
      p_nation_id: nationId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
