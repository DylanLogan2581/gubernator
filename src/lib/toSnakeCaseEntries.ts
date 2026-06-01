import type { Json } from "@/types/database";

export function toSnakeCaseEntries<T extends Record<string, Json | undefined>>(
  entries: readonly T[],
  keyMap: { readonly [K in keyof T & string]: string },
): Json {
  const pairs = Object.entries(keyMap);
  return entries.map((entry) =>
    Object.fromEntries(
      pairs.flatMap(([camelKey, snakeKey]) => {
        const value = entry[camelKey as keyof T];
        return value !== undefined ? [[snakeKey, value]] : [];
      }),
    ),
  );
}
