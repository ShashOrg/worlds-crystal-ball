import { describe, expect, it } from "vitest";

import { expectedScore, updateElo, getDefaultEloConfig } from "./elo";

describe("elo", () => {
  it("has symmetric expected scores", () => {
    const a = expectedScore(1600, 1500);
    const b = expectedScore(1500, 1600);
    expect(a + b).toBeCloseTo(1, 10);
  });

  it("increases rating for repeated wins", () => {
    const cfg = getDefaultEloConfig();
    let rA = 1500;
    let rB = 1500;
    for (let i = 0; i < 5; i += 1) {
      const result = updateElo(rA, rB, true, cfg);
      rA = result.newA;
      rB = result.newB;
    }
    expect(rA).toBeGreaterThan(1500);
    expect(rB).toBeLessThan(1500);
  });
});
