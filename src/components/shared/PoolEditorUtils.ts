export function parseBulkPaste(
  text: string,
  existing: readonly string[],
): string[] {
  const existingSet = new Set(existing);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split("\n")) {
    for (const piece of line.split(",")) {
      const trimmed = piece.trim();
      if (trimmed === "") continue;
      if (existingSet.has(trimmed)) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function countBulkPastePieces(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) {
    for (const piece of line.split(",")) {
      if (piece.trim() !== "") count++;
    }
  }
  return count;
}

export function sanitizePoolEntries(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed !== "" && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}
