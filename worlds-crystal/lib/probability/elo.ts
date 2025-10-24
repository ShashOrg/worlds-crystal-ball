export type EloConfig = {
  k: number;
  homeAdv: number;
  base: number;
};

const DEFAULT_CONFIG: EloConfig = {
  k: 32,
  homeAdv: 0,
  base: 1500,
};

export function getDefaultEloConfig(): EloConfig {
  return { ...DEFAULT_CONFIG };
}

export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

export function updateElo(rA: number, rB: number, aWon: boolean, cfg: EloConfig = DEFAULT_CONFIG) {
  const expA = expectedScore(rA, rB);
  const scoreA = aWon ? 1 : 0;
  const newA = rA + cfg.k * (scoreA - expA);
  const newB = rB + cfg.k * ((1 - scoreA) - (1 - expA));
  return { newA, newB };
}
