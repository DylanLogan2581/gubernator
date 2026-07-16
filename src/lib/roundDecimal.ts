export function roundDecimal(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}
