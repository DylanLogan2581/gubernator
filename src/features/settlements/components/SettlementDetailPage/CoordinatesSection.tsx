import { useMutation, type QueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateSettlementCoordinatesMutationOptions } from "../../mutations/settlementsMutations";

import { getMutationErrorDescription } from "./ErrorMessages";

import type { SettlementWithNation } from "../../types/settlementTypes";

// Coordinates are informational only per the feature guide; we still bound
// client input so users get feedback before the DB rejects out-of-range numbers.
const COORDINATE_LIMIT = 1_000_000;

type ParsedCoordinate =
  | { readonly kind: "valid"; readonly value: number | null }
  | { readonly kind: "invalid"; readonly message: string };

function parseCoordinateInput(raw: string): ParsedCoordinate {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: "valid", value: null };
  }

  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return {
      kind: "invalid",
      message: "Enter a decimal number, or leave blank to clear.",
    };
  }

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      kind: "invalid",
      message: "Enter a finite decimal number.",
    };
  }

  if (parsed < -COORDINATE_LIMIT || parsed > COORDINATE_LIMIT) {
    return {
      kind: "invalid",
      message: `Must be between -${COORDINATE_LIMIT.toLocaleString()} and ${COORDINATE_LIMIT.toLocaleString()}.`,
    };
  }

  return { kind: "valid", value: parsed };
}

function formatCoordinate(value: number | null): string {
  if (value === null) {
    return "";
  }
  return String(value);
}

export function SettlementCoordinatesSection({
  canEdit,
  queryClient,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [coordX, setCoordX] = useState(() =>
    formatCoordinate(settlement.coordX),
  );
  const [coordZ, setCoordZ] = useState(() =>
    formatCoordinate(settlement.coordZ),
  );
  const [coordXError, setCoordXError] = useState<string | undefined>(undefined);
  const [coordZError, setCoordZError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateSettlementCoordinatesMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setCoordX(formatCoordinate(settlement.coordX));
    setCoordZ(formatCoordinate(settlement.coordZ));
    setCoordXError(undefined);
    setCoordZError(undefined);
    updateMutation.reset();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCoordXError(undefined);
    setCoordZError(undefined);
    updateMutation.reset();

    const parsedX = parseCoordinateInput(coordX);
    const parsedZ = parseCoordinateInput(coordZ);

    if (parsedX.kind === "invalid") {
      setCoordXError(parsedX.message);
    }
    if (parsedZ.kind === "invalid") {
      setCoordZError(parsedZ.message);
    }
    if (parsedX.kind === "invalid" || parsedZ.kind === "invalid") {
      return;
    }

    updateMutation.mutate(
      {
        coordX: parsedX.value,
        coordZ: parsedZ.value,
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId: settlement.nation.worldId,
      },
      {
        onError: (error) => {
          toast.error(getMutationErrorDescription(error));
        },
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <section
        aria-labelledby="settlement-coordinates-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <h2
              id="settlement-coordinates-heading"
              className="text-base font-medium"
            >
              Coordinates
            </h2>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Coordinates are informational only.
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <CoordinateReadout label="X" value={settlement.coordX} />
          <CoordinateReadout label="Z" value={settlement.coordZ} />
        </dl>
      </section>
    );
  }

  return (
    <form
      aria-label="Edit settlement coordinates"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit coordinates</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          aria-label="Cancel edit"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Accepts decimal values between {`-${COORDINATE_LIMIT.toLocaleString()}`}{" "}
        and {COORDINATE_LIMIT.toLocaleString()}. Leave blank to clear.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CoordinateField
          disabled={updateMutation.isPending}
          error={coordXError}
          id="settlement-coord-x"
          label="X"
          onChange={(value) => {
            setCoordX(value);
            if (coordXError !== undefined) {
              setCoordXError(undefined);
            }
          }}
          value={coordX}
        />
        <CoordinateField
          disabled={updateMutation.isPending}
          error={coordZError}
          id="settlement-coord-z"
          label="Z"
          onChange={(value) => {
            setCoordZ(value);
            if (coordZError !== undefined) {
              setCoordZError(undefined);
            }
          }}
          value={coordZ}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          <Save aria-hidden="true" />
          {updateMutation.isPending ? "Saving…" : "Save coordinates"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeEditor}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CoordinateReadout({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | null;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium">
        {value === null ? (
          <span className="italic text-muted-foreground">Not set</span>
        ) : (
          formatCoordinate(value)
        )}
      </dd>
    </div>
  );
}

function CoordinateField({
  disabled,
  error,
  id,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly error: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  const errorId = `${id}-error`;
  return (
    <label className="grid gap-1 text-sm" htmlFor={id}>
      <span className="text-muted-foreground">{label}</span>
      <Input
        aria-describedby={error === undefined ? undefined : errorId}
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="e.g. 12.5"
        value={value}
      />
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </label>
  );
}
