import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { type JSX } from "react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActivePlayerCharacter } from "@/features/permissions";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setNationTradePolicyMutationOptions } from "../../mutations/nationsMutations";
import {
  describeNationTradePolicy,
  formatNationTradePolicy,
  NATION_TRADE_POLICIES,
  type Nation,
  type NationTradePolicy,
} from "../../types/nationTypes";

export function NationTradePolicySection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canManage = (canAdminWorld || isNationManager) && !isArchived;

  const queryClient = useQueryClient();
  const tradePolicyMutation = useMutation(
    setNationTradePolicyMutationOptions({ queryClient }),
  );

  function handleChange(tradePolicy: NationTradePolicy): void {
    if (tradePolicy === nation.tradePolicy) return;
    tradePolicyMutation.mutate(
      { nationId: nation.id, tradePolicy },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update trade policy.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Trade policy updated.");
        },
      },
    );
  }

  return (
    <Card
      aria-labelledby="nation-trade-policy-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex items-center gap-2">
        <ArrowLeftRight
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2 id="nation-trade-policy-heading" className="text-base font-medium">
          Trade Policy
        </h2>
      </div>

      {canManage ? (
        <Label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">
            International trade posture
          </span>
          <NativeSelect
            aria-label="International trade posture"
            className="w-full max-w-xs"
            disabled={tradePolicyMutation.isPending}
            value={nation.tradePolicy}
            onChange={(event) => {
              handleChange(event.currentTarget.value as NationTradePolicy);
            }}
          >
            {NATION_TRADE_POLICIES.map((option) => (
              <option key={option} value={option}>
                {formatNationTradePolicy(option)}
              </option>
            ))}
          </NativeSelect>
        </Label>
      ) : (
        <p className="text-sm font-medium">
          {formatNationTradePolicy(nation.tradePolicy)}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {describeNationTradePolicy(nation.tradePolicy)}
      </p>
      <p className="text-xs text-muted-foreground">
        Internal trade between this nation&apos;s own settlements is always
        allowed regardless of this policy.
      </p>
    </Card>
  );
}
