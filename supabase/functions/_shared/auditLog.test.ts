/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  logAdminCreateUserSuccess,
  logAuthenticationFailure,
  logAuthorizationDenial,
  logEndTurnSuccess,
} from "./auditLog.ts";

describe("auditLog", () => {
  let capturedLogs: string[];

  beforeEach(() => {
    capturedLogs = [];
    vi.spyOn(console, "log").mockImplementation((msg) => {
      capturedLogs.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logAuthorizationDenial", () => {
    it("emits structured log with userId, target, and reason", () => {
      logAuthorizationDenial("user-123", "world-456", "world_admin_required");

      expect(capturedLogs).toHaveLength(1);
      const log = JSON.parse(capturedLogs[0]);

      expect(log).toMatchObject({
        event: "authorization_denied",
        userId: "user-123",
        target: "world-456",
        reason: "world_admin_required",
      });
      expect(log.timestamp).toBeDefined();
      expect(typeof log.timestamp).toBe("string");
    });

    it("supports different denial reasons", () => {
      logAuthorizationDenial("user-123", "world-456", "superadmin_required");
      const log = JSON.parse(capturedLogs[0]);
      expect(log.reason).toBe("superadmin_required");
    });

    it("handles email targets", () => {
      logAuthorizationDenial(
        "user-123",
        "test@example.com",
        "superadmin_required",
      );
      const log = JSON.parse(capturedLogs[0]);
      expect(log.target).toBe("test@example.com");
    });
  });

  describe("logEndTurnSuccess", () => {
    it("emits structured log with turn transition data", () => {
      logEndTurnSuccess("user-123", "world-456", 5, 6, "transition-789");

      expect(capturedLogs).toHaveLength(1);
      const log = JSON.parse(capturedLogs[0]);

      expect(log).toMatchObject({
        event: "end_turn_success",
        userId: "user-123",
        worldId: "world-456",
        fromTurn: 5,
        toTurn: 6,
        transitionId: "transition-789",
      });
      expect(log.timestamp).toBeDefined();
    });

    it("correctly logs large turn numbers", () => {
      logEndTurnSuccess("user-123", "world-456", 9999, 10000, "transition-789");
      const log = JSON.parse(capturedLogs[0]);

      expect(log.fromTurn).toBe(9999);
      expect(log.toTurn).toBe(10000);
    });
  });

  describe("logAdminCreateUserSuccess", () => {
    it("emits structured log with user creation data", () => {
      logAdminCreateUserSuccess(
        "admin-123",
        "new-user-456",
        "newuser@example.com",
      );

      expect(capturedLogs).toHaveLength(1);
      const log = JSON.parse(capturedLogs[0]);

      expect(log).toMatchObject({
        event: "admin_create_user_success",
        actingUserId: "admin-123",
        newUserId: "new-user-456",
        email: "newuser@example.com",
      });
      expect(log.timestamp).toBeDefined();
    });

    it("handles special characters in email", () => {
      logAdminCreateUserSuccess(
        "admin-123",
        "new-user-456",
        "user+tag@example.co.uk",
      );
      const log = JSON.parse(capturedLogs[0]);

      expect(log.email).toBe("user+tag@example.co.uk");
    });
  });

  describe("logAuthenticationFailure", () => {
    it("emits structured log with failure reason", () => {
      logAuthenticationFailure("session_expired");

      expect(capturedLogs).toHaveLength(1);
      const log = JSON.parse(capturedLogs[0]);

      expect(log).toMatchObject({
        event: "authentication_failed",
        reason: "session_expired",
      });
      expect(log.timestamp).toBeDefined();
    });

    it("supports various failure reasons", () => {
      logAuthenticationFailure("auth_context_unavailable");
      const log = JSON.parse(capturedLogs[0]);
      expect(log.reason).toBe("auth_context_unavailable");
    });
  });

  describe("log format", () => {
    it("produces valid JSON that can be parsed", () => {
      logAuthorizationDenial("user-123", "world-456", "test");

      expect(() => {
        JSON.parse(capturedLogs[0]);
      }).not.toThrow();
    });

    it("includes ISO 8601 timestamp", () => {
      logAuthorizationDenial("user-123", "world-456", "test");
      const log = JSON.parse(capturedLogs[0]);

      // Validate ISO 8601 format
      const timestamp = new Date(log.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });
});
