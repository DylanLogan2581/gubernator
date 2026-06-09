import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CreateSettlementDialog,
  ManualReadinessControl,
  setSettlementReadinessMutationOptions,
} from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";

import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";

import type { NationSettlement } from "../../types/nationTypes";

export function NationSettlementsSection({
  canAdmin = false,
  isArchived = false,
  nationId,
  userId,
  worldId,
}: {
  readonly canAdmin?: boolean;
  readonly isArchived?: boolean;
  readonly nationId: string;
  readonly userId: string | null;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <section
      aria-labelledby="nation-settlements-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="nation-settlements-heading" className="text-base font-medium">
          Settlements
        </h2>
        {canAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setShowCreateDialog(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            New settlement
          </Button>
        )}
      </div>
      {settlementsQuery.isPending ? (
        <LoadingState label="Loading settlements…" />
      ) : settlementsQuery.isError ? (
        <ErrorState
          title="Settlements could not be loaded"
          description={getErrorDescription(settlementsQuery.error)}
        />
      ) : settlementsQuery.data.length === 0 ? (
        <EmptyState
          title="No settlements"
          description="This nation has no settlements yet."
        />
      ) : (
        <ul className="grid gap-2" aria-label="Settlements">
          {settlementsQuery.data.map((settlement) => (
            <NationSettlementListItem
              key={settlement.id}
              isArchived={isArchived}
              queryClient={queryClient}
              settlement={settlement}
              userId={userId}
              worldId={worldId}
            />
          ))}
        </ul>
      )}

      {showCreateDialog && (
        <CreateSettlementDialog
          nationId={nationId}
          worldId={worldId}
          queryClient={queryClient}
          onClose={() => {
            setShowCreateDialog(false);
          }}
        />
      )}
    </section>
  );
}

function NationSettlementListItem({
  isArchived,
  queryClient,
  settlement,
  userId,
  worldId,
}: {
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly settlement: NationSettlement;
  readonly userId: string | null;
  readonly worldId: string;
}): JSX.Element {
  const [isPending, setIsPending] = useState(false);
  const readinessMutation = useMutation(
    setSettlementReadinessMutationOptions({
      accessContext: {
        canAccessWorld: () => true,
        canAdminWorld: () => false,
        isActiveUser: userId !== null,
        isAuthenticated: userId !== null,
        isSuperAdmin: false,
        userId: userId ?? null,
        worldAdminWorldIds: [],
        playerCharacterWorldIds: [],
      },
      queryClient,
    }),
  );

  const handleSetReadiness = (isReady: boolean): void => {
    setIsPending(true);
    readinessMutation.mutate(
      {
        isReady,
        settlementId: settlement.id,
        worldId,
      },
      {
        onSettled: () => {
          setIsPending(false);
        },
      },
    );
  };

  return (
    <li className="rounded-md border border-border bg-background p-0">
      <Collapsible className="group">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
            params={{
              nationId: settlement.nationId,
              settlementId: settlement.id,
              worldId,
            }}
            search={{}}
            className="flex-1 text-sm font-medium underline-offset-4 hover:underline text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {settlement.name}
          </Link>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180 ml-2" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border px-4 pb-4 pt-2">
          <div className="space-y-3">
            <ManualReadinessControl
              isArchived={isArchived}
              item={settlement}
              isPending={isPending}
              setReadiness={handleSetReadiness}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
