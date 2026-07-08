import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { citizensInSettlementQueryOptions } from "@/features/citizens";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { type TierEducationConfig } from "@/shared/education/tierEducationConfig";

import { enrollCitizenMutationOptions } from "../../mutations/educationEnrollmentMutations";
import { settlementEnrolledCitizenIdsQueryOptions } from "../../queries/educationEnrollmentsQueries";
import { educationLevelsByWorldQueryOptions } from "../../queries/educationLevelsQueries";

type EnrollCitizenDialogProps = {
  readonly educationConfig: TierEducationConfig;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementBuildingId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function EnrollCitizenDialog({
  educationConfig,
  onClose,
  queryClient,
  settlementBuildingId,
  settlementId,
  worldId,
}: EnrollCitizenDialogProps): JSX.Element {
  const citizenSelectId = useId();
  const [selectedCitizenId, setSelectedCitizenId] = useState("");

  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const levelsQuery = useQuery(educationLevelsByWorldQueryOptions(worldId));
  const enrolledIdsQuery = useQuery(
    settlementEnrolledCitizenIdsQueryOptions(settlementId),
  );

  const enrollMutation = useMutation(
    enrollCitizenMutationOptions({ queryClient, settlementId }),
  );

  const isLoading =
    citizensQuery.isPending ||
    levelsQuery.isPending ||
    enrolledIdsQuery.isPending;
  const loadError =
    citizensQuery.error ?? levelsQuery.error ?? enrolledIdsQuery.error;

  async function handleEnroll(): Promise<void> {
    if (selectedCitizenId === "") return;
    try {
      await enrollMutation.mutateAsync({
        citizenId: selectedCitizenId,
        settlementBuildingId,
      });
      notifyMutationSuccess("Citizen enrolled.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to enroll citizen.");
    }
  }

  let body: JSX.Element;
  if (isLoading) {
    body = <p className="text-sm text-muted-foreground">Loading citizens…</p>;
  } else if (loadError !== null) {
    body = (
      <p className="text-sm text-destructive">
        {getErrorDescription(loadError)}
      </p>
    );
  } else {
    const levels = levelsQuery.data ?? [];
    const rankById = new Map(levels.map((l) => [l.id, l.rank]));
    const nameById = new Map(levels.map((l) => [l.id, l.name]));
    const teachesUpToRank = rankById.get(educationConfig.teachesUpToLevelId);
    const enrolledIds = new Set(enrolledIdsQuery.data ?? []);

    type EligibilityReason = "eligible" | "enrolled-elsewhere" | "at-max-level";

    function classify(citizen: {
      readonly educationLevelId: string | null;
      readonly id: string;
      readonly status: string;
    }): EligibilityReason | "dead" {
      if (citizen.status !== "alive") return "dead";
      if (enrolledIds.has(citizen.id)) return "enrolled-elsewhere";
      const currentRank =
        citizen.educationLevelId !== null
          ? (rankById.get(citizen.educationLevelId) ?? 0)
          : 0;
      if (teachesUpToRank === undefined || currentRank >= teachesUpToRank) {
        return "at-max-level";
      }
      return "eligible";
    }

    const classified = (citizensQuery.data ?? []).map((citizen) => ({
      citizen,
      reason: classify(citizen),
    }));

    const eligible = classified
      .filter((c) => c.reason === "eligible")
      .map((c) => c.citizen);
    const enrolledElsewhereCount = classified.filter(
      (c) => c.reason === "enrolled-elsewhere",
    ).length;
    const atMaxLevelCount = classified.filter(
      (c) => c.reason === "at-max-level",
    ).length;
    const excludedCount = enrolledElsewhereCount + atMaxLevelCount;

    body = (
      <div className="grid gap-1.5">
        <Label htmlFor={citizenSelectId}>Citizen</Label>
        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible citizens in this settlement.
          </p>
        ) : (
          <NativeSelect
            className="w-full"
            id={citizenSelectId}
            value={selectedCitizenId}
            onChange={(e) => {
              setSelectedCitizenId(e.target.value);
            }}
          >
            <option value="">Select a citizen…</option>
            {eligible.map((citizen) => {
              const levelName =
                citizen.educationLevelId !== null
                  ? (nameById.get(citizen.educationLevelId) ?? "Unknown")
                  : "None";
              return (
                <option key={citizen.id} value={citizen.id}>
                  {citizen.name} ({levelName})
                </option>
              );
            })}
          </NativeSelect>
        )}
        {excludedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {excludedCount} citizen{excludedCount === 1 ? "" : "s"} not shown
            (already enrolled: {enrolledElsewhereCount}, no room to advance:{" "}
            {atMaxLevelCount}).
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll student</DialogTitle>
          <DialogDescription>
            Enroll an eligible citizen into this school.
          </DialogDescription>
        </DialogHeader>

        {body}

        <DialogFooter>
          <Button
            disabled={enrollMutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={enrollMutation.isPending || selectedCitizenId === ""}
            type="button"
            onClick={() => {
              void handleEnroll();
            }}
          >
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
