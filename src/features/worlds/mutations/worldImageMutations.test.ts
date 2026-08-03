import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import { createAccessContext } from "@/features/permissions";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isWorldImageError,
  removeWorldImageMutationOptions,
  uploadWorldImageMutationOptions,
  worldImagePath,
} from "./worldImageMutations";

import type { WorldPermissionContext } from "../types/worldTypes";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_USER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";

type AccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly status: string;
};

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createAccessRow(overrides: Partial<AccessRow> = {}): AccessRow {
  return {
    archived_at: null,
    id: WORLD_ID,
    status: "active",
    ...overrides,
  };
}

function createClient({
  readResult = { data: createAccessRow(), error: null },
  uploadResult = { error: null },
  removeResult = { error: null },
  updateResult = { error: null },
}: {
  readonly readResult?: SupabaseResult<AccessRow>;
  readonly uploadResult?: { readonly error: SupabaseError | null };
  readonly removeResult?: { readonly error: SupabaseError | null };
  readonly updateResult?: { readonly error: SupabaseError | null };
} = {}): {
  readonly client: GubernatorSupabaseClient;
  readonly from: ReturnType<typeof vi.fn>;
  readonly readSelect: ReturnType<typeof vi.fn>;
  readonly storageFrom: ReturnType<typeof vi.fn>;
  readonly upload: ReturnType<typeof vi.fn>;
  readonly remove: ReturnType<typeof vi.fn>;
  readonly updateUpdate: ReturnType<typeof vi.fn>;
  readonly updateEqId: ReturnType<typeof vi.fn>;
  readonly updateEqStatus: ReturnType<typeof vi.fn>;
} {
  const readMaybeSingle = vi.fn().mockResolvedValue(readResult);
  const readEqId = vi.fn(() => ({ maybeSingle: readMaybeSingle }));
  const readSelect = vi.fn(() => ({ eq: readEqId }));

  const updateEqStatus = vi.fn().mockResolvedValue(updateResult);
  const updateEqId = vi.fn(() => ({ eq: updateEqStatus }));
  const updateUpdate = vi.fn(() => ({ eq: updateEqId }));

  const from = vi.fn(() => ({ select: readSelect, update: updateUpdate }));

  const upload = vi.fn().mockResolvedValue(uploadResult);
  const remove = vi.fn().mockResolvedValue(removeResult);
  const storageFrom = vi.fn(() => ({ upload, remove }));

  return {
    client: {
      from,
      storage: { from: storageFrom },
    } as unknown as GubernatorSupabaseClient,
    from,
    readSelect,
    storageFrom,
    upload,
    remove,
    updateUpdate,
    updateEqId,
    updateEqStatus,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createOwnerAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: ADMIN_USER_ID,
    worldAdminWorldIds: [WORLD_ID],
  });
}

function createNonAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: OTHER_USER_ID,
    worldAdminWorldIds: [],
  });
}

type UploadOptions = ReturnType<typeof uploadWorldImageMutationOptions>;
type RemoveOptions = ReturnType<typeof removeWorldImageMutationOptions>;

