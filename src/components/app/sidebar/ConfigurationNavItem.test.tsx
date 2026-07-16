import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ConfigurationNavItem } from "./ConfigurationNavItem";

import type { ReactNode } from "react";

const { useLocationMock, useSearchMock } = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useSearchMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...rest
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly search?: Readonly<Record<string, string>>;
    readonly to: string;
    readonly [key: string]: unknown;
  }) => {
    const withParams =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    const href =
      search?.tab === undefined
        ? withParams
        : `${withParams}?tab=${search.tab}`;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
  useLocation: useLocationMock,
  useSearch: useSearchMock,
}));

const WORLD_ID = "world-42";

describe("ConfigurationNavItem", () => {
  it("renders every config tab from the shared list, excluding World Settings for non-super-admins", () => {
    useLocationMock.mockReturnValue({
      pathname: `/worlds/${WORLD_ID}/configuration`,
    });
    useSearchMock.mockReturnValue({ tab: "resources" });

    renderItem({ isSuperAdmin: false });

    expect(screen.getByRole("link", { name: /Resources/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /Images/ })).toBeDefined();
    expect(screen.queryByRole("link", { name: /World Settings/ })).toBeNull();
  });

  it("includes World Settings for super admins", () => {
    useLocationMock.mockReturnValue({
      pathname: `/worlds/${WORLD_ID}/configuration`,
    });
    useSearchMock.mockReturnValue({ tab: "resources" });

    renderItem({ isSuperAdmin: true });

    expect(screen.getByRole("link", { name: /World Settings/ })).toBeDefined();
  });

  it("marks the active tab's link as active and other tabs as inactive", () => {
    useLocationMock.mockReturnValue({
      pathname: `/worlds/${WORLD_ID}/configuration`,
    });
    useSearchMock.mockReturnValue({ tab: "calendar" });

    renderItem({ isSuperAdmin: false });

    const calendarLink = screen.getByRole("link", { name: /Calendar/ });
    const resourcesLink = screen.getByRole("link", { name: /Resources/ });
    expect(calendarLink).toHaveAttribute("data-active", "true");
    expect(resourcesLink).toHaveAttribute("data-active", "false");
  });

  it("renders a right-side dropdown menu instead of a collapsible when the sidebar is collapsed", async () => {
    useLocationMock.mockReturnValue({
      pathname: `/worlds/${WORLD_ID}/configuration`,
    });
    useSearchMock.mockReturnValue({ tab: "resources" });

    const { user } = renderItem({ isSuperAdmin: false, defaultOpen: false });

    expect(screen.queryByRole("menuitem", { name: /Resources/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Configuration" }));

    expect(screen.getByRole("menuitem", { name: /Resources/ })).toBeDefined();
  });
});

function renderItem({
  defaultOpen = true,
  isSuperAdmin,
}: {
  readonly defaultOpen?: boolean;
  readonly isSuperAdmin: boolean;
}): ReturnType<typeof render> & {
  readonly user: ReturnType<typeof userEvent.setup>;
} {
  const user = userEvent.setup();
  return {
    ...render(
      <TooltipProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <ConfigurationNavItem
            isSuperAdmin={isSuperAdmin}
            worldId={WORLD_ID}
          />
        </SidebarProvider>
      </TooltipProvider>,
    ),
    user,
  };
}
