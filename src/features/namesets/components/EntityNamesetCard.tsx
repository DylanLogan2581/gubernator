import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  setNationNamesetMutationOptions,
  setSettlementNamesetMutationOptions,
} from "../mutations/namesetsMutations";
import { activeNamesetsByWorldQueryOptions } from "../queries/namesetsQueries";

import type { Nameset } from "../types/namesetTypes";

type NationNamesetCardProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly currentNamesetId: string | null;
  readonly worldId: string;
};

export function NationNamesetCard({
  canAdmin,
  isArchived,
  nationId,
  currentNamesetId,
  worldId,
}: NationNamesetCardProps): JSX.Element {
  const queryClient = useQueryClient();
  const namesetsQuery = useQuery(activeNamesetsByWorldQueryOptions(worldId));
  const mutation = useMutation(
    setNationNamesetMutationOptions({ queryClient }),
  );

  if (namesetsQuery.isPending) {
    return (
      <section aria-labelledby="nation-naming-title" className="grid gap-3">
        <h2 id="nation-naming-title" className="text-sm font-semibold">
          Naming
        </h2>
        <LoadingState label="Loading namesets…" />
      </section>
    );
  }

  if (namesetsQuery.isError) {
    return (
      <section aria-labelledby="nation-naming-title" className="grid gap-3">
        <h2 id="nation-naming-title" className="text-sm font-semibold">
          Naming
        </h2>
        <ErrorState
          title="Namesets could not be loaded"
          description={getErrorDescription(namesetsQuery.error)}
        />
      </section>
    );
  }

  const namesets = namesetsQuery.data;
  const canEdit = canAdmin && !isArchived;

  function handleChange(namesetId: string | null): void {
    mutation.mutate(
      { nationId, worldId, namesetId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to update nation naming.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Nation naming updated.");
        },
      },
    );
  }

  return (
    <NamesetCardContent
      currentNamesetId={currentNamesetId}
      disabled={!canEdit || mutation.isPending}
      headingId="nation-naming-title"
      namesets={namesets}
      onClear={() => {
        handleChange(null);
      }}
      onSelect={(id) => {
        handleChange(id);
      }}
    />
  );
}

type SettlementNamesetCardProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly currentNamesetId: string | null;
  readonly worldId: string;
};

export function SettlementNamesetCard({
  canAdmin,
  isArchived,
  settlementId,
  currentNamesetId,
  worldId,
}: SettlementNamesetCardProps): JSX.Element {
  const queryClient = useQueryClient();
  const namesetsQuery = useQuery(activeNamesetsByWorldQueryOptions(worldId));
  const mutation = useMutation(
    setSettlementNamesetMutationOptions({ queryClient }),
  );

  if (namesetsQuery.isPending) {
    return (
      <section aria-labelledby="settlement-naming-title" className="grid gap-3">
        <h2 id="settlement-naming-title" className="text-sm font-semibold">
          Naming
        </h2>
        <LoadingState label="Loading namesets…" />
      </section>
    );
  }

  if (namesetsQuery.isError) {
    return (
      <section aria-labelledby="settlement-naming-title" className="grid gap-3">
        <h2 id="settlement-naming-title" className="text-sm font-semibold">
          Naming
        </h2>
        <ErrorState
          title="Namesets could not be loaded"
          description={getErrorDescription(namesetsQuery.error)}
        />
      </section>
    );
  }

  const namesets = namesetsQuery.data;
  const canEdit = canAdmin && !isArchived;

  function handleChange(namesetId: string | null): void {
    mutation.mutate(
      { settlementId, worldId, namesetId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to update settlement naming.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Settlement naming updated.");
        },
      },
    );
  }

  return (
    <NamesetCardContent
      currentNamesetId={currentNamesetId}
      disabled={!canEdit || mutation.isPending}
      headingId="settlement-naming-title"
      namesets={namesets}
      onClear={() => {
        handleChange(null);
      }}
      onSelect={(id) => {
        handleChange(id);
      }}
    />
  );
}

function NamesetCardContent({
  currentNamesetId,
  disabled,
  headingId,
  namesets,
  onClear,
  onSelect,
}: {
  readonly currentNamesetId: string | null;
  readonly disabled: boolean;
  readonly headingId: string;
  readonly namesets: readonly Nameset[];
  readonly onClear: () => void;
  readonly onSelect: (id: string) => void;
}): JSX.Element {
  const defaultNameset = namesets.find((ns) => ns.isDefault);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="grid gap-3">
        <div>
          <h2 id={headingId} className="text-sm font-semibold">
            Naming
          </h2>
          <p className="text-xs text-muted-foreground">
            Override the naming pools and convention used for NPC generation in
            this region.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Nameset override"
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || namesets.length === 0}
            value={currentNamesetId ?? ""}
            onChange={(e) => {
              const val = e.currentTarget.value;
              if (val === "") {
                onClear();
              } else {
                onSelect(val);
              }
            }}
          >
            <option value="">
              {defaultNameset !== undefined
                ? `Use parent default (${defaultNameset.name})`
                : "Use parent default"}
            </option>
            {namesets.map((ns) => (
              <option key={ns.id} value={ns.id}>
                {ns.name}
                {ns.isDefault ? " (world default)" : ""}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          Using{" "}
          {defaultNameset !== undefined
            ? `world default: ${defaultNameset.name}`
            : "world naming config"}
        </p>
      </div>
    </section>
  );
}
