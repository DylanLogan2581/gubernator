import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { TablePagination } from "@/components/shared/TablePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  CURRENCY_LEDGER_PAGE_SIZE,
  nationCurrencyLedgerPageQueryOptions,
} from "../../../queries/currencyQueries";
import { formatNationCurrencyLedgerAction } from "../../../types/currencyTypes";

export function CurrencyLedgerTable({
  currencyId,
  onPageChange,
  page,
  resourceSymbol,
  symbol,
}: {
  readonly currencyId: string;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly resourceSymbol: string;
  readonly symbol: string;
}): JSX.Element {
  const ledgerQuery = useQuery(
    nationCurrencyLedgerPageQueryOptions(currencyId, page),
  );

  if (ledgerQuery.isPending) {
    return <LoadingState label="Loading ledger…" />;
  }

  if (ledgerQuery.isError) {
    return (
      <ErrorState
        title="Ledger could not be loaded"
        description={getErrorDescription(ledgerQuery.error)}
      />
    );
  }

  if (ledgerQuery.data.entries.length === 0) {
    return (
      <EmptyState
        title="No ledger entries"
        description="Mint, burn, deposit, and redeem actions will appear here."
      />
    );
  }

  const pageCount = Math.ceil(
    ledgerQuery.data.totalCount / CURRENCY_LEDGER_PAGE_SIZE,
  );

  return (
    <div className="grid gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Turn</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Actor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledgerQuery.data.entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="tabular-nums">{entry.turnNumber}</TableCell>
              <TableCell>
                {formatNationCurrencyLedgerAction(entry.action)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {entry.amount !== null
                  ? `${entry.amount.toLocaleString()} ${symbol}`
                  : entry.resourceAmount !== null
                    ? `${entry.resourceAmount.toLocaleString()} ${resourceSymbol}`
                    : "—"}
              </TableCell>
              <TableCell>{entry.actorName ?? "System"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isDisabled={ledgerQuery.isFetching}
      />
    </div>
  );
}
