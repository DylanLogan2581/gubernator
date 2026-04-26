import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  supabaseConfig,
  SupabaseConfigurationError,
  type SupabaseConfigState,
} from "@/lib/supabaseConfig";
import type { Database } from "@/types/database";

export type GubernatorSupabaseClient = SupabaseClient<Database>;

type SupabaseClientFactory = (
  url: string,
  anonKey: string,
) => GubernatorSupabaseClient;

export function createSupabaseBrowserClient(
  configState: SupabaseConfigState,
  clientFactory: SupabaseClientFactory = createDatabaseClient,
): GubernatorSupabaseClient | null {
  if (configState.status === "configured") {
    return clientFactory(configState.url, configState.anonKey);
  }

  if (configState.isProduction) {
    throw new SupabaseConfigurationError(configState);
  }

  return null;
}

export function requireSupabaseClient(): GubernatorSupabaseClient {
  if (supabase === null) {
    throw new SupabaseConfigurationError(
      supabaseConfig.status === "missing"
        ? supabaseConfig
        : {
            isProduction: supabaseConfig.isProduction,
            message: "Supabase client is unavailable.",
            missingVariables: [],
            status: "missing",
          },
    );
  }

  return supabase;
}

export const supabase = createSupabaseBrowserClient(supabaseConfig);

function createDatabaseClient(
  url: string,
  anonKey: string,
): GubernatorSupabaseClient {
  return createClient<Database>(url, anonKey);
}
