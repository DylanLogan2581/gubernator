import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  dissolvePartnershipMutationOptions,
  markPartnershipWidowedMutationOptions,
} from "../mutations/partnershipsMutations";
import { getPartnershipMutationErrorDescription } from "../utils/partnershipErrors";

import {
  ChangeReasonField,
  FormError,
  TurnNumberField,
} from "./shared/PartnershipFormFields";

import type { Partnership } from "../types/partnershipTypes";

export function EndPartnershipForm({
  defaultTurnNumber,
  kind,
  onClose,
  partnership,
  turnTransitionId,
}: {
  readonly defaultTurnNumber: number;
  readonly kind: "dissolve" | "widow";
  readonly onClose: () => void;
  readonly partnership: Partnership;
  readonly turnTransitionId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const dissolveMutation = useMutation(
    dissolvePartnershipMutationOptions({ queryClient }),
  );
  const widowMutation = useMutation(
    markPartnershipWidowedMutationOptions({ queryClient }),
  );
  const mutation = kind === "dissolve" ? dissolveMutation : widowMutation;

  const [endTurn, setEndTurn] = useState(String(defaultTurnNumber));
  const [changeReason, setChangeReason] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);
    mutation.reset();

    const parsedTurn = Number.parseInt(endTurn, 10);
    if (!Number.isFinite(parsedTurn) || parsedTurn < 0) {
      setFieldError("End turn must be a non-negative integer.");
      return;
    }
    if (parsedTurn < partnership.formedOnTurnNumber) {
      setFieldError(
        `End turn must be on or after the formed turn (turn ${partnership.formedOnTurnNumber}).`,
      );
      return;
    }
    if (changeReason.trim().length === 0) {
      setFieldError("Change reason is required.");
      return;
    }

    const input = {
      changeReason,
      endedOnTurnNumber: parsedTurn,
      partnershipId: partnership.id,
      turnTransitionId,
    };

    if (kind === "dissolve") {
      dissolveMutation.mutate(input, {
        onError: (error) => {
          toast.error(getPartnershipMutationErrorDescription(error));
        },
        onSuccess: onClose,
      });
    } else {
      widowMutation.mutate(input, {
        onError: (error) => {
          toast.error(getPartnershipMutationErrorDescription(error));
        },
        onSuccess: onClose,
      });
    }
  }

  const heading = kind === "dissolve" ? "Dissolve partnership" : "Mark widowed";
  const submitLabel =
    kind === "dissolve"
      ? mutation.isPending
        ? "Dissolving…"
        : "Dissolve"
      : mutation.isPending
        ? "Marking…"
        : "Mark widowed";

  return (
    <form
      aria-label={heading}
      className="grid gap-2 rounded-md border border-border bg-card px-3 py-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{heading}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label={`Cancel ${heading.toLowerCase()}`}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <TurnNumberField
        disabled={mutation.isPending}
        label="Ended on turn"
        onChange={setEndTurn}
        value={endTurn}
      />
      <ChangeReasonField
        disabled={mutation.isPending}
        onChange={setChangeReason}
        value={changeReason}
      />
      <FormError fieldError={fieldError} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          variant={kind === "dissolve" ? "destructive" : "default"}
          disabled={mutation.isPending}
        >
          {submitLabel}
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
