import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { removeDepositInstanceMutationOptions } from "../../mutations/removeDepositInstanceMutations";

import type { DepositInstance } from "../../types/depositInstanceTypes";

type RemoveDepositConfirmDialogProps = {
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

export function ExhaustDepositConfirmDialog({
  instance,
  onClose,
  queryClient,
}: RemoveDepositConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Exhaust ${instance.name}?`}
      description={
        <>
          This will permanently exhaust{" "}
          <span className="font-medium text-foreground">{instance.name}</span>.
          All assigned workers will be unassigned. This action cannot be undone.
        </>
      }
      confirmLabel="Exhaust"
      mutationOptions={removeDepositInstanceMutationOptions({ queryClient })}
      input={{ depositInstanceId: instance.id }}
      successMessage={`${instance.name} exhausted.`}
      errorFallback="Failed to exhaust deposit instance."
    />
  );
}
