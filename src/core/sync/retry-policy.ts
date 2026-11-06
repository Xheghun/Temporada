/** M5: bounded equal jitter; injected RNG makes tests deterministic. */
export function retryDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const maximumDelay = Math.min(
    60_000,
    1_000 * 2 ** Math.min(16, Math.max(0, attempt - 1)),
  );
  const sample = Math.max(0, Math.min(1, random()));
  return Math.round(maximumDelay / 2 + (sample * maximumDelay) / 2);
}
