import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useState, type JSX } from "react";

import { ConfigCrudPanel } from "@/components/shared/ConfigCrudPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { namesetsByWorldQueryOptions } from "../../queries/namesetsQueries";

import { NamesetsTable } from "./NamesetsTable";

import type { Nameset } from "../../types/namesetTypes";

type NamesetsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function NamesetsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: NamesetsConfigPanelProps): JSX.Element {
  const namesetsQuery = useQuery(namesetsByWorldQueryOptions(worldId));
  const canEdit = canAdmin && !isArchived;
  const [search, setSearch] = useState("");

  return (
    <ConfigCrudPanel<Nameset>
      addButtonLabel="Add nameset"
      allData={namesetsQuery}
      canEdit={canEdit}
      emptyTitle="No namesets yet"
      emptyDescription="Add the first nameset for this world."
      headerTitle="Namesets"
      isTrashed={(ns) => ns.isTrashed}
      renderContent={({
        canEdit: canEditProp,
        items,
        queryClient: qc,
        showForm,
        showTrash,
      }) => {
        const filteredItems = items.filter((ns) =>
          ns.name.toLowerCase().includes(search.trim().toLowerCase()),
        );

        return (
          <>
            <p className="text-sm text-muted-foreground">
              {canEditProp
                ? "Namesets bundle naming pools and a convention. Nations and settlements can override the world default."
                : "Namesets define the naming pools and convention used for random NPC creation."}
            </p>

            <Input
              aria-label="Search namesets by name"
              className="sm:w-[280px]"
              placeholder="Search by name…"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
              }}
            />

            {filteredItems.length > 0 ? (
              <NamesetsTable
                canEdit={canEditProp}
                namesets={filteredItems}
                queryClient={qc}
                showTrash={showTrash}
                worldId={worldId}
              />
            ) : items.length > 0 ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  No matching namesets.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}

            {canEditProp && showForm && !showTrash ? (
              <Navigate
                to="/worlds/$worldId/configuration/namesets/new"
                params={{ worldId }}
              />
            ) : null}
          </>
        );
      }}
    />
  );
}
