import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";

import type { JSX } from "react";

export type AdminSuppressedNoticeProps = {
  readonly title?: string;
};

// Shown wherever admin-only UI would otherwise render empty or silently
// bounce the viewer away because an active player character suppresses
// `canAdmin`. Names the cause and offers the same one-click fix as the
// persistent indicator in the world context bar.
export function AdminSuppressedNotice({
  title = "Admin access paused",
}: AdminSuppressedNoticeProps): JSX.Element {
  const { activeCharacter, clear, isPending } = useActivePlayerCharacter();
  const characterName = activeCharacter?.name ?? "your active character";

  return (
    <EmptyState
      icon={ShieldAlert}
      title={title}
      description={`Admin access is paused while you're acting as ${characterName}. Clear your active character to restore it.`}
      action={
        <Button
          disabled={isPending}
          onClick={clear}
          size="sm"
          variant="outline"
        >
          Clear active character
        </Button>
      }
    />
  );
}
