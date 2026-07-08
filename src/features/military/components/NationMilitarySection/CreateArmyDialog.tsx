import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type JSX } from "react";

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
import { NativeSelect } from "@/components/ui/native-select";
import { nationSettlementsQueryOptions } from "@/features/nations";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { createArmyMutationOptions } from "../../mutations/armiesMutations";

import type { ArmyFundingSource } from "../../types/armyTypes";

export function CreateArmyDialog({
  nationId,
  onClose,
  queryClient,
}: {
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const nameId = useId();
  const settlementSelectId = useId();
  const fundingId = useId();

  const [name, setName] = useState("");
  const [settlementId, setSettlementId] = useState("");
  const [fundingSource, setFundingSource] =
    useState<ArmyFundingSource>("nation");

  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const createMutation = useMutation(
    createArmyMutationOptions({ queryClient }),
  );

  const settlements = settlementsQuery.data ?? [];

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (settlementId === "") return;
    try {
      await createMutation.mutateAsync({
        fundingSource,
        name,
        nationId,
        stationedSettlementId: settlementId,
      });
      notifyMutationSuccess("Army created.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to create army.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form
          className="contents"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
        >
          <DialogHeader>
            <DialogTitle>Create army</DialogTitle>
            <DialogDescription>
              Found a new army stationed at one of this nation's settlements.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                maxLength={64}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={settlementSelectId}>Stationed settlement</Label>
              <NativeSelect
                id={settlementSelectId}
                required
                value={settlementId}
                onChange={(e) => setSettlementId(e.target.value)}
              >
                <option value="">Select a settlement…</option>
                {settlements.map((settlement) => (
                  <option key={settlement.id} value={settlement.id}>
                    {settlement.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <fieldset className="grid gap-2">
              <legend id={fundingId} className="text-sm font-medium">
                Funding source
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  checked={fundingSource === "nation"}
                  name="funding-source"
                  type="radio"
                  value="nation"
                  onChange={() => setFundingSource("nation")}
                />
                <span>
                  Nation treasury
                  <span className="block text-xs text-muted-foreground">
                    Paid from the nation's treasury.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  checked={fundingSource === "host_settlement"}
                  name="funding-source"
                  type="radio"
                  value="host_settlement"
                  onChange={() => setFundingSource("host_settlement")}
                />
                <span>
                  Host settlement
                  <span className="block text-xs text-muted-foreground">
                    Paid from the stationed settlement's stockpile.
                  </span>
                </span>
              </label>
            </fieldset>
          </div>

          <DialogFooter>
            <Button
              disabled={createMutation.isPending}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              disabled={
                createMutation.isPending ||
                name.trim() === "" ||
                settlementId === ""
              }
              type="submit"
            >
              Create army
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
