import { Archive, ArchiveRestore } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";

type TrashToggleButtonProps = {
  readonly isActive: boolean;
  readonly onClick: () => void;
};

export function TrashToggleButton({
  isActive,
  onClick,
}: TrashToggleButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      aria-label={isActive ? "Hide trash" : "Show trash"}
      aria-pressed={isActive}
      title={isActive ? "Hide trash" : "Show trash"}
      onClick={onClick}
    >
      {isActive ? (
        <ArchiveRestore aria-hidden="true" />
      ) : (
        <Archive aria-hidden="true" />
      )}
      Trash
    </Button>
  );
}
