import { render } from "@testing-library/react";
import { Bell } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconChip } from "./IconChip";

describe("IconChip", () => {
  it("applies the destructive tone's tint classes", () => {
    const { container } = render(<IconChip icon={Bell} tone="destructive" />);

    expect(container.firstElementChild).toHaveClass(
      "bg-destructive/10",
      "text-destructive",
    );
  });

  it("applies the default tone's tint classes", () => {
    const { container } = render(<IconChip icon={Bell} />);

    expect(container.firstElementChild).toHaveClass(
      "bg-muted",
      "text-muted-foreground",
    );
  });
});
