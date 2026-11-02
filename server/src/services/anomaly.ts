/** True when `value` is a latency outlier vs. `history` (needs >= 20 samples). */
export function isAnomaly(history: number[], value: number): boolean {
  if (history.length < 20) return false;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
  return value > mean + 3 * sd && value > mean + 50;
}
