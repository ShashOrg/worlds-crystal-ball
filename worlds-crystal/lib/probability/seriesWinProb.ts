export function seriesWinProbability(
  pGameA: number,
  bestOf: number,
  aWins: number,
  bWins: number,
): number {
  const targetWins = Math.floor(bestOf / 2) + 1;

  if (aWins >= targetWins) return 1;
  if (bWins >= targetWins) return 0;

  const memo = new Map<string, number>();

  const clamp = (value: number) => Math.min(Math.max(value, 0), targetWins);

  const solve = (winsA: number, winsB: number): number => {
    const key = `${winsA}-${winsB}`;
    if (memo.has(key)) return memo.get(key)!;

    if (winsA >= targetWins) return 1;
    if (winsB >= targetWins) return 0;

    const nextA = solve(clamp(winsA + 1), winsB);
    const nextB = solve(winsA, clamp(winsB + 1));

    const prob = pGameA * nextA + (1 - pGameA) * nextB;
    memo.set(key, prob);
    return prob;
  };

  return solve(clamp(aWins), clamp(bWins));
}
