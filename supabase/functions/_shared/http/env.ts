type EdgeRuntime = {
  readonly env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response> | Response): void;
};

declare const Deno: EdgeRuntime | undefined;

export function getEdgeRuntime(): EdgeRuntime | undefined {
  if (typeof Deno === "undefined") {
    return undefined;
  }

  return Deno;
}

export function getRequiredRuntimeEnv(name: string): string | undefined {
  const edgeRuntime = getEdgeRuntime();

  if (edgeRuntime === undefined) {
    return undefined;
  }

  const value = edgeRuntime.env.get(name);

  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

export function getRequiredRuntimeUrl(name: string): string | undefined {
  const value = getRequiredRuntimeEnv(name);
  if (value === undefined) return undefined;
  return value.replace(/\/$/, "");
}

export function assertEdgeEnvVars(names: readonly string[]): void {
  const runtime = getEdgeRuntime();

  if (runtime === undefined) {
    return;
  }

  const missing = names.filter((name) => {
    const value = runtime.env.get(name);
    return value === undefined || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Edge function cold-start failed — missing required env vars: ${missing.join(", ")}`,
    );
  }
}
