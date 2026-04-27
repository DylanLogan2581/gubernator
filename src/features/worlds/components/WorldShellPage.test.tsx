import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldShellPage } from "./WorldShellPage";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("WorldShellPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders authorized world context", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            current_turn_number: 7,
            id: "00000000-0000-0000-0000-000000000101",
            name: "Eastern Marches",
            owner_id: "user-1",
            visibility: "private",
          }),
        ],
      }),
    );

    renderWorldShellPage("eastern-marches-00000000");

    expect(
      await screen.findByRole("heading", { name: "Eastern Marches" }),
    ).toBeDefined();
    expect(screen.getByText("Current turn")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("private")).toBeDefined();
  });

  it("renders archived worlds as read-only", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            archived_at: "2026-01-03T00:00:00.000Z",
            id: "00000000-0000-0000-0000-000000000202",
            name: "Archived Realm",
            owner_id: "user-1",
            status: "archived",
          }),
        ],
      }),
    );

    renderWorldShellPage("archived-realm-00000000");

    expect(
      await screen.findByRole("heading", { name: "Archived Realm" }),
    ).toBeDefined();
    expect(screen.getByText("Read-only archive")).toBeDefined();
    expect(screen.getByText(/gameplay actions are read-only/i)).toBeDefined();
  });
});

function renderWorldShellPage(worldSlug: string): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldShellPage worldSlug={worldSlug} />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createClient({
  adminRows = [],
  session,
  worldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly worldRows?: readonly TestWorldRow[];
}): unknown {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(createUser(session.user.id));
      }

      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder(adminRows);
      }

      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

function createUser(id: string): TestUser {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    id,
    is_super_admin: false,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: id,
  };
}

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: "00000000-0000-0000-0000-000000000001",
    name: "World",
    owner_id: "user-1",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function createUsersQueryBuilder(user: TestUser): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null }),
      })),
    })),
  };
}

function createWorldAdminsQueryBuilder(
  rows: readonly { readonly world_id: string }[],
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  };
}

function createWorldsQueryBuilder(rows: readonly TestWorldRow[]): unknown {
  return {
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  };
}
