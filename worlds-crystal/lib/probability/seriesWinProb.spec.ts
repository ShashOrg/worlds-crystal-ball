import { describe, expect, it } from "vitest";

import { seriesWinProbability } from "./seriesWinProb";

describe("seriesWinProbability", () => {
  it("computes best-of-3 probability from scratch", () => {
    const p = seriesWinProbability(0.6, 3, 0, 0);
    expect(p).toBeCloseTo(0.648, 3);
  });

  it("handles mid-series leads", () => {
    const p = seriesWinProbability(0.55, 5, 2, 1);
    expect(p).toBeCloseTo(0.7975, 4);
  });

  it("returns low probability when trailing heavily", () => {
    const p = seriesWinProbability(0.4, 5, 0, 2);
    expect(p).toBeCloseTo(0.064, 3);
  });
});
