const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const epochMilliseconds = Date.parse(iso);

  if (Number.isNaN(epochMilliseconds)) {
    return iso;
  }

  return DATE_FORMATTER.format(epochMilliseconds);
}
