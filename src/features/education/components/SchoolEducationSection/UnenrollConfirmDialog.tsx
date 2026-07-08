import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { unenrollCitizenMutationOptions } from "../../mutations/educationEnrollmentMutations";

import type { SchoolEnrollment } from "../../types/educationEnrollmentTypes";

type UnenrollConfirmDialogProps = {
  readonly enrollment: SchoolEnrollment;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementBuildingId: string;
  readonly settlementBuildingName: string;
  readonly settlementId: string;
};

export function UnenrollConfirmDialog({
  enrollment,
  onClose,
  queryClient,
  settlementBuildingId,
  settlementBuildingName,
  settlementId,
}: UnenrollConfirmDialogProps): JSX.Element {
  const unenrollMutation = useMutation(
    unenrollCitizenMutationOptions({
      queryClient,
      settlementBuildingId,
      settlementId,
    }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await unenrollMutation.mutateAsync({ enrollmentId: enrollment.id });
      notifyMutationSuccess("Citizen unenrolled.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to unenroll citizen.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Unenroll ${enrollment.citizenName}?`}
      description={
        <>
          This will remove{" "}
          <span className="font-medium text-foreground">
            {enrollment.citizenName}
          </span>{" "}
          from {settlementBuildingName}. All progress toward{" "}
          {enrollment.targetLevelName} is lost and cannot be undone.
        </>
      }
      confirmLabel="Unenroll"
      isPending={unenrollMutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
