export function toSlug(
  value: string,
  options?: { maxLength?: number },
): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return options?.maxLength !== undefined
    ? slug.slice(0, options.maxLength)
    : slug;
}
