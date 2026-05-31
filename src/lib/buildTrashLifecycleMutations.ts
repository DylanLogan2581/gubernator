import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

export function buildTrashLifecycleMutations<
  TEntity extends { readonly id: string; readonly worldId: string },
  TCreateInput,
  TUpdateInput,
  TSoftDeleteInput,
  TSoftDeleteResult extends { readonly worldId: string },
  TRestoreInput,
  TRestoreResult extends { readonly worldId: string },
  THardDeleteInput,
  THardDeleteResult extends { readonly worldId: string },
>(config: {
  readonly queryKeys: {
    readonly all: readonly unknown[];
    readonly byWorld: (worldId: string) => readonly unknown[];
    readonly activeByWorld?: (worldId: string) => readonly unknown[];
    readonly detail?: (id: string) => readonly unknown[];
  };
  readonly actionNames: {
    readonly create: string;
    readonly update: string;
    readonly softDelete: string;
    readonly restore: string;
    readonly hardDelete: string;
  };
  readonly mutationFns: {
    readonly create: (
      client: GubernatorSupabaseClient,
      input: TCreateInput,
    ) => Promise<TEntity>;
    readonly update: (
      client: GubernatorSupabaseClient,
      input: TUpdateInput,
    ) => Promise<TEntity>;
    readonly softDelete: (
      client: GubernatorSupabaseClient,
      input: TSoftDeleteInput,
    ) => Promise<TSoftDeleteResult>;
    readonly restore: (
      client: GubernatorSupabaseClient,
      input: TRestoreInput,
    ) => Promise<TRestoreResult>;
    readonly hardDelete: (
      client: GubernatorSupabaseClient,
      input: THardDeleteInput,
    ) => Promise<THardDeleteResult>;
  };
  readonly getDetailId?: {
    readonly softDelete?: (result: TSoftDeleteResult) => string;
    readonly restore?: (result: TRestoreResult) => string;
  };
  readonly extraOnSuccess?: {
    readonly create?: (
      queryClient: QueryClient,
      entity: TEntity,
    ) => Promise<void>;
    readonly update?: (
      queryClient: QueryClient,
      entity: TEntity,
    ) => Promise<void>;
  };
}): {
  readonly create: (
    opts: MutationFactoryOpts,
  ) => UseMutationOptions<TEntity, Error, TCreateInput>;
  readonly update: (
    opts: MutationFactoryOpts,
  ) => UseMutationOptions<TEntity, Error, TUpdateInput>;
  readonly softDelete: (
    opts: MutationFactoryOpts,
  ) => UseMutationOptions<TSoftDeleteResult, Error, TSoftDeleteInput>;
  readonly restore: (
    opts: MutationFactoryOpts,
  ) => UseMutationOptions<TRestoreResult, Error, TRestoreInput>;
  readonly hardDelete: (
    opts: MutationFactoryOpts,
  ) => UseMutationOptions<THardDeleteResult, Error, THardDeleteInput>;
} {
  const { queryKeys, actionNames, mutationFns, getDetailId, extraOnSuccess } =
    config;

  return {
    create: ({ client = requireSupabaseClient(), queryClient }) =>
      mutationOptions({
        mutationFn: (input: TCreateInput) => mutationFns.create(client, input),
        mutationKey: [...queryKeys.all, actionNames.create],
        onSuccess: async (entity): Promise<void> => {
          const tasks: Array<Promise<unknown>> = [
            queryClient.invalidateQueries({
              queryKey: queryKeys.byWorld(entity.worldId),
            }),
          ];
          if (queryKeys.activeByWorld !== undefined) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.activeByWorld(entity.worldId),
              }),
            );
          }
          if (extraOnSuccess?.create !== undefined) {
            tasks.push(extraOnSuccess.create(queryClient, entity));
          }
          await Promise.all(tasks);
        },
      }),

    update: ({ client = requireSupabaseClient(), queryClient }) =>
      mutationOptions({
        mutationFn: (input: TUpdateInput) => mutationFns.update(client, input),
        mutationKey: [...queryKeys.all, actionNames.update],
        onSuccess: async (entity): Promise<void> => {
          const tasks: Array<Promise<unknown>> = [
            queryClient.invalidateQueries({
              queryKey: queryKeys.byWorld(entity.worldId),
            }),
          ];
          if (queryKeys.activeByWorld !== undefined) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.activeByWorld(entity.worldId),
              }),
            );
          }
          if (queryKeys.detail !== undefined) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.detail(entity.id),
              }),
            );
          }
          if (extraOnSuccess?.update !== undefined) {
            tasks.push(extraOnSuccess.update(queryClient, entity));
          }
          await Promise.all(tasks);
        },
      }),

    softDelete: ({ client = requireSupabaseClient(), queryClient }) =>
      mutationOptions({
        mutationFn: (input: TSoftDeleteInput) =>
          mutationFns.softDelete(client, input),
        mutationKey: [...queryKeys.all, actionNames.softDelete],
        onSuccess: async (result): Promise<void> => {
          const tasks: Array<Promise<unknown>> = [
            queryClient.invalidateQueries({
              queryKey: queryKeys.byWorld(result.worldId),
            }),
          ];
          if (queryKeys.activeByWorld !== undefined) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.activeByWorld(result.worldId),
              }),
            );
          }
          if (
            queryKeys.detail !== undefined &&
            getDetailId?.softDelete !== undefined
          ) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.detail(getDetailId.softDelete(result)),
              }),
            );
          }
          await Promise.all(tasks);
        },
      }),

    restore: ({ client = requireSupabaseClient(), queryClient }) =>
      mutationOptions({
        mutationFn: (input: TRestoreInput) =>
          mutationFns.restore(client, input),
        mutationKey: [...queryKeys.all, actionNames.restore],
        onSuccess: async (result): Promise<void> => {
          const tasks: Array<Promise<unknown>> = [
            queryClient.invalidateQueries({
              queryKey: queryKeys.byWorld(result.worldId),
            }),
          ];
          if (queryKeys.activeByWorld !== undefined) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.activeByWorld(result.worldId),
              }),
            );
          }
          if (
            queryKeys.detail !== undefined &&
            getDetailId?.restore !== undefined
          ) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.detail(getDetailId.restore(result)),
              }),
            );
          }
          await Promise.all(tasks);
        },
      }),

    hardDelete: ({ client = requireSupabaseClient(), queryClient }) =>
      mutationOptions({
        mutationFn: (input: THardDeleteInput) =>
          mutationFns.hardDelete(client, input),
        mutationKey: [...queryKeys.all, actionNames.hardDelete],
        onSuccess: async (result): Promise<void> => {
          const tasks: Array<Promise<unknown>> = [
            queryClient.invalidateQueries({
              queryKey: queryKeys.byWorld(result.worldId),
            }),
          ];
          if (queryKeys.activeByWorld !== undefined) {
            tasks.push(
              queryClient.invalidateQueries({
                queryKey: queryKeys.activeByWorld(result.worldId),
              }),
            );
          }
          await Promise.all(tasks);
        },
      }),
  };
}
