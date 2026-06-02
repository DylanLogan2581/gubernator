import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import * as React from "react";

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>): React.JSX.Element {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<
  typeof CollapsiblePrimitive.Trigger
>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<
  typeof CollapsiblePrimitive.Content
>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Content data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
