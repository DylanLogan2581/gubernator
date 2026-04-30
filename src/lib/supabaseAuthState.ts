import { supabase, type GubernatorSupabaseClient } from "@/lib/supabase";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type SupabaseAuthStateChangeHandler = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

export type SupabaseAuthStateSubscriptionOptions = {
  readonly client?: GubernatorSupabaseClient | null;
  readonly onAuthStateChange: SupabaseAuthStateChangeHandler;
};

type SupabaseAuthState = {
  readonly client: GubernatorSupabaseClient;
  readonly initialSessionPromise: Promise<Session | null>;
  readonly listeners: Set<SupabaseAuthStateChangeHandler>;
  isInitialized: boolean;
  session: Session | null;
  unsubscribe: () => void;
};

let authState: SupabaseAuthState | null = null;

export function subscribeToSupabaseAuthStateChanges({
  client = supabase,
  onAuthStateChange,
}: SupabaseAuthStateSubscriptionOptions): () => void {
  if (client === null) {
    return noop;
  }

  const state = ensureSupabaseAuthState(client);
  state.listeners.add(onAuthStateChange);

  return () => {
    state.listeners.delete(onAuthStateChange);
  };
}

export function getSupabaseAuthSession(
  client: GubernatorSupabaseClient,
): Promise<Session | null> {
  if (!canSubscribeToSupabaseAuthStateChanges(client)) {
    return getSupabaseAuthSessionDirectly(client);
  }

  const state = ensureSupabaseAuthState(client);

  if (state.isInitialized) {
    return Promise.resolve(state.session);
  }

  return state.initialSessionPromise;
}

function noop(): void {}

function ensureSupabaseAuthState(
  client: GubernatorSupabaseClient,
): SupabaseAuthState {
  if (authState !== null && authState.client === client) {
    return authState;
  }

  authState?.unsubscribe();

  const listeners = new Set<SupabaseAuthStateChangeHandler>();
  let resolveInitialSession = (_session: Session | null): void => {};
  const initialSessionPromise = new Promise<Session | null>((resolve) => {
    resolveInitialSession = resolve;
  });
  const state: SupabaseAuthState = {
    client,
    initialSessionPromise,
    isInitialized: false,
    listeners,
    session: null,
    unsubscribe: noop,
  };
  const { data } = client.auth.onAuthStateChange((event, session) => {
    state.session = session;

    if (!state.isInitialized) {
      state.isInitialized = true;
      resolveInitialSession(session);
    }

    for (const listener of state.listeners) {
      listener(event, session);
    }
  });

  state.unsubscribe = data.subscription.unsubscribe;
  authState = state;

  return authState;
}

function canSubscribeToSupabaseAuthStateChanges(
  client: GubernatorSupabaseClient,
): boolean {
  return typeof client.auth.onAuthStateChange === "function";
}

async function getSupabaseAuthSessionDirectly(
  client: GubernatorSupabaseClient,
): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();

  if (error !== null) {
    throw error;
  }

  return data.session;
}
