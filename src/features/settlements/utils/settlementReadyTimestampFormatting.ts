const SETTLEMENT_READY_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "numeric",
  timeZone: "UTC",
  year: "2-digit",
});

export function formatSettlementReadyTimestamp(timestamp: string): string {
  const epochMilliseconds = Date.parse(timestamp);

  if (Number.isNaN(epochMilliseconds)) {
    return timestamp;
  }

  return SETTLEMENT_READY_TIMESTAMP_FORMATTER.format(epochMilliseconds);
}
