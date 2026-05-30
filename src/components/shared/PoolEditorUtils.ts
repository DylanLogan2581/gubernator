export function parseBulkPaste(
  text: string,
  existing: readonly string[],
): string[] {
  const existingSet = new Set(existing);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (existingSet.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
