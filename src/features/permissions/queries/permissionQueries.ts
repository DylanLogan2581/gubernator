import {
  queryOptions,
  type QueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { currentAppUserQueryOptions, type AuthUiError } from "@/features/auth";
import { currentUserAdminWorldIdsQueryOptions } from "@/features/worlds";

import { createAccessContext } from "../utils/accessContext";

import { permissionQueryKeys } from "./permissionQueryKeys";

import type { AccessContext } from "../types/accessContextTypes";

type CurrentAccessContextQueryKey = ReturnType<
  typeof permissionQueryKeys.currentAccessContext
>;
type CurrentAccessContextQueryOptions = UseQueryOptions<
  AccessContext,
  AuthUiError,
  AccessContext,
  CurrentAccessContextQueryKey
>;

export function currentAccessContextQueryOptions(
  queryClient: QueryClient,
): CurrentAccessContextQueryOptions {
  // The QueryClient is the app singleton in app code; tests inject an isolated client.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCurrentAccessContext(queryClient),
    queryKey: permissionQueryKeys.currentAccessContext(),
  });
}

async function getCurrentAccessContext(
  queryClient: QueryClient,
): Promise<AccessContext> {
  const currentUser = await queryClient.fetchQuery(
    currentAppUserQueryOptions(),
  );

  if (currentUser === null) {
    return createAccessContext({
      isSuperAdmin: false,
      userId: null,
      worldAdminWorldIds: [],
    });
  }

  const worldAdminWorldIds = await queryClient.fetchQuery(
    currentUserAdminWorldIdsQueryOptions(currentUser.id),
  );

  return createAccessContext({
    isSuperAdmin: currentUser.is_super_admin,
    userId: currentUser.id,
    worldAdminWorldIds,
  });
}
