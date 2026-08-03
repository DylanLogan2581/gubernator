import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import {
  computeNextFiatConfidence,
  computeResourceBackedConfidence,
} from "@/shared/economy";

import {
  burnCurrencyMutationOptions,
  depositReservesMutationOptions,
  mintCurrencyMutationOptions,
  redeemReservesMutationOptions,
} from "../../../mutations/currencyMutations";

import type { NationCurrency } from "../../../types/currencyTypes";

// Projects the confidence delta a pending action would produce, using the
// same shared formula module the turn-engine simulation uses (#1095) — a
// single-action preview, not a full-turn simulation (it assumes this is the
// only mint/burn happening this turn).
function projectConfidenceDelta(
  currency: NationCurrency,
  action: "mint" | "burn" | "deposit" | "redeem",
  amount: number,
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (currency.currencyType === "fiat") {
    if (action !== "mint" && action !== "burn") return null;
    const projected = computeNextFiatConfidence({
      burnedThisTurn: action === "burn" ? amount : 0,
      confidence: currency.confidence,
      mintedThisTurn: action === "mint" ? amount : 0,
      moneySupplyStart: currency.moneySupply,
    });
    return projected - currency.confidence;
  }

  const backingRatio = currency.backingRatio ?? 0;
  const projectedMoneySupply =
    action === "mint"
      ? currency.moneySupply + amount
      : action === "burn"
        ? Math.max(currency.moneySupply - amount, 0)
        : currency.moneySupply;
  const projectedReserveQuantity =
    action === "deposit"
      ? currency.reserveQuantity + amount
      : action === "redeem"
        ? Math.max(currency.reserveQuantity - amount, 0)
        : currency.reserveQuantity;

  const projected = computeResourceBackedConfidence({
    backingRatio,
    moneySupply: projectedMoneySupply,
    reserveQuantity: projectedReserveQuantity,
  });
  return projected - currency.confidence;
}

function formatConfidenceDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}

type AmountDialogProps = {
  readonly amountLabel: string;
  readonly confidenceDelta: number | null;
  readonly description: string;
  readonly errorMessage: string | null;
  readonly isPending: boolean;
  readonly maxAmount?: number;
  readonly maxAmountHint?: string;
  readonly onAmountChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly submitLabel: string;
  readonly title: string;
  readonly value: string;
};

