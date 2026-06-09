import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { notifyMutationSuccess } from "@/lib/notify";

export function useSoftDeleteRow<TData, TError, TVariables>(
  mutationOptions: UseMutationOptions<TData, TError, TVariables>,
  {
    successMessage,
  }: {
    readonly successMessage: string;
  },
): UseMutationResult<TData, TError, TVariables> {
  return useMutation({
    ...mutationOptions,
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to move to trash.",
      );
    },
    onSuccess: () => {
      notifyMutationSuccess(successMessage);
    },
  });
}
