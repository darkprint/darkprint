export interface Summary {
  n: number;
  recallAt5: number;
  top1: number;
  top3: number;
  mrr: number;
}

/** Keep raw ranks beside distinct ranks: duplicate versions still occupy a caller's slots. */
export function rankOf(keys: readonly string[], expected: string, distinct = true): number | undefined {
  const index = (distinct ? [...new Set(keys)] : keys).indexOf(expected);
  return index < 0 ? undefined : index + 1;
}

export function summarise(ranks: readonly (number | undefined)[]): Summary {
  const found = ranks.filter((r): r is number => r !== undefined);
  return {
    n: ranks.length,
    recallAt5: found.filter((r) => r <= 5).length,
    top1: found.filter((r) => r === 1).length,
    top3: found.filter((r) => r <= 3).length,
    mrr: Number((ranks.reduce<number>((sum, r) => sum + (r === undefined ? 0 : 1 / r), 0) / (ranks.length || 1)).toFixed(4)),
  };
}

/** Counts from different sized sets cannot establish non-regression. */
export function compareSummary(label: string, before: Summary, now: Summary): string[] {
  if (before.n !== now.n) return [`${label}.n ${before.n} -> ${now.n}: incomparable evaluation sets`];
  return (["recallAt5", "top1", "top3", "mrr"] as const)
    .filter((metric) => now[metric] < before[metric])
    .map((metric) => `${label}.${metric} ${before[metric]} -> ${now[metric]}`);
}
