import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessContext } from "@/features/permissions";

import { EventCreateWizard } from "./EventCreateWizard";

const WORLD_ID = "00000000-0000-0000-0000-000000000001";

const { useBlockerMock } = vi.hoisted(() => ({
  useBlockerMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useBlocker: useBlockerMock,
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const {
  createEventGroupMutationOptionsMock,
  editEventGroupMutationOptionsMock,
} = vi.hoisted(() => ({
  createEventGroupMutationOptionsMock: vi.fn(),
  editEventGroupMutationOptionsMock: vi.fn(),
}));

vi.mock("../mutations/eventMutations", () => ({
  createEventGroupMutationOptions: createEventGroupMutationOptionsMock,
  editEventGroupMutationOptions: editEventGroupMutationOptionsMock,
  isEventMutationError: (error: unknown): boolean =>
    error instanceof Error && "code" in error,
}));

vi.mock("@/features/calendar", () => ({
  worldCalendarConfigQueryOptions: () => ({
    queryKey: ["calendar-config-test"],
    queryFn: () => Promise.resolve(null),
  }),
}));

vi.mock("@/features/jobs", () => ({
  jobsByWorldQueryOptions: () => ({
    queryKey: ["jobs-test"],
    queryFn: () => Promise.resolve([]),
  }),
}));

vi.mock("@/features/resources", () => ({
  activeResourcesByWorldQueryOptions: () => ({
    queryKey: ["resources-test"],
    queryFn: () => Promise.resolve([]),
  }),
}));

vi.mock("@/features/worlds", () => ({
  worldRouteAccessQueryOptions: () => ({
    queryKey: ["world-route-access-test"],
    queryFn: () =>
      Promise.resolve({
        canAdmin: true,
        canManage: true,
        header: {},
        world: { currentTurnNumber: 4, nextTurnNumber: 5 },
      }),
  }),
}));

type NameDescriptionMockProps = {
  readonly groupName: string;
  readonly groupDescription: string;
  readonly onGroupNameChange: (name: string) => void;
  readonly onGroupDescriptionChange: (desc: string) => void;
};

vi.mock("./steps/EventCreateNameDescriptionStep", () => ({
  EventCreateNameDescriptionStep: ({
    groupName,
    onGroupNameChange,
  }: NameDescriptionMockProps) => (
    <div data-testid="step-name">
      <input
        aria-label="Group name"
        value={groupName}
        onChange={(e) => onGroupNameChange(e.target.value)}
      />
    </div>
  ),
}));

type Step1MockProps = {
  readonly scopeType: "world" | "nation" | "settlement" | null;
  readonly onScopeTypeChange: (type: "world" | "nation" | "settlement") => void;
};

vi.mock("./steps/EventCreateStep1", () => ({
  EventCreateStep1: ({ onScopeTypeChange }: Step1MockProps) => (
    <div data-testid="step-scope-type">
      <button onClick={() => onScopeTypeChange("world")}>Scope: World</button>
      <button onClick={() => onScopeTypeChange("nation")}>Scope: Nation</button>
    </div>
  ),
}));

type Step2MockProps = {
  readonly worldId: string;
  readonly scopeType: "world" | "nation" | "settlement" | null;
  readonly selectedIds: string[];
  readonly onSelectedIdsChange: (ids: string[]) => void;
};

vi.mock("./steps/EventCreateStep2", () => ({
  EventCreateStep2: ({ selectedIds, onSelectedIdsChange }: Step2MockProps) => (
    <div data-testid="step-targets">
      <button onClick={() => onSelectedIdsChange(["nation-1"])}>
        Select nation-1
      </button>
      <span data-testid="selected-count">{selectedIds.length}</span>
    </div>
  ),
}));

type EffectRow = {
  readonly effectType: string;
  readonly isPercent: boolean;
  readonly amountValue: number | null;
  readonly multiplierValue: number | null;
  readonly resourceId: string | null;
  readonly jobId: string | null;
  readonly managedPopulationInstanceId: string | null;
  readonly managedPopulationTypeId: string | null;
  readonly managedPopulationMode: "all" | "type" | "instance" | null;
  readonly depositInstanceId: string | null;
  readonly settlementBuildingId: string | null;
};

const NEW_EFFECT_ROW: EffectRow = {
  effectType: "population_boost",
  isPercent: false,
  amountValue: 10,
  multiplierValue: null,
  resourceId: null,
  jobId: null,
  managedPopulationInstanceId: null,
  managedPopulationTypeId: null,
  managedPopulationMode: null,
  depositInstanceId: null,
  settlementBuildingId: null,
};

type EffectsMockProps = {
  readonly effects: EffectRow[];
  readonly onEffectsChange: (effects: EffectRow[]) => void;
  readonly worldId: string;
  readonly selectedIds: string[];
  readonly scopeType: "world" | "nation" | "settlement" | null;
};

vi.mock("./steps/EventCreateEffectsStep", () => ({
  EventCreateEffectsStep: ({ effects, onEffectsChange }: EffectsMockProps) => (
    <div data-testid="step-effects">
      <button onClick={() => onEffectsChange([...effects, NEW_EFFECT_ROW])}>
        Add effect
      </button>
      <button onClick={() => onEffectsChange(effects.slice(0, -1))}>
        Remove effect
      </button>
      <span data-testid="effect-count">{effects.length}</span>
    </div>
  ),
}));

type Step3MockProps = {
  readonly worldId: string;
  readonly currentTurnNumber: number;
  readonly durationType: "instant" | "sustained";
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly onDurationTypeChange: (type: "instant" | "sustained") => void;
  readonly onDurationTransitionsChange: (trans: number | null) => void;
  readonly onActivationTurnChange: (turn: number) => void;
};

vi.mock("./steps/EventCreateStep3", () => ({
  EventCreateStep3: (_props: Step3MockProps) => (
    <div data-testid="step-duration" />
  ),
}));

type Step4MockProps = {
  readonly createCitizenMemories: boolean;
  readonly groupDescription: string;
  readonly memoryText: string;
  readonly onCreateCitizenMemoriesChange: (create: boolean) => void;
  readonly onMemoryTextChange: (text: string) => void;
  readonly isAlreadyActivated?: boolean;
};

vi.mock("./steps/EventCreateStep4", () => ({
  EventCreateStep4: ({
    memoryText,
    onCreateCitizenMemoriesChange,
    onMemoryTextChange,
  }: Step4MockProps) => (
    <div data-testid="step-memory">
      <button onClick={() => onCreateCitizenMemoriesChange(true)}>
        Record memories
      </button>
      <input
        aria-label="Memory text"
        value={memoryText}
        onChange={(e) => onMemoryTextChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("./steps/EventCreateStep5", () => ({
  EventCreateStep5: () => <div data-testid="step-review" />,
}));

function createAccessContext(
  overrides: Partial<AccessContext> = {},
): AccessContext {
  return {
    canAccessWorld: () => true,
    canAdminWorld: () => true,
    isActiveUser: true,
    isAuthenticated: true,
    isSuperAdmin: false,
    playerCharacterWorldIds: [],
    userId: "00000000-0000-0000-0000-000000000099",
    worldAdminWorldIds: [WORLD_ID],
    ...overrides,
  };
}

function renderWizard(): {
  readonly onClose: ReturnType<typeof vi.fn>;
} {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EventCreateWizard
        accessContext={createAccessContext()}
        worldId={WORLD_ID}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );

  return { onClose };
}

function latestShouldBlockFn(): () => boolean {
  const call = useBlockerMock.mock.calls.at(-1) as
    | [{ shouldBlockFn: () => boolean }]
    | undefined;
  if (call === undefined) {
    throw new Error("useBlocker was not called");
  }
  return call[0].shouldBlockFn;
}

describe("EventCreateWizard", () => {
  let createMutationFn: ReturnType<typeof vi.fn>;
  let editMutationFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    useBlockerMock.mockReset();
    useBlockerMock.mockReturnValue({
      action: undefined,
      current: undefined,
      next: undefined,
      proceed: undefined,
      reset: undefined,
      status: "idle",
    });

    createMutationFn = vi
      .fn()
      .mockResolvedValue({ event_ids: ["event-1"], group_id: "group-1" });
    editMutationFn = vi.fn().mockResolvedValue({ group_id: "group-1" });

    createEventGroupMutationOptionsMock.mockReset();
    createEventGroupMutationOptionsMock.mockReturnValue({
      mutationFn: createMutationFn,
      mutationKey: ["events", "create-group"],
    });

    editEventGroupMutationOptionsMock.mockReset();
    editEventGroupMutationOptionsMock.mockReturnValue({
      mutationFn: editMutationFn,
      mutationKey: ["events", "edit-group"],
    });
  });

  describe("step validation", () => {
    it("disables Next on the name step until a group name is provided", async () => {
      const user = userEvent.setup();
      renderWizard();

      const nextButton = screen.getByRole("button", { name: "Next" });
      expect(nextButton).toBeDisabled();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      expect(nextButton).toBeEnabled();

      await user.click(nextButton);
      expect(screen.getByTestId("step-scope-type")).toBeInTheDocument();
    });

    it("requires a target selection on the scope step unless scope is world", async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Next" }));

      await user.click(screen.getByRole("button", { name: "Scope: Nation" }));
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Select nation-1" }));
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("does not require a target selection when scope is world", async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Next" }));

      await user.click(screen.getByRole("button", { name: "Scope: World" }));
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("requires memory text on the memory step once recording memories is enabled", async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Next" })); // -> scope
      await user.click(screen.getByRole("button", { name: "Scope: World" }));
      await user.click(screen.getByRole("button", { name: "Next" })); // -> effects
      await user.click(screen.getByRole("button", { name: "Next" })); // -> duration
      await user.click(screen.getByRole("button", { name: "Next" })); // -> memory

      expect(screen.getByTestId("step-memory")).toBeInTheDocument();
      const nextButton = screen.getByRole("button", { name: "Next" });
      expect(nextButton).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "Record memories" }));
      expect(nextButton).toBeDisabled();

      await user.type(screen.getByLabelText("Memory text"), "They remember.");
      expect(nextButton).toBeEnabled();
    });
  });

  describe("effect rows", () => {
    async function advanceToEffectsStep(
      user: ReturnType<typeof userEvent.setup>,
    ): Promise<void> {
      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(screen.getByRole("button", { name: "Scope: World" }));
      await user.click(screen.getByRole("button", { name: "Next" }));
    }

    it("adds and removes effect rows via the effects step", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToEffectsStep(user);

      expect(screen.getByTestId("effect-count")).toHaveTextContent("0");

      await user.click(screen.getByRole("button", { name: "Add effect" }));
      expect(screen.getByTestId("effect-count")).toHaveTextContent("1");

      await user.click(screen.getByRole("button", { name: "Add effect" }));
      expect(screen.getByTestId("effect-count")).toHaveTextContent("2");

      await user.click(screen.getByRole("button", { name: "Remove effect" }));
      expect(screen.getByTestId("effect-count")).toHaveTextContent("1");
    });

    it("submits every added effect row mapped to the create mutation payload", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToEffectsStep(user);

      await user.click(screen.getByRole("button", { name: "Add effect" }));
      await user.click(screen.getByRole("button", { name: "Add effect" }));

      await user.click(screen.getByRole("button", { name: "Next" })); // -> duration
      await user.click(screen.getByRole("button", { name: "Next" })); // -> memory
      await user.click(screen.getByRole("button", { name: "Next" })); // -> review
      await user.click(screen.getByRole("button", { name: "Create Event" }));

      await waitFor(() => expect(createMutationFn).toHaveBeenCalledTimes(1));
      expect(createMutationFn.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          worldId: WORLD_ID,
          groupName: "Solar Flare",
          scopeType: "world",
          effects: [
            expect.objectContaining({
              effectType: "population_boost",
              amountValue: 10,
            }),
            expect.objectContaining({
              effectType: "population_boost",
              amountValue: 10,
            }),
          ],
        }),
      );
    });
  });

  describe("cancel / unsaved-changes guard", () => {
    it("calls onClose directly when Cancel is clicked, without confirmation", async () => {
      const user = userEvent.setup();
      const { onClose } = renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    });

    it("reports no navigation block before any field has changed", () => {
      renderWizard();

      expect(latestShouldBlockFn()()).toBe(false);
    });

    it("reports a navigation block once a field has changed", async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");

      expect(latestShouldBlockFn()()).toBe(true);
    });

    it("no longer blocks navigation after a successful submission", async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(screen.getByRole("button", { name: "Scope: World" }));
      await user.click(screen.getByRole("button", { name: "Next" })); // -> effects
      await user.click(screen.getByRole("button", { name: "Next" })); // -> duration
      await user.click(screen.getByRole("button", { name: "Next" })); // -> memory
      await user.click(screen.getByRole("button", { name: "Next" })); // -> review
      await user.click(screen.getByRole("button", { name: "Create Event" }));

      await waitFor(() =>
        expect(toastSuccess).toHaveBeenCalledWith("Event created successfully"),
      );

      expect(latestShouldBlockFn()()).toBe(false);
    });

    it("shows a discard-changes dialog when the router reports a block, and Discard proceeds", async () => {
      const user = userEvent.setup();
      const proceed = vi.fn();
      useBlockerMock.mockReturnValue({
        action: "PUSH",
        current: {},
        next: {},
        proceed,
        reset: vi.fn(),
        status: "blocked",
      });

      renderWizard();

      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Discard" }));

      expect(proceed).toHaveBeenCalledTimes(1);
    });

    it("does not show a discard-changes dialog while the router is idle", () => {
      renderWizard();

      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    });
  });

  describe("submission error handling", () => {
    it("shows the mutation error message on failure", async () => {
      const user = userEvent.setup();
      createMutationFn.mockRejectedValue(
        Object.assign(new Error("Duration transitions required"), {
          code: "event_input_invalid",
        }),
      );
      renderWizard();

      await user.type(screen.getByLabelText("Group name"), "Solar Flare");
      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(screen.getByRole("button", { name: "Scope: World" }));
      await user.click(screen.getByRole("button", { name: "Next" })); // -> effects
      await user.click(screen.getByRole("button", { name: "Next" })); // -> duration
      await user.click(screen.getByRole("button", { name: "Next" })); // -> memory
      await user.click(screen.getByRole("button", { name: "Next" })); // -> review
      await user.click(screen.getByRole("button", { name: "Create Event" }));

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          "Duration transitions required",
        ),
      );
      expect(toastSuccess).not.toHaveBeenCalled();
    });
  });
});
