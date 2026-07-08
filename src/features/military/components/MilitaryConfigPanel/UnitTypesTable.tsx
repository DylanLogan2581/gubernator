import { type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EditUnitTypeForm } from "./EditUnitTypeForm";

import type { UnitType } from "../../types/unitTypeTypes";

export function UnitTypesTable({
  canEdit,
  queryClient,
  unitTypes,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly unitTypes: readonly UnitType[];
  readonly worldId: string;
}): JSX.Element {
  const [editingUnitType, setEditingUnitType] = useState<UnitType | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Soldiers per unit</TableHead>
              <TableHead>Desertion rate</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {unitTypes.map((unitType) => (
              <TableRow key={unitType.id}>
                <TableCell>
                  <span className="font-medium">{unitType.name}</span>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {unitType.soldiersPerUnit}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {unitType.desertionRate}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingUnitType(unitType);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingUnitType !== null ? (
        <EditUnitTypeForm
          queryClient={queryClient}
          unitType={editingUnitType}
          worldId={worldId}
          onClose={() => {
            setEditingUnitType(null);
          }}
        />
      ) : null}
    </>
  );
}
