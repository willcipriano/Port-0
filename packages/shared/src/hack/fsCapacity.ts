/** Pure capacity check used by docs/tests; DB layer mirrors this rule. */
export function wouldExceedCapacity(
  usedQgb: number,
  capacityQgb: number,
  additionalQgb: number,
): boolean {
  if (additionalQgb <= 0) return false;
  return usedQgb + additionalQgb > capacityQgb;
}
