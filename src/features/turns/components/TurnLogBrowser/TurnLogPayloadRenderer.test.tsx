import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TurnLogPayloadRenderer } from "./TurnLogPayloadRenderer";

// Use an unrecognised category to exercise RawJsonFallback (the default branch).
const UNKNOWN_CATEGORY = "unknown.event";
const NON_EMPTY_PAYLOAD = { value: 42 };
const EMPTY_PAYLOAD = {};

describe("TurnLogPayloadRenderer — RawJsonFallback", () => {
  describe("admin visibility", () => {
    it("shows 'show payload' toggle for admins with non-empty payload", () => {
      render(
        <TurnLogPayloadRenderer
          logCategory={UNKNOWN_CATEGORY}
          payload={NON_EMPTY_PAYLOAD}
          isAdmin={true}
        />,
      );

      expect(
        screen.getByRole("button", { name: /show payload/i }),
      ).toBeDefined();
    });

    it("hides 'show payload' toggle for non-admins", () => {
      render(
        <TurnLogPayloadRenderer
          logCategory={UNKNOWN_CATEGORY}
          payload={NON_EMPTY_PAYLOAD}
          isAdmin={false}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /show payload/i }),
      ).toBeNull();
    });

    it("hides 'show payload' toggle when isAdmin is omitted (default false)", () => {
      render(
        <TurnLogPayloadRenderer
          logCategory={UNKNOWN_CATEGORY}
          payload={NON_EMPTY_PAYLOAD}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /show payload/i }),
      ).toBeNull();
    });

    it("hides 'show payload' toggle for admins when payload is empty object", () => {
      render(
        <TurnLogPayloadRenderer
          logCategory={UNKNOWN_CATEGORY}
          payload={EMPTY_PAYLOAD}
          isAdmin={true}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /show payload/i }),
      ).toBeNull();
    });

    it("hides 'show payload' toggle for admins when payload is null", () => {
      render(
        <TurnLogPayloadRenderer
          logCategory={UNKNOWN_CATEGORY}
          payload={null}
          isAdmin={true}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /show payload/i }),
      ).toBeNull();
    });
  });

  describe("toggle behaviour", () => {
    it("expands payload on first click and collapses on second", async () => {
      const user = userEvent.setup();
      render(
        <TurnLogPayloadRenderer
          logCategory={UNKNOWN_CATEGORY}
          payload={NON_EMPTY_PAYLOAD}
          isAdmin={true}
        />,
      );

      const trigger = screen.getByRole("button", { name: /show payload/i });

      // Payload hidden before first click.
      expect(
        screen.queryByRole("button", { name: /hide payload/i }),
      ).toBeNull();

      await user.click(trigger);

      // After first click: payload visible, button label changes.
      expect(
        screen.getByRole("button", { name: /hide payload/i }),
      ).toBeDefined();
      expect(screen.getByText(/"value": 42/)).toBeDefined();

      const hideButton = screen.getByRole("button", { name: /hide payload/i });
      await user.click(hideButton);

      // After second click: back to hidden.
      expect(
        screen.getByRole("button", { name: /show payload/i }),
      ).toBeDefined();
      expect(screen.queryByText(/"value": 42/)).toBeNull();
    });

    it("does not fire parent click handler when toggle is clicked", async () => {
      const parentClick = vi.fn();
      const user = userEvent.setup();

      render(
        // Simulate the table row wrapper that has its own onClick.
        <div onClick={parentClick} role="row">
          <TurnLogPayloadRenderer
            logCategory={UNKNOWN_CATEGORY}
            payload={NON_EMPTY_PAYLOAD}
            isAdmin={true}
          />
        </div>,
      );

      await user.click(screen.getByRole("button", { name: /show payload/i }));

      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
