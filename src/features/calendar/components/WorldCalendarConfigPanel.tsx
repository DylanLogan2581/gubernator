import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import type { WorldPermissionContext } from "@/features/worlds";
import { notifyMutationSuccess } from "@/lib/notify";

import { saveWorldCalendarConfigMutationOptions } from "../mutations/calendarMutations";
import { worldCalendarConfigQueryOptions } from "../queries/calendarQueries";
import {
  emptyCalendarValidationErrors,
  getCalendarErrorDescription,
  getCalendarValidationErrors,
  hasCalendarValidationErrors,
} from "../utils/calendarConfigValidation";

import { CalendarEditableFields } from "./CalendarEditableFields";
import { CalendarReadOnlySummary } from "./CalendarReadOnlySummary";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";

type WorldCalendarConfigPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldCalendarConfigPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
}: WorldCalendarConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));

  if (calendarQuery.isPending) {
    return <LoadingState label="Loading calendar…" />;
  }

  if (calendarQuery.isError) {
    return (
      <ErrorState
        title="Calendar could not be loaded"
        description={getCalendarErrorDescription(calendarQuery.error)}
      />
    );
  }

  return (
    <WorldCalendarConfigPanelContent
      key={worldId}
      accessContext={accessContext}
      canAdmin={canAdmin}
      initialConfig={calendarQuery.data}
      isArchived={isArchived}
      queryClient={queryClient}
      worldId={worldId}
    />
  );
}

function WorldCalendarConfigPanelContent({
  accessContext,
  canAdmin,
  initialConfig,
  isArchived,
  queryClient,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly initialConfig: WorldCalendarConfig;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const saveMutation = useMutation(
    saveWorldCalendarConfigMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const [draftConfig, setDraftConfig] =
    useState<WorldCalendarConfig>(initialConfig);
  const [validationErrors, setValidationErrors] = useState(
    emptyCalendarValidationErrors,
  );

  const canEdit = canAdmin && !isArchived;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextValidationErrors = getCalendarValidationErrors(draftConfig);
    setValidationErrors(nextValidationErrors);

    if (hasCalendarValidationErrors(nextValidationErrors)) {
      return;
    }

    saveMutation.mutate(
      {
        config: draftConfig,
        worldId,
      },
      {
        onError: (error) => {
          toast.error(getCalendarErrorDescription(error));
        },
        onSuccess: () => {
          notifyMutationSuccess("Calendar saved.");
        },
      },
    );
  }

  function resetDraftConfig(): void {
    setDraftConfig(initialConfig);
    setValidationErrors(emptyCalendarValidationErrors);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="world-calendar-title"
            className="text-lg font-semibold tracking-normal"
          >
            Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "World admins can edit the calendar used by turn progression."
              : "Calendar configuration is read-only for your current access."}
          </p>
        </div>
        {!canEdit ? (
          <span className="inline-flex w-fit rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
            Read-only
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <form
          aria-label="World calendar configuration"
          className="grid gap-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <CalendarEditableFields
            config={draftConfig}
            errors={validationErrors}
            onChange={(config) => {
              setDraftConfig(config);
              setValidationErrors(emptyCalendarValidationErrors);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save aria-hidden="true" />
              Save calendar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetDraftConfig}
              disabled={saveMutation.isPending}
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
          </div>
        </form>
      ) : (
        <CalendarReadOnlySummary config={draftConfig} />
      )}
    </div>
  );
}
