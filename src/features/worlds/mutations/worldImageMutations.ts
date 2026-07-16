import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { toWorldAccessTarget } from "@/features/permissions";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { WORLD_IMAGES_BUCKET } from "../queries/worldImageQueries";
import { worldQueryKeys } from "../queries/worldQueryKeys";

import type { WorldPermissionContext } from "../types/worldTypes";

export type WorldImageKind = "hero" | "thumbnail";

type WorldImageErrorCode = "world_image_archived" | "world_image_unauthorized";
type UploadWorldImageMutationOptions = UseMutationOptions<
  string,
  AuthUiError | WorldImageError,
  UploadWorldImageInput
>;
type RemoveWorldImageMutationOptions = UseMutationOptions<
  void,
  AuthUiError | WorldImageError,
  RemoveWorldImageInput
>;

export type UploadWorldImageInput = {
  readonly file: Blob;
  readonly kind: WorldImageKind;
  readonly worldId: string;
};

export type RemoveWorldImageInput = {
  readonly kind: WorldImageKind;
  readonly worldId: string;
};

const WORLD_IMAGE_ACCESS_SELECT = "archived_at,id,status";
const WORLD_IMAGE_PATH_COLUMN: Record<
  WorldImageKind,
  "hero_path" | "thumbnail_path"
> = {
  hero: "hero_path",
  thumbnail: "thumbnail_path",
};

export class WorldImageError extends Error {
  readonly code: WorldImageErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: WorldImageErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "WorldImageError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function isWorldImageError(error: unknown): error is WorldImageError {
  return error instanceof WorldImageError;
}

export function worldImagePath(worldId: string, kind: WorldImageKind): string {
  return `${worldId}/${kind}.webp`;
}

export function uploadWorldImageMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UploadWorldImageMutationOptions {
  return mutationOptions({
    mutationFn: (input: UploadWorldImageInput) =>
      uploadWorldImage(client, accessContext, input),
    mutationKey: [...worldQueryKeys.all, "upload-world-image"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  });
}

export function removeWorldImageMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveWorldImageMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveWorldImageInput) =>
      removeWorldImage(client, accessContext, input),
    mutationKey: [...worldQueryKeys.all, "remove-world-image"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  });
}

async function uploadWorldImage(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: UploadWorldImageInput,
): Promise<string> {
  await assertCanEditWorldImages(client, accessContext, input.worldId);

  const path = worldImagePath(input.worldId, input.kind);
  const { error: uploadError } = await client.storage
    .from(WORLD_IMAGES_BUCKET)
    .upload(path, input.file, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError !== null) {
    throw normalizeSupabaseError(uploadError);
  }

  const column = WORLD_IMAGE_PATH_COLUMN[input.kind];
  const { error: updateError } = await client
    .from("worlds")
    .update({ [column]: path })
    .eq("id", input.worldId)
    .eq("status", "active");

  if (updateError !== null) {
    throw normalizeSupabaseError(updateError);
  }

  return path;
}

async function removeWorldImage(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: RemoveWorldImageInput,
): Promise<void> {
  await assertCanEditWorldImages(client, accessContext, input.worldId);

  const path = worldImagePath(input.worldId, input.kind);
  const { error: removeError } = await client.storage
    .from(WORLD_IMAGES_BUCKET)
    .remove([path]);

  if (removeError !== null) {
    throw normalizeSupabaseError(removeError);
  }

  const column = WORLD_IMAGE_PATH_COLUMN[input.kind];
  const { error: updateError } = await client
    .from("worlds")
    .update({ [column]: null })
    .eq("id", input.worldId)
    .eq("status", "active");

  if (updateError !== null) {
    throw normalizeSupabaseError(updateError);
  }
}

async function assertCanEditWorldImages(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  worldId: string,
): Promise<void> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_IMAGE_ACCESS_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (
    data === null ||
    !accessContext.canAdminWorld(toWorldAccessTarget(data))
  ) {
    throw new WorldImageError({
      code: "world_image_unauthorized",
      message: "You do not have permission to update this world's images.",
      worldId,
    });
  }

  if (data.status === "archived" || data.archived_at !== null) {
    throw new WorldImageError({
      code: "world_image_archived",
      message: "Archived worlds are read-only.",
      worldId,
    });
  }
}
