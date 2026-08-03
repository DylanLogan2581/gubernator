import { ShieldAlert } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";

import type { JSX } from "react";

export type AdminPausedHintProps = {
  readonly canAdmin: boolean;
};

// Inline hint for admin-capable pages that keep rendering their normal
// (view-only) content when useEffectiveCanAdmin suppresses `canAdmin`
// because a play character is active. Unlike AdminSuppressedNotice, which
// replaces an admin-only page entirely, this is meant to sit alongside
// content that non-admins can also see, so the viewer understands why edit
// affordances are missing instead of assuming they vanished. Offers the
// same explicit Admin-mode switch as the persistent indicator in the world
// context bar (see issue #978 — a bare clear races auto-select).
export function AdminPausedHint({
  canAdmin,
}: AdminPausedHintProps): JSX.Element | null {
  const { activeCharacter, clear, isPending } = useActivePlayerCharacter();

  if (!canAdmin || activeCharacter === null) {
    return null;
  }

  return (
    <Alert variant="warning">
      <ShieldAlert />
      <AlertTitle>Admin controls are paused</AlertTitle>
      <AlertDescription>
        Playing as {activeCharacter.name} — switch to Admin to restore them.
      </AlertDescription>
      <AlertAction>
        <Button
          disabled={isPending}
          onClick={clear}
          size="sm"
          variant="outline"
        >
          Switch to Admin
        </Button>
      </AlertAction>
    </Alert>
  );
}
