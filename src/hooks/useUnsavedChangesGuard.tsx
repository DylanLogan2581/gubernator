import { useBlocker } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { ReactNode } from "react";

// Blocks in-app navigation (tab switches, sidebar links) and browser
// unload while a draft config panel has unsaved changes. Render the
// returned dialog alongside the panel; it stays hidden until a blocked
// navigation attempt occurs.
export function useUnsavedChangesGuard(isDirty: boolean): ReactNode {
  const blocker = useBlocker({
    enableBeforeUnload: isDirty,
    shouldBlockFn: () => isDirty,
    withResolver: true,
  });

  return (
    <AlertDialog open={blocker.status === "blocked"}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes on this page. Discard them and leave?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2">
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            Stay
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>
            Discard changes
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
