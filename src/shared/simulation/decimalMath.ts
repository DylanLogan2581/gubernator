// Decimal arithmetic helpers — filled by #B9.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

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
