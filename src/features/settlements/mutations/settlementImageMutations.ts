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

import { SETTLEMENT_IMAGES_BUCKET } from "../queries/settlementImageQueries";
import { settlementsQueryKeys } from "../queries/settlementsQueryKeys";

type UploadSettlementImageMutationOptions = UseMutationOptions<
  string,
  AuthUiError,
  UploadSettlementImageInput
>;
type RemoveSettlementImageMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  RemoveSettlementImageInput
>;

export type UploadSettlementImageInput = {
  readonly file: Blob;
  readonly settlementId: string;
};

export type RemoveSettlementImageInput = {
  readonly settlementId: string;
};

export function settlementFlagPath(settlementId: string): string {
  return `${settlementId}/flag.webp`;
}

export function settlementSealPath(settlementId: string): string {
  return `${settlementId}/seal.webp`;
}

async function invalidateSettlement(
  queryClient: QueryClient,
  settlementId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: settlementsQueryKeys.detail(settlementId),
  });
  await queryClient.invalidateQueries({
    queryKey: settlementsQueryKeys.all,
  });
}

export function uploadSettlementFlagMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UploadSettlementImageMutationOptions {
  return mutationOptions({
    mutationFn: (input: UploadSettlementImageInput) =>
      uploadSettlementImage(client, "flag", input),
    mutationKey: [...settlementsQueryKeys.all, "upload-settlement-flag"],
    onSuccess: (_data, input) =>
      invalidateSettlement(queryClient, input.settlementId),
  });
}

export function removeSettlementFlagMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveSettlementImageMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveSettlementImageInput) =>
      removeSettlementImage(client, "flag", input),
    mutationKey: [...settlementsQueryKeys.all, "remove-settlement-flag"],
    onSuccess: (_data, input) =>
      invalidateSettlement(queryClient, input.settlementId),
  });
}

export function uploadSettlementSealMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UploadSettlementImageMutationOptions {
  return mutationOptions({
    mutationFn: (input: UploadSettlementImageInput) =>
      uploadSettlementImage(client, "seal", input),
    mutationKey: [...settlementsQueryKeys.all, "upload-settlement-seal"],
    onSuccess: (_data, input) =>
      invalidateSettlement(queryClient, input.settlementId),
  });
}

export function removeSettlementSealMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveSettlementImageMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveSettlementImageInput) =>
      removeSettlementImage(client, "seal", input),
    mutationKey: [...settlementsQueryKeys.all, "remove-settlement-seal"],
    onSuccess: (_data, input) =>
      invalidateSettlement(queryClient, input.settlementId),
  });
}

type SettlementImageKind = "flag" | "seal";

function imagePathFor(kind: SettlementImageKind, settlementId: string): string {
  return kind === "flag"
    ? settlementFlagPath(settlementId)
    : settlementSealPath(settlementId);
}

async function uploadSettlementImage(
  client: GubernatorSupabaseClient,
  kind: SettlementImageKind,
  input: UploadSettlementImageInput,
): Promise<string> {
  const path = imagePathFor(kind, input.settlementId);
  const { error: uploadError } = await client.storage
    .from(SETTLEMENT_IMAGES_BUCKET)
    .upload(path, input.file, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError !== null) {
    throw normalizeSupabaseError(uploadError);
  }

  await setSettlementImagePath(client, kind, input.settlementId, path);

  return path;
}

async function removeSettlementImage(
  client: GubernatorSupabaseClient,
  kind: SettlementImageKind,
  input: RemoveSettlementImageInput,
): Promise<void> {
  const path = imagePathFor(kind, input.settlementId);
  const { error: removeError } = await client.storage
    .from(SETTLEMENT_IMAGES_BUCKET)
    .remove([path]);

  if (removeError !== null) {
    throw normalizeSupabaseError(removeError);
  }

  await setSettlementImagePath(client, kind, input.settlementId, null);
}

// settlements_update_world_admin only grants direct UPDATE to world
// admins/super admins, so settlements.flag_path / seal_path are written
// through SECURITY DEFINER RPCs that also admit the settlement's own manager.
// The RPCs return setof settlements, so they're called via a narrow cast
// rather than the generated typed client (mirrors setNationImagePath in
// src/features/nations/mutations/nationImageMutations.ts).
async function setSettlementImagePath(
  client: GubernatorSupabaseClient,
  kind: SettlementImageKind,
  settlementId: string,
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

  const rpcName =
    kind === "flag" ? "set_settlement_flag_path" : "set_settlement_seal_path";
  const pathParam = kind === "flag" ? "p_flag_path" : "p_seal_path";

  const { error } = await clientAsRpcCapable
    .rpc(rpcName, {
      [pathParam]: imagePath,
      p_settlement_id: settlementId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
