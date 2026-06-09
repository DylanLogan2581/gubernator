import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Citizen } from "@/features/citizens";
import { unpairedAliveCitizensInWorldQueryOptions } from "@/features/citizens";

import { usePartnerCandidates } from "../hooks/usePartnerCandidates";
import { createPartnershipMutationOptions } from "../mutations/partnershipsMutations";
import { getPartnershipMutationErrorDescription } from "../utils/partnershipErrors";

import {
  ChangeReasonField,
  FormError,
  PartnerPicker,
  TurnNumberField,
} from "./shared/PartnershipFormFields";

export function CreatePartnershipForm({
  focalCitizen,
  formedOnTurnNumber,
  onClose,
  turnTransitionId,
}: {
  readonly focalCitizen: Citizen;
  readonly formedOnTurnNumber: number;
  readonly onClose: () => void;
  readonly turnTransitionId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const candidatesQuery = useQuery(
    unpairedAliveCitizensInWorldQueryOptions(focalCitizen.worldId),
  );
  const mutation = useMutation(
    createPartnershipMutationOptions({ queryClient }),
  );

  const [partnerId, setPartnerId] = useState("");
  const [turnNumber, setTurnNumber] = useState(String(formedOnTurnNumber));
  const [changeReason, setChangeReason] = useState("");
  const [includeOtherSettlements, setIncludeOtherSettlements] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const candidates = usePartnerCandidates({
    allCandidates: candidatesQuery.data,
    excludeCitizenId: focalCitizen.id,
    focalSettlementId: focalCitizen.settlementId,
    includeOtherSettlements,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);
    mutation.reset();

    if (partnerId === "") {
      setFieldError("Pick a partner before creating the partnership.");
      return;
    }
    const parsedTurn = Number.parseInt(turnNumber, 10);
    if (!Number.isFinite(parsedTurn) || parsedTurn < 0) {
      setFieldError("Formed turn must be a non-negative integer.");
      return;
    }
    if (changeReason.trim().length === 0) {
      setFieldError("Change reason is required.");
      return;
    }

    mutation.mutate(
      {
        changeReason,
        citizenAId: focalCitizen.id,
        citizenBId: partnerId,
        formedOnTurnNumber: parsedTurn,
        status: "active",
        turnTransitionId,
      },
      {
        onError: (error) => {
          toast.error(getPartnershipMutationErrorDescription(error));
        },
        onSuccess: onClose,
      },
    );
  }

  return (
    <form
      aria-label="Create partnership"
      className="grid gap-2 rounded-md border border-border bg-background px-3 py-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Create partnership</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Cancel create partnership"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <PartnerPicker
        candidates={candidates}
        disabled={mutation.isPending || candidatesQuery.isPending}
        focalSettlementId={focalCitizen.settlementId}
        includeOtherSettlements={includeOtherSettlements}
        label="Partner"
        onChange={setPartnerId}
        onToggleScope={setIncludeOtherSettlements}
        value={partnerId}
      />
      <TurnNumberField
        disabled={mutation.isPending}
        label="Formed on turn"
        onChange={setTurnNumber}
        value={turnNumber}
      />
      <ChangeReasonField
        disabled={mutation.isPending}
        onChange={setChangeReason}
        value={changeReason}
      />
      <FormError fieldError={fieldError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          <Save aria-hidden="true" />
          {mutation.isPending ? "Creating…" : "Create partnership"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
