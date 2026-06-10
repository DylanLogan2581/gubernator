import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notifyMutationError } from "@/lib/notify";

import { setNationHiddenMutationOptions } from "../../mutations/nationsMutations";

import type { Nation } from "../../types/nationTypes";
import type { JSX } from "react";

export function NationHiddenToggleSection({
  nation,
  queryClient,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const setHiddenMutation = useMutation(
    setNationHiddenMutationOptions({ queryClient }),
  );

  function handleToggle(): void {
    setHiddenMutation.reset();
    setHiddenMutation.mutate(
      {
        isHidden: !nation.isHidden,
        nationId: nation.id,
        worldId: nation.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update nation.");
        },
      },
    );
  }

  return (
    <section aria-labelledby="nation-hidden-heading" className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 id="nation-hidden-heading" className="text-base font-medium">
            Visibility
          </h2>
          <p className="text-sm text-muted-foreground">
            {nation.isHidden
              ? "This nation is hidden from non-administrators."
              : "This nation is visible to all world members."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleToggle}
          disabled={setHiddenMutation.isPending}
        >
          {nation.isHidden ? (
            <Eye aria-hidden="true" />
          ) : (
            <EyeOff aria-hidden="true" />
          )}
          {nation.isHidden ? "Show nation" : "Hide nation"}
        </Button>
      </div>
    </section>
  );
}
