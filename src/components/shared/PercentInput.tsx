import { type ComponentProps, type JSX } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PercentInputProps = Omit<
  ComponentProps<"input">,
  "max" | "min" | "onChange" | "step" | "type" | "value"
> & {
  readonly onChange: (value: number) => void;
  readonly value: number;
};

// Displays a 0–1 float as a whole-number percentage; calls onChange with a 0–1 float.
export function PercentInput({
  className,
  onChange,
  value,
  ...rest
}: PercentInputProps): JSX.Element {
  return (
    <div className="relative flex items-center">
      <Input
        {...rest}
        type="number"
        className={cn("pr-8", className)}
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(event) => {
          onChange(Number(event.currentTarget.value) / 100);
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 text-sm text-muted-foreground"
      >
        %
      </span>
    </div>
  );
}
