const supabaseEnvironmentVariableNames = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

export type SupabaseEnvironmentVariable =
  (typeof supabaseEnvironmentVariableNames)[number];

export type SupabaseEnvironment = {
  readonly PROD: boolean;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
};

export type SupabaseConfigState =
  | {
      readonly anonKey: string;
      readonly isProduction: boolean;
      readonly status: "configured";
      readonly url: string;
    }
  | {
      readonly isProduction: boolean;
      readonly message: string;
      readonly missingVariables: readonly SupabaseEnvironmentVariable[];
      readonly status: "missing";
    };

export class SupabaseConfigurationError extends Error {
  readonly missingVariables: readonly SupabaseEnvironmentVariable[];

  constructor(
    configState: Extract<SupabaseConfigState, { status: "missing" }>,
  ) {
    super(configState.message);
    this.name = "SupabaseConfigurationError";
    this.missingVariables = configState.missingVariables;
  }
}

export function getSupabaseConfigState(
  env: SupabaseEnvironment,
): SupabaseConfigState {
  const url = normalizeEnvironmentValue(env.VITE_SUPABASE_URL);
  const anonKey = normalizeEnvironmentValue(env.VITE_SUPABASE_ANON_KEY);

  if (url === undefined || anonKey === undefined) {
    const missingVariables = supabaseEnvironmentVariableNames.filter((name) => {
      switch (name) {
        case "VITE_SUPABASE_URL":
          return url === undefined;
        case "VITE_SUPABASE_ANON_KEY":
          return anonKey === undefined;
        default:
          return exhaustive(name);
      }
    });

    return {
      isProduction: env.PROD,
      message: `Supabase configuration is missing: ${missingVariables.join(", ")}.`,
      missingVariables,
      status: "missing",
    };
  }

  return {
    anonKey,
    isProduction: env.PROD,
    status: "configured",
    url,
  };
}

export function shouldBlockAppForSupabaseConfig(
  configState: SupabaseConfigState,
): boolean {
  return configState.status === "missing" && configState.isProduction;
}

export const supabaseConfig = getSupabaseConfigState(import.meta.env);

function normalizeEnvironmentValue(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue === "" ? undefined : normalizedValue;
}

function exhaustive(value: never): never {
  void value;

  throw new Error("Unhandled Supabase environment variable.");
}
