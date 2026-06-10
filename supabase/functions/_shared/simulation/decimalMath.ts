// Decimal arithmetic helpers — filled by #B9.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

/**
 * DecimalValue = number (IEEE-754 float64).
 *
 * The name "Decimal" is historical and does NOT imply exact decimal arithmetic.
 * All operations use standard float64 operators (+, -, *, /).
 * Precision is guaranteed only at the database boundary: all quantities stored
 * in the DB use numeric(18,4), which rounds/clamps on write (see apply_turn_transition).
 * This constrains float noise to < 1 ULP at the 4dp scale, eliminating the need
 * for a decimal library.
 *
 * When comparing quantities for drift or equality checks on the JS side, round to
 * 4 decimal places or use a small tolerance rather than exact float equality.
 */
export type DecimalValue = number;

export function toDecimal(value: number): DecimalValue {
  return value;
}

export function addDecimal(a: DecimalValue, b: DecimalValue): DecimalValue {
  return a + b;
}

export function subtractDecimal(
  a: DecimalValue,
  b: DecimalValue,
): DecimalValue {
  return a - b;
}

export function multiplyDecimal(
  a: DecimalValue,
  b: DecimalValue,
): DecimalValue {
  return a * b;
}

export function divideDecimal(a: DecimalValue, b: DecimalValue): DecimalValue {
  if (b === 0) {
    throw new RangeError("Division by zero.");
  }

  return a / b;
}

export function clampDecimal(
  value: DecimalValue,
  min: DecimalValue,
  max: DecimalValue,
): DecimalValue {
  return Math.min(max, Math.max(min, value));
}

/**
 * Distributes `amount` across `weights` proportionally, guaranteeing the
 * output sums to exactly `amount`. Zero-weight entries receive 0. When all
 * weights are zero, every share is 0.
 *
 * Uses float64 arithmetic. The floating-point residual (typically < 1e-14)
 * is absorbed into the last non-zero entry so the invariant holds without
 * rounding loops. This confirms the float-based implementation: no decimal
 * library is used.
 */
export function proportionalShare(
  amount: number,
  weights: readonly number[],
): readonly number[] {
  if (weights.length === 0) return [];

  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (totalWeight === 0) {
    return weights.map(() => 0);
  }

  const result = new Array<number>(weights.length);
  let remaining = amount;
  let lastNonZeroIdx = -1;

  for (let i = 0; i < weights.length; i++) {
    if (weights[i] === 0) {
      result[i] = 0;
    } else {
      const share = (amount * weights[i]) / totalWeight;
      result[i] = share;
      remaining -= share;
      lastNonZeroIdx = i;
    }
  }

  // Absorb floating-point residual into the last non-zero share.
  if (lastNonZeroIdx !== -1) {
    result[lastNonZeroIdx] += remaining;
  }

  return result;
}

/**
 * Returns 1.0 when `available >= required` (demand is met), otherwise returns
 * `available / required` clamped to [0, 1]. Treats non-positive `required` as
 * fully satisfied.
 */
export function scaleDeficit(required: number, available: number): number {
  if (required <= 0 || available >= required) return 1.0;
  return Math.max(0, available / required);
}

/** Clamps `value` to the closed interval [min, max]. */
export function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Formats a stockpile quantity for display in death-detail strings.
 * Integers render without decimals; fractional values render to at most 2
 * significant decimal places (trailing zeros stripped).
 */
export function formatStockpileForDisplay(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return parseFloat(value.toFixed(2)).toString();
}

/**
 * Rounds a float64 value to the database scale (4 decimal places).
 * Use for JS-side quantity comparisons that feed drift or equality checks,
 * to match the numeric(18,4) precision boundary where values are stored.
 */
export function roundToDatabaseScale(value: DecimalValue): DecimalValue {
  return Math.round(value * 10000) / 10000;
}
