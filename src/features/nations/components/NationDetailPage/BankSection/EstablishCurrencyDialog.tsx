import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { establishNationCurrencyMutationOptions } from "../../../mutations/currencyMutations";

import type { NationCurrencyType } from "../../../types/currencyTypes";

const TYPE_EXPLAINER: Record<NationCurrencyType, string> = {
  fiat: "Print freely — confidence is your constraint. Over-minting erodes trust in your currency over time.",
  resource_backed:
    "Pick a backing resource and ratio — reserves are your constraint. Money supply is capped by reserves × ratio.",
};

export function EstablishCurrencyDialog({
  nationId,
  onClose,
  queryClient,
  worldId,
}: {
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const mutation = useMutation(
    establishNationCurrencyMutationOptions({ queryClient }),
  );

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<NationCurrencyType>("fiat");
  const [backingResourceId, setBackingResourceId] = useState("");
  const [backingRatio, setBackingRatio] = useState("");

  const trimmedName = name.trim();
  const trimmedSymbol = symbol.trim();
  const parsedRatio = Number(backingRatio);

  const isNameValid = trimmedName.length >= 1;
  const isSymbolValid = trimmedSymbol.length >= 1 && trimmedSymbol.length <= 5;
  const isBackingValid =
    type === "fiat" ||
    (backingResourceId !== "" &&
      Number.isFinite(parsedRatio) &&
      parsedRatio > 0);
  const isValid = isNameValid && isSymbolValid && isBackingValid;

  function handleSubmit(): void {
    if (!isValid) return;
    mutation.mutate(
      {
        backingRatio: type === "resource_backed" ? parsedRatio : undefined,
        backingResourceId:
          type === "resource_backed" ? backingResourceId : undefined,
        name: trimmedName,
        nationId,
        symbol: trimmedSymbol,
        type,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to establish currency.");
        },
        onSuccess: () => {
          notifyMutationSuccess(
            `${trimmedName} (${trimmedSymbol}) established.`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Establish a currency</DialogTitle>
          <DialogDescription>
            Every nation may establish exactly one currency. Choose carefully —
            the type cannot be changed afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="establish-currency-name">Name</Label>
            <Input
              id="establish-currency-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="establish-currency-symbol">Symbol</Label>
            <Input
              id="establish-currency-symbol"
              maxLength={5}
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">1–5 characters.</p>
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as NationCurrencyType)}
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  id="establish-currency-type-fiat"
                  value="fiat"
                />
                <Label
                  htmlFor="establish-currency-type-fiat"
                  className="grid gap-0.5 font-normal"
                >
                  <span className="font-medium">Fiat</span>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_EXPLAINER.fiat}
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  id="establish-currency-type-resource-backed"
                  value="resource_backed"
                />
                <Label
                  htmlFor="establish-currency-type-resource-backed"
                  className="grid gap-0.5 font-normal"
                >
                  <span className="font-medium">Resource-backed</span>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_EXPLAINER.resource_backed}
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          {type === "resource_backed" ? (
            <div className="grid gap-3 rounded-md border p-3">
              <div className="grid gap-1">
                <Label htmlFor="establish-currency-backing-resource">
                  Backing resource
                </Label>
                {resourcesQuery.isPending ? (
                  <p className="text-xs text-muted-foreground">
                    Loading resources…
                  </p>
                ) : resourcesQuery.isError ? (
                  <p className="text-xs text-destructive">
                    {getErrorDescription(resourcesQuery.error)}
                  </p>
                ) : (
                  <Select
                    value={backingResourceId}
                    onValueChange={setBackingResourceId}
                  >
                    <SelectTrigger
                      id="establish-currency-backing-resource"
                      aria-label="Backing resource"
                    >
                      <SelectValue placeholder="Select a resource" />
                    </SelectTrigger>
                    <SelectContent>
                      {resourcesQuery.data.map((resource) => (
                        <SelectItem key={resource.id} value={resource.id}>
                          {resource.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-1">
                <Label htmlFor="establish-currency-backing-ratio">
                  Backing ratio
                </Label>
                <Input
                  id="establish-currency-backing-ratio"
                  type="number"
                  min={0}
                  step="any"
                  value={backingRatio}
                  onChange={(event) => setBackingRatio(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Money supply is capped at reserves × ratio.
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? "Establishing…" : "Establish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
