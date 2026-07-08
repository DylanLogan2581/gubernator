import { useQuery, type QueryClient } from "@tanstack/react-query";
import { TriangleAlert, UserPlus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { settlementJobCountsQueryOptions } from "@/features/citizens";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";
import { type TierEducationConfig } from "@/shared/education/tierEducationConfig";

import { schoolEnrollmentsQueryOptions } from "../../queries/educationEnrollmentsQueries";

import { EnrollCitizenDialog } from "./EnrollCitizenDialog";
import { UnenrollConfirmDialog } from "./UnenrollConfirmDialog";

import type { SchoolEnrollment } from "../../types/educationEnrollmentTypes";

type SchoolEducationSectionProps = {
  readonly canManageSettlement: boolean;
  readonly educationConfig: TierEducationConfig;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly settlementBuildingId: string;
  readonly settlementBuildingName: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SchoolEducationSection({
  canManageSettlement,
  educationConfig,
  isArchived,
  queryClient,
  settlementBuildingId,
  settlementBuildingName,
  settlementId,
  worldId,
}: SchoolEducationSectionProps): JSX.Element {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState<SchoolEnrollment | null>(
    null,
  );

  const enrollmentsQuery = useQuery(
    schoolEnrollmentsQueryOptions(settlementBuildingId),
  );
  const jobCountsQuery = useQuery(
    settlementJobCountsQueryOptions(settlementId),
  );

  if (enrollmentsQuery.isPending) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        Loading education section…
      </p>
    );
  }

  if (enrollmentsQuery.isError) {
    return (
      <ErrorState
        title="Education section could not be loaded"
        description={getErrorDescription(enrollmentsQuery.error)}
      />
    );
  }

  const enrollments = enrollmentsQuery.data;
  const students = enrollments.length;
  const capacity = educationConfig.studentCapacity;
  const requiredTeachers =
    educationConfig.studentsPerTeacher > 0
      ? Math.ceil(students / educationConfig.studentsPerTeacher)
      : 0;
  const assignedTeachers =
    jobCountsQuery.data?.find((j) => j.jobId === educationConfig.teacherJobId)
      ?.currentCount ?? 0;
  const understaffed = assignedTeachers < requiredTeachers;
  const canEnroll = canManageSettlement && !isArchived && students < capacity;

  return (
    <div className="grid gap-3 py-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium">Education</h3>
        {canEnroll ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              setEnrollOpen(true);
            }}
          >
            <UserPlus aria-hidden="true" />
            Enroll student
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-4">
        <span className="tabular-nums">
          {students} / {capacity} students
        </span>
        <span
          className={cn(
            "flex items-center gap-1",
            understaffed && "font-medium text-amber-600 dark:text-amber-500",
          )}
        >
          {understaffed ? (
            <TriangleAlert aria-hidden="true" className="size-3.5" />
          ) : null}
          {assignedTeachers} / {requiredTeachers} teachers
          {understaffed ? <Badge variant="warning">Understaffed</Badge> : null}
        </span>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          title="No students enrolled"
          description="Enroll a citizen to start teaching them here."
        />
      ) : (
        <ul className="grid gap-2">
          {enrollments.map((enrollment) => {
            const progressPct = Math.min(
              100,
              Math.round(
                (enrollment.progressTurns / educationConfig.turnsPerLevel) *
                  100,
              ),
            );
            return (
              <li
                key={enrollment.id}
                className="flex flex-col gap-1 rounded-md border border-border p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
                  <span className="truncate font-medium">
                    {enrollment.citizenName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Studying toward {enrollment.targetLevelName}
                  </span>
                  <Progress
                    aria-label={`${enrollment.citizenName} progress toward ${enrollment.targetLevelName}`}
                    className="h-1.5"
                    value={progressPct}
                  />
                </div>
                {canManageSettlement ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUnenrollTarget(enrollment);
                    }}
                  >
                    Unenroll
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {enrollOpen ? (
        <EnrollCitizenDialog
          educationConfig={educationConfig}
          queryClient={queryClient}
          settlementBuildingId={settlementBuildingId}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setEnrollOpen(false);
          }}
        />
      ) : null}

      {unenrollTarget !== null ? (
        <UnenrollConfirmDialog
          enrollment={unenrollTarget}
          queryClient={queryClient}
          settlementBuildingId={settlementBuildingId}
          settlementBuildingName={settlementBuildingName}
          settlementId={settlementId}
          onClose={() => {
            setUnenrollTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
