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

export function nationSealPath(nationId: string): string {
  return `${nationId}/seal.webp`;
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

export function uploadNationSealMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UploadNationFlagMutationOptions {
  return mutationOptions({
    mutationFn: (input: UploadNationFlagInput) =>
      uploadNationSeal(client, input),
    mutationKey: [...nationsQueryKeys.all, "upload-nation-seal"],
    onSuccess: async (_data, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.detail(input.nationId),
      });
    },
  });
}

export function removeNationSealMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveNationFlagMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveNationFlagInput) =>
      removeNationSeal(client, input),
    mutationKey: [...nationsQueryKeys.all, "remove-nation-seal"],
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

  await setNationImagePath(
    client,
    "set_nation_flag_path",
    input.nationId,
    path,
  );

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

  await setNationImagePath(
    client,
    "set_nation_flag_path",
    input.nationId,
    null,
  );
}

async function uploadNationSeal(
  client: GubernatorSupabaseClient,
  input: UploadNationFlagInput,
): Promise<string> {
  const path = nationSealPath(input.nationId);
  const { error: uploadError } = await client.storage
    .from(NATION_IMAGES_BUCKET)
    .upload(path, input.file, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError !== null) {
    throw normalizeSupabaseError(uploadError);
  }

  await setNationImagePath(
    client,
    "set_nation_seal_path",
    input.nationId,
    path,
  );

  return path;
}

async function removeNationSeal(
  client: GubernatorSupabaseClient,
  input: RemoveNationFlagInput,
): Promise<void> {
  const path = nationSealPath(input.nationId);
  const { error: removeError } = await client.storage
    .from(NATION_IMAGES_BUCKET)
    .remove([path]);

  if (removeError !== null) {
    throw normalizeSupabaseError(removeError);
  }

  await setNationImagePath(
    client,
    "set_nation_seal_path",
    input.nationId,
    null,
  );
}

// nations_update_world_admin only grants direct UPDATE to world
// admins/super admins, so nations.flag_path / seal_path (like
// capital_settlement_id and founded_turn_number) are written through
// SECURITY DEFINER RPCs that also admit the nation's own nation_manager
// citizen. The RPC returns setof nations, so it's called via a narrow cast
// rather than the generated typed client (mirrors setNationCapitalAndFoundedTurn
// in src/features/nations/mutations/nationsMutations.ts). Both RPCs share the
// p_nation_id parameter and a single path parameter; the caller passes the
// matching parameter name.
async function setNationImagePath(
  client: GubernatorSupabaseClient,
  rpcName: "set_nation_flag_path" | "set_nation_seal_path",
  nationId: string,
  imagePath: string | null,
): Promise<void> {
  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };

  const pathParam =
    rpcName === "set_nation_flag_path" ? "p_flag_path" : "p_seal_path";

  const { error } = await clientAsRpcCapable
    .rpc(rpcName, {
      [pathParam]: imagePath,
      p_nation_id: nationId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
