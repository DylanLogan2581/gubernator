const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

const RELATIVE_TIME_UNITS_IN_SECONDS: ReadonlyArray<
  readonly [Intl.RelativeTimeFormatUnit, number]
> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatDate(iso: string): string {
  const epochMilliseconds = Date.parse(iso);

  if (Number.isNaN(epochMilliseconds)) {
    return iso;
  }

  return DATE_FORMATTER.format(epochMilliseconds);
}

export function formatRelativeTime(
  iso: string,
  // eslint-disable-next-line no-restricted-syntax -- default lets callers inject time for tests
  now: Date = new Date(),
): string {
  const epochMilliseconds = Date.parse(iso);

  if (Number.isNaN(epochMilliseconds)) {
    return iso;
  }

  const elapsedSeconds = (epochMilliseconds - now.getTime()) / 1000;

  if (Math.abs(elapsedSeconds) < 60) {
    return RELATIVE_TIME_FORMATTER.format(0, "minute");
  }

  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS_IN_SECONDS) {
    if (Math.abs(elapsedSeconds) >= secondsInUnit) {
      return RELATIVE_TIME_FORMATTER.format(
        Math.round(elapsedSeconds / secondsInUnit),
        unit,
      );
    }
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(elapsedSeconds), "second");
}
