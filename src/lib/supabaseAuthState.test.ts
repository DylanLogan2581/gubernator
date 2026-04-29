import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";
import {
  getSupabaseAuthSession,
  subscribeToSupabaseAuthStateChanges,
} from "@/lib/supabaseAuthState";

import type {
  AuthChangeEvent,
  Session,
  Subscription,
} from "@supabase/supabase-js";

describe("subscribeToSupabaseAuthStateChanges", () => {
  it("subscribes once and forwards auth state events to listeners", () => {
    const authState: { handler: AuthStateHandler | null } = { handler: null };
    const onAuthStateChange = vi.fn();
    const client = createClient({
      onSubscribe: (handler) => {
        authState.handler = handler;
      },
    });

    const stop = subscribeToSupabaseAuthStateChanges({
      client,
      onAuthStateChange,
    });

    expect(client.auth.onAuthStateChange).toHaveBeenCalledOnce();
    emitAuthState(authState.handler, "SIGNED_IN", createSession("user-1"));

    expect(onAuthStateChange).toHaveBeenCalledWith(
      "SIGNED_IN",
      createSession("user-1"),
    );

    stop();

    emitAuthState(authState.handler, "SIGNED_OUT", null);
    expect(onAuthStateChange).toHaveBeenCalledOnce();
  });

  it("returns a no-op unsubscribe when Supabase is not configured", () => {
    const onAuthStateChange = vi.fn();
    const stop = subscribeToSupabaseAuthStateChanges({
      client: null,
      onAuthStateChange,
    });

    expect(() => {
      stop();
    }).not.toThrow();
    expect(onAuthStateChange).not.toHaveBeenCalled();
  });

  it("resolves the current session from the shared initial auth event", async () => {
    const authState: { handler: AuthStateHandler | null } = { handler: null };
    const client = createClient({
      onSubscribe: (handler) => {
        authState.handler = handler;
      },
    });

    const sessionPromise = getSupabaseAuthSession(client);
    emitAuthState(
      authState.handler,
      "INITIAL_SESSION",
      createSession("user-1"),
    );

    await expect(sessionPromise).resolves.toEqual(createSession("user-1"));
    await expect(getSupabaseAuthSession(client)).resolves.toEqual(
      createSession("user-1"),
    );
  });

  it("falls back to getSession for test clients without auth subscriptions", async () => {
    const session = createSession("user-1");
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
      },
    } as unknown as GubernatorSupabaseClient;

    await expect(getSupabaseAuthSession(client)).resolves.toBe(session);
  });
});

function createClient({
  onSubscribe,
}: {
  readonly onSubscribe: (handler: AuthStateHandler) => void;
}): GubernatorSupabaseClient & {
  readonly auth: {
    readonly onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void,
    ) => {
      readonly data: {
        readonly subscription: Subscription;
      };
    };
  };
} {
  return {
    auth: {
      onAuthStateChange: vi.fn((handler: AuthStateHandler) => {
        onSubscribe(handler);

        return {
          data: {
            subscription: {
              callback: vi.fn(),
              id: "subscription-1",
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
  } as unknown as GubernatorSupabaseClient & {
    readonly auth: {
      readonly onAuthStateChange: (
        callback: (event: AuthChangeEvent, session: Session | null) => void,
      ) => {
        readonly data: {
          readonly subscription: Subscription;
        };
      };
    };
  };
}

type AuthStateHandler = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

function emitAuthState(
  handler: AuthStateHandler | null,
  event: AuthChangeEvent,
  session: Session | null,
): void {
  if (handler === null) {
    throw new Error("Expected Supabase auth state subscription.");
  }

  handler(event, session);
}

function createSession(userId: string): Session {
  return { user: { id: userId } } as Session;
}
