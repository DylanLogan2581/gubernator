import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { type JSX, useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError } from "@/lib/notify";

import { setNotificationPreferenceMutationOptions } from "../mutations/notificationPreferencesMutations";
import {
  notificationPreferencesQueryOptions,
  type NotificationPreference,
} from "../queries/notificationPreferencesQueries";
import { formatNotificationTypeLabel } from "../utils/notificationTypeLabels";

type NotificationPreferencesSheetProps = {
  readonly userId: string | null;
};

export function NotificationPreferencesSheet({
  userId,
}: NotificationPreferencesSheetProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Notification preferences"
        >
          <Settings aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notification preferences</SheetTitle>
          <SheetDescription>
            Turn off types you don&apos;t want to see. They stay hidden from
            your list and unread count until you turn them back on — nothing is
            deleted.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
          {open ? <NotificationPreferencesList userId={userId} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotificationPreferencesList({
  userId,
}: {
  readonly userId: string | null;
}): JSX.Element {
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery(
    notificationPreferencesQueryOptions(userId),
  );
  const setPreferenceMutation = useMutation(
    setNotificationPreferenceMutationOptions({ queryClient }),
  );

  if (preferencesQuery.isPending) {
    return <LoadingState label="Loading notification preferences…" />;
  }

  if (preferencesQuery.isError) {
    return (
      <ErrorState
        title="Notification preferences could not be loaded"
        description={getErrorDescription(preferencesQuery.error)}
      />
    );
  }

  const handleToggle = (
    preference: NotificationPreference,
    enabled: boolean,
  ): void => {
    if (userId === null) {
      return;
    }

    setPreferenceMutation.mutate(
      { enabled, notificationType: preference.notificationType, userId },
      {
        onError: (error) => {
          notifyMutationError(
            error,
            "Could not update notification preference.",
          );
        },
      },
    );
  };

  return (
    <>
      {preferencesQuery.data.map((preference) => {
        const inputId = `notification-preference-${preference.notificationType}`;
        return (
          <div
            key={preference.notificationType}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
          >
            <Label htmlFor={inputId} className="font-normal">
              {formatNotificationTypeLabel(preference.notificationType)}
            </Label>
            <Switch
              id={inputId}
              checked={preference.enabled}
              onCheckedChange={(enabled) => {
                handleToggle(preference, enabled);
              }}
            />
          </div>
        );
      })}
    </>
  );
}
