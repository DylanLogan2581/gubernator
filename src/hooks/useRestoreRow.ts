import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";

import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

export function useRestoreRow<TData, TError, TVariables>(
  mutationOptions: UseMutationOptions<TData, TError, TVariables>,
  {
    successMessage,
  }: {
    readonly successMessage: string;
  },
): UseMutationResult<TData, TError, TVariables> {
  return useMutation({
    ...mutationOptions,
    onError: (error, variables, onMutateResult, context) => {
      notifyMutationError(error, "Failed to restore.");
      return mutationOptions.onError?.(
        error,
        variables,
        onMutateResult,
        context,
      );
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      notifyMutationSuccess(successMessage);
      return mutationOptions.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context,
      );
    },
  });
}
