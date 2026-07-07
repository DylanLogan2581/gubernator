import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

import type { JSX } from "react";

type BlockerOpts = {
  readonly enableBeforeUnload: boolean;
  readonly shouldBlockFn: () => boolean;
  readonly withResolver: boolean;
};

type BlockerResult = {
  readonly proceed?: () => void;
  readonly reset?: () => void;
  readonly status: "blocked" | "idle";
};

const { useBlockerMock } = vi.hoisted(() => ({
  useBlockerMock: vi.fn<(opts: BlockerOpts) => BlockerResult>(),
}));

vi.mock("@tanstack/react-router", () => ({
  useBlocker: useBlockerMock,
}));

function GuardHost({ isDirty }: { readonly isDirty: boolean }): JSX.Element {
  const dialog = useUnsavedChangesGuard(isDirty);
  return <>{dialog}</>;
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    useBlockerMock.mockReset();
  });

  it("passes the current dirty state to shouldBlockFn and enableBeforeUnload", () => {
    useBlockerMock.mockReturnValue({ status: "idle" });

    render(<GuardHost isDirty={true} />);

    const opts = useBlockerMock.mock.calls[0][0];
    expect(opts.shouldBlockFn()).toBe(true);
    expect(opts.enableBeforeUnload).toBe(true);
    expect(opts.withResolver).toBe(true);
  });

  it("renders no dialog when the blocker is idle", () => {
    useBlockerMock.mockReturnValue({ status: "idle" });

    render(<GuardHost isDirty={true} />);

    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("stays on the page when the blocked prompt is dismissed", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const proceed = vi.fn();
    useBlockerMock.mockReturnValue({ status: "blocked", proceed, reset });

    render(<GuardHost isDirty={true} />);

    expect(screen.getByText("Unsaved changes")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Stay" }));

    expect(reset).toHaveBeenCalledOnce();
    expect(proceed).not.toHaveBeenCalled();
  });

  it("proceeds with navigation when changes are discarded", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const proceed = vi.fn();
    useBlockerMock.mockReturnValue({ status: "blocked", proceed, reset });

    render(<GuardHost isDirty={true} />);

    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(proceed).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });
});
