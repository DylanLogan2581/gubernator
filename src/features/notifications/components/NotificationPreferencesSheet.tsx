import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { type JSX, useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  groupNotificationPreferencesByCategory,
  type NotificationPreferenceCategory,
} from "../utils/notificationCategories";
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

  const categories = groupNotificationPreferencesByCategory(
    preferencesQuery.data ?? [],
  );

  const [categoriesInitialized, setCategoriesInitialized] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  if (!categoriesInitialized && preferencesQuery.data !== undefined) {
    setCategoriesInitialized(true);
    setOpenCategories(
      categories
        .filter((category) => category.isMixed)
        .map((category) => category.key),
    );
  }

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

  const handleToggleCategory = (
    category: NotificationPreferenceCategory,
    enabled: boolean,
  ): void => {
    for (const preference of category.preferences) {
      if (preference.enabled !== enabled) {
        handleToggle(preference, enabled);
      }
    }
  };

  return (
    <Accordion
      type="multiple"
      value={openCategories}
      onValueChange={setOpenCategories}
    >
      {categories.map((category) => (
        <AccordionItem key={category.key} value={category.key}>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-2">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex w-full items-center justify-between gap-2 pr-2">
                <span className="truncate">{category.label}</span>
                <span className="shrink-0 font-normal text-muted-foreground">
                  {category.enabledCount}/{category.preferences.length} on
                </span>
              </span>
            </AccordionTrigger>
            <Switch
              aria-label={
                category.isMixed
                  ? `Toggle all ${category.label} notifications (currently ${category.enabledCount} of ${category.preferences.length} on)`
                  : `Toggle all ${category.label} notifications`
              }
              checked={category.allEnabled}
              data-mixed={category.isMixed}
              className="data-mixed:!bg-primary/40"
              onCheckedChange={(enabled) => {
                handleToggleCategory(category, enabled);
              }}
            />
          </div>
          <AccordionContent>
            {category.preferences.map((preference) => {
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
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
