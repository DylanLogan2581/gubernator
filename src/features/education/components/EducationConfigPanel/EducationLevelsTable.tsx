import { useMutation, type QueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { reorderEducationLevelMutationOptions } from "../../mutations/educationLevelsMutations";

import { EditEducationLevelForm } from "./EditEducationLevelForm";

import type { EducationLevel } from "../../types/educationLevelTypes";

type EducationLevelsTableProps = {
  readonly canEdit: boolean;
  readonly educationLevels: readonly EducationLevel[];
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

// Simple full-list table (no pagination/trash): education levels are a
// small, admin-curated ladder per world, ordered by rank.
export function EducationLevelsTable({
  canEdit,
  educationLevels,
  queryClient,
  worldId,
}: EducationLevelsTableProps): JSX.Element {
  const [editingEducationLevel, setEditingEducationLevel] =
    useState<EducationLevel | null>(null);
  const reorderMutation = useMutation(
    reorderEducationLevelMutationOptions({ queryClient }),
  );

  async function handleMove(
    educationLevel: EducationLevel,
    direction: "up" | "down",
  ): Promise<void> {
    try {
      await reorderMutation.mutateAsync({
        direction,
        educationLevelId: educationLevel.id,
        worldId,
      });
    } catch (error) {
      handleCrudError(error, "Failed to reorder education level.");
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Natural born %</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {educationLevels.map((educationLevel, index) => (
              <TableRow key={educationLevel.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {educationLevel.rank}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{educationLevel.name}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {educationLevel.description ?? ""}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {educationLevel.naturalBornPercent}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        aria-label={`Move ${educationLevel.name} up`}
                        disabled={index === 0 || reorderMutation.isPending}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void handleMove(educationLevel, "up");
                        }}
                      >
                        <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`Move ${educationLevel.name} down`}
                        disabled={
                          index === educationLevels.length - 1 ||
                          reorderMutation.isPending
                        }
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void handleMove(educationLevel, "down");
                        }}
                      >
                        <ChevronDown aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingEducationLevel(educationLevel);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingEducationLevel !== null ? (
        <EditEducationLevelForm
          educationLevel={editingEducationLevel}
          otherLevelsNaturalBornPercentTotal={educationLevels.reduce(
            (total, level) =>
              level.id === editingEducationLevel.id
                ? total
                : total + level.naturalBornPercent,
            0,
          )}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingEducationLevel(null);
          }}
        />
      ) : null}
    </>
  );
}
