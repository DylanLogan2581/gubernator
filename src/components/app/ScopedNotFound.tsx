import { Link } from "@tanstack/react-router";
import { MapPinOff } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export type ScopedNotFoundProps = {
  title: string;
  description: string;
  backTo: string;
  backToLabel: string;
}

export function ScopedNotFound({
  title,
  description,
  backTo,
  backToLabel,
}: ScopedNotFoundProps): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <EmptyState
        icon={MapPinOff}
        title={title}
        description={description}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={backTo}>{backToLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}
