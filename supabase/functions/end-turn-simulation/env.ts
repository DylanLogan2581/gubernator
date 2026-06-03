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

  return value.replace(/\/$/, "");
}
