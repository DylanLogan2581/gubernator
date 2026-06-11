import { Trash2 } from "lucide-react";
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
      size="icon-sm"
      aria-label={isActive ? "Hide trash" : "Show trash"}
      aria-pressed={isActive}
      title={isActive ? "Hide trash" : "Show trash"}
      onClick={onClick}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );
}
