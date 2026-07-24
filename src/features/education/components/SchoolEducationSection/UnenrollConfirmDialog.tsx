import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

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
  return (
    <MutationConfirmDialog
      onClose={onClose}
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
      mutationOptions={unenrollCitizenMutationOptions({
        queryClient,
        settlementBuildingId,
        settlementId,
      })}
      input={{ enrollmentId: enrollment.id }}
      successMessage="Citizen unenrolled."
      errorFallback="Failed to unenroll citizen."
    />
  );
}