function executeUpload(
  queryClient: QueryClient,
  options: UploadOptions,
  variables: Parameters<NonNullable<UploadOptions["mutationFn"]>>[0],
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function executeRemove(
  queryClient: QueryClient,
  options: RemoveOptions,
  variables: Parameters<NonNullable<RemoveOptions["mutationFn"]>>[0],
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

const file = new Blob(["fake-image"], { type: "image/webp" });

describe("uploadWorldImageMutationOptions", () => {
  it("uploads the file, updates the world row, and invalidates the worlds query root", async () => {
    const {
      client,
      storageFrom,
      upload,
      updateUpdate,
      updateEqId,
      updateEqStatus,
    } = createClient();
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = uploadWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    const result = await executeUpload(queryClient, options, {
      file,
      kind: "hero",
      worldId: WORLD_ID,
    });

    expect(result).toBe(worldImagePath(WORLD_ID, "hero"));
    expect(storageFrom).toHaveBeenCalledWith("world-images");
    expect(upload).toHaveBeenCalledWith(
      worldImagePath(WORLD_ID, "hero"),
      file,
      { contentType: "image/webp", upsert: true },
    );
    expect(updateUpdate).toHaveBeenCalledWith({
      hero_path: worldImagePath(WORLD_ID, "hero"),
    });
    expect(updateEqId).toHaveBeenCalledWith("id", WORLD_ID);
    expect(updateEqStatus).toHaveBeenCalledWith("status", "active");
    expect(options.mutationKey).toEqual(["worlds", "upload-world-image"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("uploads a thumbnail to the thumbnail column", async () => {
    const { client, updateUpdate } = createClient();
    const queryClient = createQueryClient();
    const options = uploadWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await executeUpload(queryClient, options, {
      file,
      kind: "thumbnail",
      worldId: WORLD_ID,
    });

    expect(updateUpdate).toHaveBeenCalledWith({
      thumbnail_path: worldImagePath(WORLD_ID, "thumbnail"),
    });
  });

  it("rejects and does not upload when canAdminWorld is false", async () => {
    const { client, upload } = createClient();
    const queryClient = createQueryClient();
    const options = uploadWorldImageMutationOptions({
      accessContext: createNonAdminAccessContext(),
      client,
      queryClient,
    });

    const result = executeUpload(queryClient, options, {
      file,
      kind: "hero",
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isWorldImageError);
    await expect(result).rejects.toMatchObject({
      code: "world_image_unauthorized",
      worldId: WORLD_ID,
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects and does not upload when the world is archived", async () => {
    const { client, upload } = createClient({
      readResult: {
        data: createAccessRow({ status: "archived" }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = uploadWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeUpload(queryClient, options, {
        file,
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_image_archived",
      worldId: WORLD_ID,
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("normalizes a storage upload error", async () => {
    const { client } = createClient({
      uploadResult: { error: { message: "storage failure" } },
    });
    const queryClient = createQueryClient();
    const options = uploadWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeUpload(queryClient, options, {
        file,
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("normalizes a DB update error", async () => {
    const { client } = createClient({
      updateResult: { error: { code: "42501", message: "permission denied" } },
    });
    const queryClient = createQueryClient();
    const options = uploadWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeUpload(queryClient, options, {
        file,
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("removeWorldImageMutationOptions", () => {
  it("removes the file, clears the world row, and invalidates the worlds query root", async () => {
    const {
      client,
      storageFrom,
      remove,
      updateUpdate,
      updateEqId,
      updateEqStatus,
    } = createClient();
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = removeWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await executeRemove(queryClient, options, {
      kind: "hero",
      worldId: WORLD_ID,
    });

    expect(storageFrom).toHaveBeenCalledWith("world-images");
    expect(remove).toHaveBeenCalledWith([worldImagePath(WORLD_ID, "hero")]);
    expect(updateUpdate).toHaveBeenCalledWith({ hero_path: null });
    expect(updateEqId).toHaveBeenCalledWith("id", WORLD_ID);
    expect(updateEqStatus).toHaveBeenCalledWith("status", "active");
    expect(options.mutationKey).toEqual(["worlds", "remove-world-image"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("rejects and does not remove when canAdminWorld is false", async () => {
    const { client, remove } = createClient();
    const queryClient = createQueryClient();
    const options = removeWorldImageMutationOptions({
      accessContext: createNonAdminAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeRemove(queryClient, options, {
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_image_unauthorized",
      worldId: WORLD_ID,
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("rejects and does not remove when the world is archived", async () => {
    const { client, remove } = createClient({
      readResult: {
        data: createAccessRow({ archived_at: "2026-01-01T00:00:00.000Z" }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = removeWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeRemove(queryClient, options, {
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_image_archived",
      worldId: WORLD_ID,
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("normalizes a storage remove error", async () => {
    const { client } = createClient({
      removeResult: { error: { message: "storage failure" } },
    });
    const queryClient = createQueryClient();
    const options = removeWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeRemove(queryClient, options, {
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("normalizes a DB update error", async () => {
    const { client } = createClient({
      updateResult: { error: { code: "42501", message: "permission denied" } },
    });
    const queryClient = createQueryClient();
    const options = removeWorldImageMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeRemove(queryClient, options, {
        kind: "hero",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});
