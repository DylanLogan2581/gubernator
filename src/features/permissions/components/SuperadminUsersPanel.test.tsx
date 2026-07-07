import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthModule from "@/features/auth";

import { SuperadminUsersPanel } from "./SuperadminUsersPanel";

import type * as SuperadminQueriesModule from "../queries/superadminQueries";
import type { SuperadminUser } from "../types/superadminTypes";
import type { ReactNode } from "react";

const { mockCurrentAppUser } = vi.hoisted(() => ({
  mockCurrentAppUser: vi.fn(),
}));

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthModule>();
  return {
    ...actual,
    currentAppUserQueryOptions: () => ({
      queryFn: mockCurrentAppUser,
      queryKey: ["test", "current-app-user"],
    }),
  };
});

const { mockAllUsers } = vi.hoisted(() => ({
  mockAllUsers: vi.fn(),
}));

vi.mock("../queries/superadminQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof SuperadminQueriesModule>();
  return {
    ...actual,
    allUsersForSuperadminQueryOptions: () => ({
      queryFn: mockAllUsers,
      queryKey: ["test", "all-users"],
    }),
  };
});

function createUser(overrides: Partial<SuperadminUser> = {}): SuperadminUser {
  return {
    created_at: "2024-01-05T12:00:00.000Z",
    email: "riley@example.com",
    id: "user-1",
    is_super_admin: false,
    status: "active",
    updated_at: "2024-01-05T12:00:00.000Z",
    username: "riley",
    ...overrides,
  };
}

describe("SuperadminUsersPanel", () => {
  beforeEach(() => {
    mockCurrentAppUser.mockReset();
    mockAllUsers.mockReset();
    mockCurrentAppUser.mockResolvedValue(
      createUser({ id: "admin-1", is_super_admin: true, username: "admin" }),
    );
  });

  it("shows an access-denied state for a non-superadmin", async () => {
    mockCurrentAppUser.mockResolvedValue(createUser({ is_super_admin: false }));
    mockAllUsers.mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText("Access denied")).toBeDefined();
  });

  it("renders the joined date via the shared date formatter, not a raw ISO slice", async () => {
    mockAllUsers.mockResolvedValue([createUser()]);

    renderPanel();

    expect(await screen.findByText("Jan 5, 2024")).toBeDefined();
    expect(screen.queryByText("2024-01-05")).toBeNull();
  });

  it("collapses row actions into a single dropdown menu trigger", async () => {
    mockAllUsers.mockResolvedValue([createUser()]);

    renderPanel();

    await screen.findByText("riley");

    expect(screen.queryByRole("button", { name: "World Admin" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Actions for riley" }),
    ).toBeDefined();
  });

  it("opens the toggle-superadmin dialog from the row actions menu", async () => {
    mockAllUsers.mockResolvedValue([createUser()]);
    const user = userEvent.setup();

    renderPanel();

    await screen.findByText("riley");
    await user.click(screen.getByRole("button", { name: "Actions for riley" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Grant superadmin" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Grant superadmin" }),
    ).toBeDefined();
  });

  it("filters users by the search input", async () => {
    mockAllUsers.mockResolvedValue([
      createUser({ id: "user-1", username: "riley" }),
      createUser({ id: "user-2", email: "sam@example.com", username: "sam" }),
    ]);
    const user = userEvent.setup();

    renderPanel();

    await screen.findByText("riley");
    await user.type(
      screen.getByPlaceholderText("Search by email or username…"),
      "sam",
    );

    expect(screen.queryByText("riley")).toBeNull();
    expect(screen.getByText("sam")).toBeDefined();
  });
});

function renderPanel(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <Wrapper queryClient={queryClient}>
      <SuperadminUsersPanel />
    </Wrapper>,
  );
}

function Wrapper({
  children,
  queryClient,
}: {
  readonly children: ReactNode;
  readonly queryClient: QueryClient;
}): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
