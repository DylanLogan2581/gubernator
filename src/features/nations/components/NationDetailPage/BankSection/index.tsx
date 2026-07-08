import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  checkCanManageNation,
  useActivePlayerCharacter,
} from "@/features/permissions";
import { resourceByIdQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  nationCurrencyQueryOptions,
  nationCurrencySnapshotsQueryOptions,
  nationCurrencyTreasuryQueryOptions,
} from "../../../queries/currencyQueries";
import { nationOfficesRosterQueryOptions } from "../../../queries/officesQueries";
import { formatNationCurrencyType } from "../../../types/currencyTypes";

import {
  BurnCurrencyDialog,
  DepositReservesDialog,
  MintCurrencyDialog,
  RedeemReservesDialog,
} from "./CurrencyActionDialog";
import { CurrencyLedgerTable } from "./CurrencyLedgerTable";
import { CurrencyStatTiles } from "./CurrencyStatTiles";
import { EstablishCurrencyDialog } from "./EstablishCurrencyDialog";

import type { Nation } from "../../../types/nationTypes";

type CurrencyAction = "burn" | "deposit" | "mint" | "redeem";

export function NationBankSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const queryClient = useQueryClient();

  const currencyQuery = useQuery(nationCurrencyQueryOptions(nation.id));
  const rosterQuery = useQuery(nationOfficesRosterQueryOptions(nation.id));

  const currency = currencyQuery.data ?? null;

  const isBankGovernor =
    activeCharacter !== null &&
    (rosterQuery.data ?? []).some(
      (entry) =>
        entry.officeType === "bank_governor" &&
        entry.citizenId === activeCharacter.id,
    );
  const canManage =
    checkCanManageNation({
      activeCharacter,
      canAdmin: canAdminWorld,
      nationId: nation.id,
    }) || isBankGovernor;

  const [isEstablishing, setIsEstablishing] = useState(false);
  const [activeAction, setActiveAction] = useState<CurrencyAction | null>(null);
  const [ledgerPage, setLedgerPage] = useState(0);

  const snapshotsQuery = useQuery({
    ...nationCurrencySnapshotsQueryOptions(currency?.id ?? ""),
    enabled: currency !== null,
  });
  const treasuryQuery = useQuery({
    ...nationCurrencyTreasuryQueryOptions(nation.id),
    enabled: currency !== null,
  });
  const backingResourceQuery = useQuery({
    ...resourceByIdQueryOptions(currency?.backingResourceId ?? ""),
    enabled: currency?.backingResourceId !== null && currency !== null,
  });

  if (currencyQuery.isPending) {
    return <LoadingState label="Loading currency…" />;
  }

  if (currencyQuery.isError) {
    return (
      <ErrorState
        title="Currency could not be loaded"
        description={getErrorDescription(currencyQuery.error)}
      />
    );
  }

  if (currency === null) {
    return (
      <>
        <Card className="p-4">
          <EmptyState
            title="No currency established"
            description="Establish a currency to unlock minting, reserves, and confidence tracking for this nation."
            action={
              canManage && !isArchived ? (
                <Button type="button" onClick={() => setIsEstablishing(true)}>
                  Establish a currency
                </Button>
              ) : undefined
            }
          />
        </Card>
        {isEstablishing ? (
          <EstablishCurrencyDialog
            nationId={nation.id}
            onClose={() => setIsEstablishing(false)}
            queryClient={queryClient}
            worldId={nation.worldId}
          />
        ) : null}
      </>
    );
  }

  const backingResourceName = backingResourceQuery.data?.name ?? "resource";

  return (
    <>
      <Card aria-labelledby="nation-bank-heading" className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 id="nation-bank-heading" className="text-base font-medium">
              {currency.name} ({currency.symbol})
            </h2>
            <Badge variant="outline">
              {formatNationCurrencyType(currency.currencyType)}
            </Badge>
          </div>
          {canManage && !isArchived ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveAction("mint")}
              >
                Mint
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveAction("burn")}
              >
                Burn
              </Button>
              {currency.currencyType === "resource_backed" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("deposit")}
                  >
                    Deposit reserves
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("redeem")}
                  >
                    Redeem reserves
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <CurrencyStatTiles
          currency={currency}
          isSnapshotsPending={snapshotsQuery.isPending}
          isTreasuryPending={treasuryQuery.isPending}
          snapshots={snapshotsQuery.data ?? []}
          treasuryCurrency={treasuryQuery.data ?? null}
        />

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Ledger</h3>
          <CurrencyLedgerTable
            currencyId={currency.id}
            onPageChange={setLedgerPage}
            page={ledgerPage}
            resourceSymbol={backingResourceName}
            symbol={currency.symbol}
          />
        </div>
      </Card>

      {activeAction === "mint" ? (
        <MintCurrencyDialog
          currency={currency}
          nationId={nation.id}
          onClose={() => setActiveAction(null)}
          queryClient={queryClient}
        />
      ) : null}
      {activeAction === "burn" ? (
        <BurnCurrencyDialog
          currency={currency}
          nationId={nation.id}
          onClose={() => setActiveAction(null)}
          queryClient={queryClient}
        />
      ) : null}
      {activeAction === "deposit" ? (
        <DepositReservesDialog
          backingResourceName={backingResourceName}
          currency={currency}
          nationId={nation.id}
          onClose={() => setActiveAction(null)}
          queryClient={queryClient}
        />
      ) : null}
      {activeAction === "redeem" ? (
        <RedeemReservesDialog
          backingResourceName={backingResourceName}
          currency={currency}
          nationId={nation.id}
          onClose={() => setActiveAction(null)}
          queryClient={queryClient}
        />
      ) : null}
    </>
  );
}
