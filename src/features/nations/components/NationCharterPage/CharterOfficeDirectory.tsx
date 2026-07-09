import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorDescription } from "@/lib/errorUtils";

import { nationOfficesRosterQueryOptions } from "../../queries/officesQueries";
import { nationOfficeTypesQueryOptions } from "../../queries/officeTypesQueries";
import { formatNationOfficeType } from "../../types/nationOfficeTypes";

export function CharterOfficeDirectory({
  nationId,
  worldId,
}: {
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const officeTypesQuery = useQuery(
    nationOfficeTypesQueryOptions(worldId, nationId),
  );
  const rosterQuery = useQuery(nationOfficesRosterQueryOptions(nationId));

  if (officeTypesQuery.isPending || rosterQuery.isPending) {
    return (
      <Frame>
        <LoadingState label="Loading office directory…" />
      </Frame>
    );
  }

  if (officeTypesQuery.isError || rosterQuery.isError) {
    return (
      <Frame>
        <ErrorState
          title="Office directory could not be loaded"
          description={getErrorDescription(
            officeTypesQuery.error ?? rosterQuery.error,
          )}
        />
      </Frame>
    );
  }

  const officeTypes = officeTypesQuery.data;
  if (officeTypes.length === 0) {
    return (
      <Frame>
        <EmptyState
          title="No offices"
          description="This nation has not defined any offices."
        />
      </Frame>
    );
  }

  const holdersByOfficeType = new Map<string, string[]>();
  for (const entry of rosterQuery.data) {
    const holders = holdersByOfficeType.get(entry.officeTypeId) ?? [];
    holders.push(entry.citizenName);
    holdersByOfficeType.set(entry.officeTypeId, holders);
  }

  return (
    <Frame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Office</TableHead>
            <TableHead>Holders</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {officeTypes.map((officeType) => {
            const holders = holdersByOfficeType.get(officeType.id) ?? [];
            return (
              <TableRow key={officeType.id}>
                <TableCell className="font-medium">
                  {formatNationOfficeType(officeType.name)}
                </TableCell>
                <TableCell>
                  {holders.length === 0 ? (
                    <span className="italic text-muted-foreground">Vacant</span>
                  ) : (
                    holders.join(", ")
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Frame>
  );
}

function Frame({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <section
      className="grid gap-3"
      aria-labelledby="nation-charter-offices-heading"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2
          id="nation-charter-offices-heading"
          className="text-base font-medium"
        >
          Office directory
        </h2>
      </div>
      {children}
    </section>
  );
}
