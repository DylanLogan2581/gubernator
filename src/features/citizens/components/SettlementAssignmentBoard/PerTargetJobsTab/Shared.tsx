import { ChevronDown } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function CollapsibleSection({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}): JSX.Element {
  return (
    <Collapsible defaultOpen className="grid gap-2">
      <CollapsibleTrigger className="group flex items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 -rotate-90 transition-transform group-data-[state=open]:rotate-0"
        />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
