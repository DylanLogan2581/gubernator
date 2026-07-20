import { QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

import {
  importWorldFromTemplateMutationOptions,
  isWorldTemplateImportError,
} from "./worldTemplateMutations";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createRpcClient<TData>(result: SupabaseResult<TData>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, Error, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

const template = {} as WorldTemplate;

describe("importWorldFromTemplateMutationOptions", () => {
  it("imports a world from a template and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID, name: "Imported World" },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = importWorldFromTemplateMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      name: "  Imported World  ",
      template,
    });

    expect(result).toEqual({ id: WORLD_ID, name: "Imported World" });
    expect(rpc).toHaveBeenCalledWith("import_world_from_template", {
      p_name: "Imported World",
      p_template: template,
    });
    expect(options.mutationKey).toEqual([
      "worlds",
      "import-world-from-template",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = importWorldFromTemplateMutationOptions({
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      name: "Imported World",
      template,
    });

    await expect(result).rejects.toSatisfy(isWorldTemplateImportError);
    await expect(result).rejects.toMatchObject({
      code: "template_import_not_authorized",
    });
  });

  it("maps 22000 to an invalid-template error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "22000", message: "invalid template data" },
    });
    const queryClient = createQueryClient();
    const options = importWorldFromTemplateMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Imported World",
        template,
      }),
    ).rejects.toMatchObject({
      code: "template_import_invalid",
      message: "invalid template data",
    });
  });

  it("maps a null result to a failed error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = importWorldFromTemplateMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Imported World",
        template,
      }),
    ).rejects.toMatchObject({ code: "template_import_failed" });
  });
});