function CurrencyAmountDialog({
  amountLabel,
  confidenceDelta,
  description,
  errorMessage,
  isPending,
  maxAmount,
  maxAmountHint,
  onAmountChange,
  onClose,
  onSubmit,
  submitLabel,
  title,
  value,
}: AmountDialogProps): JSX.Element {
  const parsed = Number(value);
  const isValid =
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    (maxAmount === undefined || parsed <= maxAmount);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="currency-action-amount-input">
              {amountLabel} {maxAmountHint !== undefined ? maxAmountHint : ""}
            </Label>
            <Input
              id="currency-action-amount-input"
              type="number"
              min={0}
              max={maxAmount}
              value={value}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Confidence impact next turn:{" "}
            {formatConfidenceDelta(confidenceDelta)}
          </p>
          {errorMessage !== null ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !isValid}
          >
            {isPending ? "Submitting…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BaseDialogProps = {
  readonly currency: NationCurrency;
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

export function MintCurrencyDialog({
  currency,
  nationId,
  onClose,
  queryClient,
}: BaseDialogProps): JSX.Element {
  const [amount, setAmount] = useState("");
  const mutation = useMutation(mintCurrencyMutationOptions({ queryClient }));
  const parsed = Number(amount);

  return (
    <CurrencyAmountDialog
      amountLabel={`Amount (${currency.symbol})`}
      confidenceDelta={projectConfidenceDelta(currency, "mint", parsed)}
      description="Print new currency into the government treasury. For resource-backed currencies, minting is capped by reserves × backing ratio."
      errorMessage={
        mutation.isError ? (mutation.error?.message ?? "Mint failed.") : null
      }
      isPending={mutation.isPending}
      onAmountChange={setAmount}
      onClose={onClose}
      onSubmit={() => {
        mutation.mutate(
          { amount: parsed, currencyId: currency.id, nationId },
          {
            onError: (error) => {
              notifyMutationError(error, "Failed to mint currency.");
            },
            onSuccess: () => {
              notifyMutationSuccess(
                `Minted ${parsed.toLocaleString()} ${currency.symbol}.`,
              );
              onClose();
            },
          },
        );
      }}
      submitLabel="Mint"
      title="Mint currency"
      value={amount}
    />
  );
}

export function BurnCurrencyDialog({
  currency,
  nationId,
  onClose,
  queryClient,
}: BaseDialogProps): JSX.Element {
  const [amount, setAmount] = useState("");
  const mutation = useMutation(burnCurrencyMutationOptions({ queryClient }));
  const parsed = Number(amount);

  return (
    <CurrencyAmountDialog
      amountLabel={`Amount (${currency.symbol})`}
      confidenceDelta={projectConfidenceDelta(currency, "burn", parsed)}
      description="Remove currency from the government treasury and shrink the money supply."
      errorMessage={
        mutation.isError ? (mutation.error?.message ?? "Burn failed.") : null
      }
      isPending={mutation.isPending}
      onAmountChange={setAmount}
      onClose={onClose}
      onSubmit={() => {
        mutation.mutate(
          { amount: parsed, currencyId: currency.id, nationId },
          {
            onError: (error) => {
              notifyMutationError(error, "Failed to burn currency.");
            },
            onSuccess: () => {
              notifyMutationSuccess(
                `Burned ${parsed.toLocaleString()} ${currency.symbol}.`,
              );
              onClose();
            },
          },
        );
      }}
      submitLabel="Burn"
      title="Burn currency"
      value={amount}
    />
  );
}

type ReserveDialogProps = BaseDialogProps & {
  readonly backingResourceName: string;
};

export function DepositReservesDialog({
  backingResourceName,
  currency,
  nationId,
  onClose,
  queryClient,
}: ReserveDialogProps): JSX.Element {
  const [quantity, setQuantity] = useState("");
  const mutation = useMutation(depositReservesMutationOptions({ queryClient }));
  const parsed = Number(quantity);

  return (
    <CurrencyAmountDialog
      amountLabel={`Quantity (${backingResourceName})`}
      confidenceDelta={projectConfidenceDelta(currency, "deposit", parsed)}
      description={`Move ${backingResourceName} from the nation stockpile into this currency's reserves, raising its backing capacity.`}
      errorMessage={
        mutation.isError ? (mutation.error?.message ?? "Deposit failed.") : null
      }
      isPending={mutation.isPending}
      onAmountChange={setQuantity}
      onClose={onClose}
      onSubmit={() => {
        mutation.mutate(
          { currencyId: currency.id, nationId, quantity: parsed },
          {
            onError: (error) => {
              notifyMutationError(error, "Failed to deposit reserves.");
            },
            onSuccess: () => {
              notifyMutationSuccess(
                `Deposited ${parsed.toLocaleString()} ${backingResourceName}.`,
              );
              onClose();
            },
          },
        );
      }}
      submitLabel="Deposit"
      title="Deposit reserves"
      value={quantity}
    />
  );
}

export function RedeemReservesDialog({
  backingResourceName,
  currency,
  nationId,
  onClose,
  queryClient,
}: ReserveDialogProps): JSX.Element {
  const [quantity, setQuantity] = useState("");
  const mutation = useMutation(redeemReservesMutationOptions({ queryClient }));
  const parsed = Number(quantity);

  return (
    <CurrencyAmountDialog
      amountLabel={`Quantity (${backingResourceName})`}
      confidenceDelta={projectConfidenceDelta(currency, "redeem", parsed)}
      description={`Withdraw ${backingResourceName} from this currency's reserves back into the nation stockpile. Blocked if it would leave the money supply under-backed.`}
      errorMessage={
        mutation.isError ? (mutation.error?.message ?? "Redeem failed.") : null
      }
      isPending={mutation.isPending}
      maxAmount={currency.reserveQuantity}
      maxAmountHint={`(max ${currency.reserveQuantity.toLocaleString()} held)`}
      onAmountChange={setQuantity}
      onClose={onClose}
      onSubmit={() => {
        mutation.mutate(
          { currencyId: currency.id, nationId, quantity: parsed },
          {
            onError: (error) => {
              notifyMutationError(error, "Failed to redeem reserves.");
            },
            onSuccess: () => {
              notifyMutationSuccess(
                `Redeemed ${parsed.toLocaleString()} ${backingResourceName}.`,
              );
              onClose();
            },
          },
        );
      }}
      submitLabel="Redeem"
      title="Redeem reserves"
      value={quantity}
    />
  );
}
