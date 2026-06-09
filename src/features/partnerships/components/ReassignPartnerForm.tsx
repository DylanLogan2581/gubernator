import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Citizen } from "@/features/citizens";
import { unpairedAliveCitizensInWorldQueryOptions } from "@/features/citizens";

import { usePartnerCandidates } from "../hooks/usePartnerCandidates";
import { reassignPartnerMutationOptions } from "../mutations/partnershipsMutations";
import { getPartnershipMutationErrorDescription } from "../utils/partnershipErrors";

import {
  ChangeReasonField,
  FormError,
  PartnerPicker,
  TurnNumberField,
} from "./shared/PartnershipFormFields";

import type { Partnership } from "../types/partnershipTypes";

export function ReassignPartnerForm({
  currentTurnNumber,
  focalCitizen,
  onClose,
  partnership,
  retainedCitizenId,
  turnTransitionId,
}: {
  readonly currentTurnNumber: number;
  readonly focalCitizen: Citizen;
  readonly onClose: () => void;
  readonly partnership: Partnership;
  readonly retainedCitizenId: string;
  readonly turnTransitionId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const candidatesQuery = useQuery(
    unpairedAliveCitizensInWorldQueryOptions(focalCitizen.worldId),
  );
  const mutation = useMutation(reassignPartnerMutationOptions({ queryClient }));

  const [newPartnerId, setNewPartnerId] = useState("");
  const [endTurn, setEndTurn] = useState(String(currentTurnNumber));
  const [formedTurn, setFormedTurn] = useState(String(currentTurnNumber));
  const [changeReason, setChangeReason] = useState("");
  const [includeOtherSettlements, setIncludeOtherSettlements] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const candidates = usePartnerCandidates({
    allCandidates: candidatesQuery.data,
    excludeCitizenId: retainedCitizenId,
    focalSettlementId: focalCitizen.settlementId,
    includeOtherSettlements,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);
    mutation.reset();

    if (newPartnerId === "") {
      setFieldError("Pick a new partner before reassigning.");
      return;
    }
    const parsedEnd = Number.parseInt(endTurn, 10);
    const parsedFormed = Number.parseInt(formedTurn, 10);
    if (!Number.isFinite(parsedEnd) || parsedEnd < 0) {
      setFieldError("End turn must be a non-negative integer.");
      return;
    }
    if (parsedEnd < partnership.formedOnTurnNumber) {
      setFieldError(
        `Old partnership end turn must be on or after the formed turn (turn ${partnership.formedOnTurnNumber}).`,
      );
      return;
    }
    if (!Number.isFinite(parsedFormed) || parsedFormed < 0) {
      setFieldError("New formed turn must be a non-negative integer.");
      return;
    }
    if (changeReason.trim().length === 0) {
      setFieldError("Change reason is required.");
      return;
    }

    mutation.mutate(
      {
        changeReason,
        endedOnTurnNumber: parsedEnd,
        formedOnTurnNumber: parsedFormed,
        newPartnerCitizenId: newPartnerId,
        oldPartnershipId: partnership.id,
        retainedCitizenId,
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
      aria-label="Reassign partner"
      className="grid gap-2 rounded-md border border-border bg-card px-3 py-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reassign partner</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Cancel reassign partner"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <PartnerPicker
        candidates={candidates}
        disabled={mutation.isPending || candidatesQuery.isPending}
        focalSettlementId={focalCitizen.settlementId}
        includeOtherSettlements={includeOtherSettlements}
        label="New partner"
        onChange={setNewPartnerId}
        onToggleScope={setIncludeOtherSettlements}
        value={newPartnerId}
      />
      <TurnNumberField
        disabled={mutation.isPending}
        label="Old partnership ended on turn"
        onChange={setEndTurn}
        value={endTurn}
      />
      <TurnNumberField
        disabled={mutation.isPending}
        label="New partnership formed on turn"
        onChange={setFormedTurn}
        value={formedTurn}
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
          {mutation.isPending ? "Reassigning…" : "Reassign"}
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
