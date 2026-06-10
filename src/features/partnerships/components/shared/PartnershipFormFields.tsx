import { Link } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Citizen } from "@/features/citizens";

import type { PartnershipStatus } from "../../types/partnershipTypes";
import type { JSX } from "react";

export function ChangeReasonField({
  disabled,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <Label htmlFor="change-reason">Change reason</Label>
      <Input
        id="change-reason"
        disabled={disabled}
        maxLength={1000}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

export function TurnNumberField({
  disabled,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <Label htmlFor="turn-number">{label}</Label>
      <Input
        id="turn-number"
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

export function PartnerPicker({
  candidates,
  disabled,
  focalSettlementId,
  includeOtherSettlements,
  label,
  onChange,
  onToggleScope,
  value,
}: {
  readonly candidates: readonly Citizen[];
  readonly disabled: boolean;
  readonly focalSettlementId: string | null;
  readonly includeOtherSettlements: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly onToggleScope: (value: boolean) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <div className="grid gap-1">
        <Label htmlFor="partner-select">{label}</Label>
        <NativeSelect
          id="partner-select"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          <option value="">Select a citizen…</option>
          {candidates.map((candidate) => {
            const isOther = candidate.settlementId !== focalSettlementId;
            return (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
                {isOther ? " (other settlement)" : ""}
              </option>
            );
          })}
        </NativeSelect>
      </div>
      <Label
        htmlFor="include-other-settlements"
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <input
          id="include-other-settlements"
          type="checkbox"
          checked={includeOtherSettlements}
          disabled={disabled}
          onChange={(event) => onToggleScope(event.currentTarget.checked)}
        />
        Include citizens from other settlements (cross-settlement)
      </Label>
    </div>
  );
}

export function FormError({
  fieldError,
}: {
  readonly fieldError: string | undefined;
}): JSX.Element | null {
  if (fieldError === undefined) {
    return null;
  }
  return (
    <Alert variant="destructive">
      <AlertDescription>{fieldError}</AlertDescription>
    </Alert>
  );
}

export function PartnershipStatusChip({
  status,
}: {
  readonly status: PartnershipStatus;
}): JSX.Element {
  const tone =
    status === "active"
      ? "bg-secondary text-secondary-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs ${tone}`}
    >
      {partnershipStatusLabel(status)}
    </span>
  );
}

export function PartnerLink({
  partner,
  partnerId,
  queryError,
  queryPending,
  worldId,
}: {
  readonly partner: Citizen | null;
  readonly partnerId: string;
  readonly queryError: boolean;
  readonly queryPending: boolean;
  readonly worldId: string;
}): JSX.Element {
  if (queryPending) {
    return (
      <span className="text-xs italic text-muted-foreground">Loading…</span>
    );
  }
  if (queryError || partner === null) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {partnerId}
      </span>
    );
  }
  return (
    <Link
      to="/worlds/$worldId/citizens/$citizenId"
      params={{ citizenId: partner.id, worldId }}
      className="text-sm font-medium underline-offset-2 hover:underline"
    >
      {partner.name}
    </Link>
  );
}

function partnershipStatusLabel(status: PartnershipStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "dissolved":
      return "Dissolved";
    case "widowed":
      return "Widowed";
  }
}
