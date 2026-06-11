export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasProperty<T extends string>(
  obj: Record<string, unknown>,
  prop: T,
  type: "string" | "number" | "boolean" | "object" | "function" | "undefined",
): obj is Record<string, unknown> & { [P in T]: unknown } {
  // `type` is constrained to the valid typeof result strings by the signature.
  // deno-lint-ignore valid-typeof
  return typeof obj[prop] === type;
}
