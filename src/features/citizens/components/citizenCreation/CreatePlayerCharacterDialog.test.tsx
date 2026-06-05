import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreatePlayerCharacterDialog } from "./CreatePlayerCharacterDialog";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));
vi.mock("@/lib/supabase", () => ({ requireSupabaseClient }));

const { citizensHaveCloseKinship } = vi.hoisted(() => ({
  citizensHaveCloseKinship: vi.fn<() => Promise<boolean>>(),
}));
vi.mock("../../queries/citizenKinshipQueries", () => ({
  citizensHaveCloseKinship,
}));

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

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000030";
const CITIZEN_A_ID = "11111111-1111-1111-1111-111111111111";
const CITIZEN_B_ID = "22222222-2222-2222-2222-222222222222";
const NEW_CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type CitizenRow = {
  readonly born_on_turn_number: number | null;
  readonly citizen_type: "npc" | "player_character";
  readonly created_at: string;
  readonly death_cause: string | null;
  readonly given_name: string;
  readonly id: string;
  readonly name: string;
  readonly npc_flaw: string | null;
  readonly npc_goal: string | null;
  readonly npc_secret_contradiction: string | null;
  readonly npc_trait_1: string | null;
  readonly npc_trait_2: string | null;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
  readonly personality_text: string | null;
  readonly profile_photo_url: string | null;
  readonly role_nation_id: string | null;
  readonly role_settlement_id: string | null;
  readonly role_type: "none" | "nation_manager" | "settlement_manager";
  readonly settlement_id: string | null;
  readonly sex: string | null;
  readonly skills_text: string | null;
  readonly status: "alive" | "dead";
  readonly surname: string | null;
  readonly updated_at: string;
  readonly user_id: string | null;
  readonly world_id: string;
};

type UserRow = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

function createCitizenRow(overrides: Partial<CitizenRow> = {}): CitizenRow {
  return {
    born_on_turn_number: null,
    citizen_type: "player_character",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    given_name: "New Character",
    id: NEW_CITIZEN_ID,
    name: "New Character",
    npc_flaw: null,
    npc_goal: null,
    npc_secret_contradiction: null,
    npc_trait_1: null,
    npc_trait_2: null,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    personality_text: null,
    profile_photo_url: null,
    role_nation_id: null,
    role_settlement_id: null,
    role_type: "none",
    settlement_id: SETTLEMENT_ID,
    sex: null,
    skills_text: null,
    status: "alive",
    surname: null,
    updated_at: "2026-05-01T00:00:00.000Z",
    user_id: USER_ID,
    world_id: WORLD_ID,
    ...overrides,
  };
}

const CITIZEN_A_ROW = createCitizenRow({
  id: CITIZEN_A_ID,
  name: "Alice",
  citizen_type: "npc",
  user_id: null,
});
const CITIZEN_B_ROW = createCitizenRow({
  id: CITIZEN_B_ID,
  name: "Bob",
  citizen_type: "npc",
  user_id: null,
});

const USER_ROW: UserRow = {
  created_at: "2026-01-01T00:00:00.000Z",
  email: "testuser@example.com",
  id: USER_ID,
  is_super_admin: false,
  status: "active",
  updated_at: "2026-01-01T00:00:00.000Z",
  username: "testuser",
};

const rpcMock = vi.fn();

function createClient(
  citizenRows: CitizenRow[] = [],
  userRows: UserRow[] = [],
): unknown {
  const citizensChain: Record<string, unknown> = {};
  citizensChain.select = vi.fn(() => citizensChain);
  citizensChain.eq = vi.fn(() => citizensChain);
  citizensChain.order = vi.fn(() => citizensChain);
  citizensChain.returns = vi
    .fn()
    .mockResolvedValue({ data: citizenRows, error: null });

  const usersChain: Record<string, unknown> = {};
  usersChain.select = vi.fn(() => usersChain);
  usersChain.eq = vi.fn(() => usersChain);
  usersChain.order = vi.fn().mockResolvedValue({ data: userRows, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "citizens") return citizensChain;
      if (table === "users") return usersChain;
      throw new Error(`Unexpected table in mock: ${table}`);
    }),
    rpc: rpcMock,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

describe("CreatePlayerCharacterDialog", () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    rpcMock.mockReset();
    citizensHaveCloseKinship.mockReset();
    onClose.mockReset();
    onCreated.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  function renderDialog(
    options: {
      citizenRows?: CitizenRow[];
      userRows?: UserRow[];
    } = {},
  ): void {
    const { citizenRows = [], userRows = [USER_ROW] } = options;
    requireSupabaseClient.mockReturnValue(createClient(citizenRows, userRows));
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CreatePlayerCharacterDialog
          incestPreventionDepth={4}
          onClose={onClose}
          onCreated={onCreated}
          queryClient={queryClient}
          settlementId={SETTLEMENT_ID}
          worldId={WORLD_ID}
        />
      </QueryClientProvider>,
    );
  }

  it("does not call the mutation when the name is blank", async () => {
    renderDialog();

    await screen.findByRole("option", { name: "testuser" });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "User" }),
      USER_ID,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create player character" }),
    );

    expect(rpcMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an error and does not call the mutation when no user is selected", async () => {
    renderDialog();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Given name" }),
      "Newborn",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create player character" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pick a user to link the player character to.",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("shows a pairing error and does not call the mutation when the same citizen is selected as both parents", async () => {
    renderDialog({ citizenRows: [CITIZEN_A_ROW, CITIZEN_B_ROW] });

    await screen.findByRole("option", { name: "testuser" });
    await screen.findAllByRole("option", { name: "Alice" });

    await userEvent.type(
      screen.getByRole("textbox", { name: "Given name" }),
      "Newborn",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "User" }),
      USER_ID,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent A" }),
      CITIZEN_A_ID,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent B" }),
      CITIZEN_A_ID,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Create player character" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A citizen cannot be both parents.",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("shows a kinship error and does not call the mutation when parents share a close ancestor", async () => {
    citizensHaveCloseKinship.mockResolvedValue(true);
    renderDialog({ citizenRows: [CITIZEN_A_ROW, CITIZEN_B_ROW] });

    await screen.findByRole("option", { name: "testuser" });
    await screen.findAllByRole("option", { name: "Alice" });

    await userEvent.type(
      screen.getByRole("textbox", { name: "Given name" }),
      "Newborn",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "User" }),
      USER_ID,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent A" }),
      CITIZEN_A_ID,
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent B" }),
      CITIZEN_B_ID,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Create player character" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Parents share a common ancestor within 4 generations.",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("emits an error toast when the creation RPC fails", async () => {
    rpcMock.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    renderDialog();

    await screen.findByRole("option", { name: "testuser" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Given name" }),
      "Newborn",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "User" }),
      USER_ID,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create player character" }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Player character could not be created."),
      );
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("calls the mutation with the correct arguments and closes the dialog on success", async () => {
    const newRow = createCitizenRow({ name: "Newborn" });
    rpcMock.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: newRow, error: null }),
    });
    renderDialog();

    await screen.findByRole("option", { name: "testuser" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Given name" }),
      "Newborn",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "User" }),
      USER_ID,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create player character" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_player_character",
        expect.objectContaining({
          p_given_name: "Newborn",
          p_settlement_id: SETTLEMENT_ID,
          p_world_id: WORLD_ID,
          p_user_id: USER_ID,
          p_parent_a_citizen_id: undefined,
          p_parent_b_citizen_id: undefined,
        }),
      );
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Player character created.",
      undefined,
    );
    expect(toastError).not.toHaveBeenCalled();
  });
});
