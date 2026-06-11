import { useCallback, useState } from "react";

import type { DepositType } from "../../../types/depositTypes";

export function useDepositTypeJobLink(
  allDepositTypes: readonly DepositType[],
  currentDepositTypeId?: string,
  initialJobId: string = "",
): {
  jobId: string;
  setJobId: (jobId: string) => void;
  jobLinkError: string | undefined;
  setJobLinkError: (error: string | undefined) => void;
  handleJobChange: (selectedJobId: string) => void;
} {
  const [jobId, setJobId] = useState(initialJobId);
  const [jobLinkError, setJobLinkError] = useState<string | undefined>(
    undefined,
  );

  const handleJobChange = useCallback(
    (selectedJobId: string): void => {
      setJobId(selectedJobId);
      const conflict = allDepositTypes.find(
        (dt) =>
          dt.jobId === selectedJobId &&
          selectedJobId !== "" &&
          (currentDepositTypeId === undefined ||
            dt.id !== currentDepositTypeId),
      );
      setJobLinkError(
        conflict !== undefined
          ? `This job is already linked to "${conflict.name}".`
          : undefined,
      );
    },
    [allDepositTypes, currentDepositTypeId],
  );

  return { jobId, setJobId, jobLinkError, setJobLinkError, handleJobChange };
}
