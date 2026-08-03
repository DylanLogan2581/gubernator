// The fake descriptor's query options intentionally use static query keys with
// closed-over test data; exhaustive-deps does not apply to inline test stubs.
/* eslint-disable @tanstack/query/exhaustive-deps */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteLoreEntityDialog } from "./DeleteLoreEntityDialog";

import type {
  LoreEntityBase,
  LoreEntityDescriptor,
  LoreEntityUsage,
} from "./LoreEntityTypes";

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const ENTITY_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_ENTITY_ID = "00000000-0000-0000-0000-000000000003";

type TestDeleteInput = {
  readonly entityId: string;
  readonly reassignToId: string | null;
  readonly worldId: string;
};

function makeEntity(overrides: Partial<LoreEntityBase> = {}): LoreEntityBase {
  return {
    color: "#6b7280",
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    id: ENTITY_ID,
    name: "Coastal Folk",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: WORLD_ID,
    ...overrides,
  };
}

const ENTITY = makeEntity();
const OTHER_ENTITY = makeEntity({ id: OTHER_ENTITY_ID, name: "Mountain Folk" });

function makeDescriptor({
  deleteFn,
  entities,
  usage,
}: {
  readonly deleteFn: (input: TestDeleteInput) => Promise<unknown>;
  readonly entities: readonly LoreEntityBase[];
  readonly usage: LoreEntityUsage;
}): LoreEntityDescriptor<
  LoreEntityBase,
  unknown,
  unknown,
  TestDeleteInput,
  Error
> {
  return {
    buildDeleteInput: ({
      id,
      reassignToId,
      worldId,
    }: {
      readonly id: string;
      readonly reassignToId: string | null;
      readonly worldId: string;
    }) => ({
      entityId: id,
      reassignToId,
      worldId,
    }),
    labels: {
      plural: "cultures",
      pluralCapital: "Cultures",
      singular: "culture",
      singularCapital: "Culture",
    },
    mutations: {
      delete: () => ({ mutationFn: deleteFn }),
    },
    queries: {
      byWorld: () => ({
        queryFn: () => Promise.resolve(entities),
        queryKey: ["test", "by-world"],
      }),
      usage: () => ({
        queryFn: () => Promise.resolve(usage),
        queryKey: ["test", "usage"],
      }),
    },
    // Fields not exercised by the delete dialog.
  } as unknown as LoreEntityDescriptor<
    LoreEntityBase,
    unknown,
    unknown,
    TestDeleteInput,
    Error
  >;
}

function renderDialog(descriptor: ReturnType<typeof makeDescriptor>): void {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DeleteLoreEntityDialog
        descriptor={descriptor}
        entity={ENTITY}
        queryClient={new QueryClient()}
        worldId={WORLD_ID}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("DeleteLoreEntityDialog", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows usage counts and deletes with a null reassignment target by default", async () => {
    const user = userEvent.setup();
    const deleteFn = vi.fn<(input: TestDeleteInput) => Promise<unknown>>(() =>
      Promise.resolve({}),
    );
    renderDialog(
      makeDescriptor({
        deleteFn,
        entities: [ENTITY, OTHER_ENTITY],
        usage: { citizenCount: 3, nationCount: 2 },
      }),
    );

    await screen.findByText(
      '3 citizens and 2 nations currently reference "Coastal Folk".',
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteFn.mock.calls[0]?.[0]).toEqual({
        entityId: ENTITY_ID,
        reassignToId: null,
        worldId: WORLD_ID,
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Culture deleted.", undefined);
  });

  it("deletes with the selected reassignment target", async () => {
    const user = userEvent.setup();
    const deleteFn = vi.fn<(input: TestDeleteInput) => Promise<unknown>>(() =>
      Promise.resolve({}),
    );
    renderDialog(
      makeDescriptor({
        deleteFn,
        entities: [ENTITY, OTHER_ENTITY],
        usage: { citizenCount: 1, nationCount: 0 },
      }),
    );

    const select = await screen.findByRole("combobox", {
      name: "Reassign references to",
    });
    await user.selectOptions(select, OTHER_ENTITY_ID);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteFn.mock.calls[0]?.[0]).toEqual({
        entityId: ENTITY_ID,
        reassignToId: OTHER_ENTITY_ID,
        worldId: WORLD_ID,
      });
    });
  });

  it("clears the reassignment option when only one entity exists", async () => {
    renderDialog(
      makeDescriptor({
        deleteFn: () => Promise.resolve({}),
        entities: [ENTITY],
        usage: { citizenCount: 1, nationCount: 0 },
      }),
    );

    expect(
      await screen.findByText(
        /References will be cleared — no other cultures exist/,
      ),
    ).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: "Reassign references to" }),
    ).toBeNull();
  });

  it("shows a plain confirm and no reassignment UI when nothing references the entity", async () => {
    renderDialog(
      makeDescriptor({
        deleteFn: () => Promise.resolve({}),
        entities: [ENTITY, OTHER_ENTITY],
        usage: { citizenCount: 0, nationCount: 0 },
      }),
    );

    expect(
      await screen.findByText('Delete "Coastal Folk"? Nothing references it.'),
    ).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: "Reassign references to" }),
    ).toBeNull();
  });
});
