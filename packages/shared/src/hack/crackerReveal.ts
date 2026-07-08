/** How many characters of the real password are revealed at a given crack progress. */
export function computeCrackerRevealCount(
  progressPercent: number,
  passwordLength: number,
): number {
  if (passwordLength <= 0 || progressPercent <= 0) return 0;
  if (progressPercent >= 95) return passwordLength;

  const start = 5;
  const end = 95;
  if (progressPercent < start) return 0;

  const t = (progressPercent - start) / (end - start);
  const count = Math.ceil(t * Math.max(1, passwordLength - 1));
  return Math.max(1, Math.min(passwordLength - 1, count));
}

export function computeCrackerRevealedPrefix(
  password: string,
  progressPercent: number,
): string {
  const count = computeCrackerRevealCount(progressPercent, password.length);
  return password.slice(0, count);
}
