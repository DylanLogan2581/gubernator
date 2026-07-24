import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { hardDeleteDepositInstanceMutationOptions } from "../../mutations/hardDeleteDepositInstanceMutations";

import type { DepositInstance } from "../../types/depositInstanceTypes";

type HardDeleteDepositConfirmDialogProps = {
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

export function HardDeleteDepositConfirmDialog({
  instance,
  onClose,
  queryClient,
}: HardDeleteDepositConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Permanently delete ${instance.name}?`}
      description={
        <>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          and all its data. This action cannot be undone.
        </>
      }
      confirmLabel="Delete permanently"
      mutationOptions={hardDeleteDepositInstanceMutationOptions({
        queryClient,
      })}
      input={{ depositInstanceId: instance.id }}
      successMessage={`${instance.name} permanently deleted.`}
      errorFallback="Failed to permanently delete deposit instance."
    />
  );
}
