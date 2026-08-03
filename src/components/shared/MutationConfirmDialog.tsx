import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import * as React from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

export type MutationSuccessNotice =
  | string
  | { readonly message: string; readonly description: string };

export type MutationConfirmDialogProps<TData, TError, TVariables, TContext> = {
  readonly onClose: () => void;
  readonly title: string;
  readonly description: string | React.ReactNode;
  readonly confirmLabel: string;
  readonly confirmVariant?: "destructive" | "default" | "outline";
  readonly cancelLabel?: string;
  readonly mutationOptions: UseMutationOptions<
    TData,
    TError,
    TVariables,
    TContext
  >;
  readonly input: TVariables;
  readonly successMessage:
    | MutationSuccessNotice
    | ((result: TData) => MutationSuccessNotice);
  readonly errorFallback: string;
};

/**
 * A ConfirmDialog wired to a TanStack mutation: confirming runs the mutation
 * with `input`, notifies success (via `successMessage`) and closes, or
 * notifies the error with `errorFallback` and stays open.
 *
 * Rendered while open; unmount it to close (the standard pattern for the
 * feature confirm dialogs).
 */
export function MutationConfirmDialog<TData, TError, TVariables, TContext>({
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant,
  cancelLabel,
  mutationOptions,
  input,
  successMessage,
  errorFallback,
}: MutationConfirmDialogProps<
  TData,
  TError,
  TVariables,
  TContext
>): React.JSX.Element {
  const mutation = useMutation(mutationOptions);

  async function handleConfirm(): Promise<void> {
    try {
      const result = await mutation.mutateAsync(input);
      const notice =
        typeof successMessage === "function"
          ? successMessage(result)
          : successMessage;
      if (typeof notice === "string") {
        notifyMutationSuccess(notice);
      } else {
        notifyMutationSuccess(notice.message, {
          description: notice.description,
        });
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, errorFallback);
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
      cancelLabel={cancelLabel}
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
