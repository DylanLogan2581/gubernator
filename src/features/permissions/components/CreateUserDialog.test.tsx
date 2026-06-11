import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateUserDialog } from "./CreateUserDialog";

const { mockCreateUser, mockNotifySuccess, mockNotifyError } = vi.hoisted(
  () => ({
    mockCreateUser: vi.fn(),
    mockNotifySuccess: vi.fn(),
    mockNotifyError: vi.fn(),
  }),
);

vi.mock("@/features/permissions/mutations/superadminMutations", () => ({
  createUserMutationOptions: vi.fn(() => ({
    mutationFn: mockCreateUser,
  })),
}));

vi.mock("@/lib/notify", () => ({
  notifyMutationSuccess: mockNotifySuccess,
  notifyMutationError: mockNotifyError,
}));

describe("CreateUserDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnCreated = vi.fn();
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderDialog(): ReturnType<typeof render> {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreateUserDialog
          onClose={mockOnClose}
          onCreated={mockOnCreated}
          queryClient={queryClient}
        />
      </QueryClientProvider>,
    );
  }

  describe("error message: superadmin_user_exists", () => {
    it("displays email conflict message", async () => {
      const user = userEvent.setup();
      const error = {
        code: "superadmin_user_exists",
        message: "A user with this email address already exists.",
      };
      mockCreateUser.mockRejectedValueOnce(error);

      renderDialog();

      await user.type(
        screen.getByPlaceholderText("user@example.com"),
        "existing@example.com",
      );
      await user.type(screen.getByPlaceholderText("username"), "testuser");
      await user.type(
        screen.getByPlaceholderText("Minimum 8 characters"),
        "password123",
      );

      const submitButton = screen.getByRole("button", { name: "Create user" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNotifyError).toHaveBeenCalledWith(
          error,
          "Failed to create user.",
        );
      });
    });
  });

  describe("error message: superadmin_not_authorized", () => {
    it("displays authorization error message", async () => {
      const user = userEvent.setup();
      const error = {
        code: "superadmin_not_authorized",
        message: "You don't have permission to create users.",
      };
      mockCreateUser.mockRejectedValueOnce(error);

      renderDialog();

      await user.type(
        screen.getByPlaceholderText("user@example.com"),
        "new@example.com",
      );
      await user.type(screen.getByPlaceholderText("username"), "testuser");
      await user.type(
        screen.getByPlaceholderText("Minimum 8 characters"),
        "password123",
      );

      const submitButton = screen.getByRole("button", { name: "Create user" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNotifyError).toHaveBeenCalledWith(
          error,
          "Failed to create user.",
        );
      });
    });

    it("displays auth expired message when unauthenticated", async () => {
      const user = userEvent.setup();
      const error = {
        code: "superadmin_not_authorized",
        message: "Sign-in expired, please sign in again.",
      };
      mockCreateUser.mockRejectedValueOnce(error);

      renderDialog();

      await user.type(
        screen.getByPlaceholderText("user@example.com"),
        "new@example.com",
      );
      await user.type(screen.getByPlaceholderText("username"), "testuser");
      await user.type(
        screen.getByPlaceholderText("Minimum 8 characters"),
        "password123",
      );

      const submitButton = screen.getByRole("button", { name: "Create user" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNotifyError).toHaveBeenCalledWith(
          error,
          "Failed to create user.",
        );
      });
    });
  });

  describe("error message: superadmin_operation_failed", () => {
    it("displays generic operation failed message", async () => {
      const user = userEvent.setup();
      const error = {
        code: "superadmin_operation_failed",
        message:
          "Something went wrong creating the user. Try again or contact support.",
      };
      mockCreateUser.mockRejectedValueOnce(error);

      renderDialog();

      await user.type(
        screen.getByPlaceholderText("user@example.com"),
        "new@example.com",
      );
      await user.type(screen.getByPlaceholderText("username"), "testuser");
      await user.type(
        screen.getByPlaceholderText("Minimum 8 characters"),
        "password123",
      );

      const submitButton = screen.getByRole("button", { name: "Create user" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNotifyError).toHaveBeenCalledWith(
          error,
          "Failed to create user.",
        );
      });
    });
  });

  describe("success", () => {
    it("displays success message and closes dialog on successful creation", async () => {
      const user = userEvent.setup();
      const newUserId = "user-123";
      mockCreateUser.mockResolvedValueOnce({
        email: "new@example.com",
        userId: newUserId,
        username: "newuser",
      });

      renderDialog();

      await user.type(
        screen.getByPlaceholderText("user@example.com"),
        "new@example.com",
      );
      await user.type(screen.getByPlaceholderText("username"), "newuser");
      await user.type(
        screen.getByPlaceholderText("Minimum 8 characters"),
        "password123",
      );

      const submitButton = screen.getByRole("button", { name: "Create user" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNotifySuccess).toHaveBeenCalledWith(
          "User created successfully.",
          expect.objectContaining({
            description: "newuser (new@example.com)",
          }),
        );
        expect(mockOnCreated).toHaveBeenCalledWith(newUserId);
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe("magic link option", () => {
    it("does not show password field when magic link is checked", async () => {
      const user = userEvent.setup();

      renderDialog();

      expect(screen.getByPlaceholderText("Minimum 8 characters")).toBeDefined();

      const magicLinkCheckbox = screen.getByRole("checkbox", {
        name: /Send magic link/,
      });
      await user.click(magicLinkCheckbox);

      expect(screen.queryByPlaceholderText("Minimum 8 characters")).toBeNull();
    });
  });
});
