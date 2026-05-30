export function sortByName<T extends { name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}
