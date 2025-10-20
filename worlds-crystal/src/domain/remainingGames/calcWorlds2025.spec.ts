import { describe, expect, it, beforeEach, vi } from "vitest";

import { computeRemainingGamesWorlds2025 } from "./calcWorlds2025";
import type { Match } from "@/src/lib/lolesportsClient";

const mockGetStageSchedule = vi.fn<
  (stageId: string) => Promise<{ matches: Match[] }>
>();

vi.mock("@/src/lib/lolesportsClient", () => ({
  getStageSchedule: mockGetStageSchedule,
}));

const SWISS_STAGE_ID = "113475482880934049";

const defaultStageSchedule = { matches: [] as Match[] };
let nextMatchId = 0;

describe("computeRemainingGamesWorlds2025", () => {
  beforeEach(() => {
    mockGetStageSchedule.mockReset();
    nextMatchId = 0;
  });

  it("accounts for live Swiss series when computing remaining maps", async () => {
    const matches: Match[] = [
      ...Array.from({ length: 10 }, (_, index) =>
        createMatch({
          id: `bo1-completed-${index}`,
          bestOf: 1,
          state: "completed",
        }),
      ),
      createMatch({ id: "bo1-live-1", bestOf: 1, state: "inProgress" }),
      createMatch({ id: "bo1-live-2", bestOf: 1, state: "inProgress" }),
      ...Array.from({ length: 3 }, (_, index) =>
        createMatch({
          id: `bo1-unstarted-${index}`,
          bestOf: 1,
          state: "unstarted",
        }),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        createMatch({
          id: `bo3-completed-${index}`,
          bestOf: 3,
          state: "completed",
          score: { a: 2, b: 0 },
        }),
      ),
      createMatch({
        id: "bo3-live-1",
        bestOf: 3,
        state: "inProgress",
        score: { a: 1, b: 0 },
      }),
      createMatch({
        id: "bo3-live-2",
        bestOf: 3,
        state: "inProgress",
        score: { a: 1, b: 1 },
      }),
      createMatch({
        id: "bo3-unstarted-1",
        bestOf: 3,
        state: "unstarted",
      }),
    ];

    mockGetStageSchedule.mockResolvedValueOnce({ matches });

    const result = await computeRemainingGamesWorlds2025();

    expect(result.swiss.min).toBe(24);
    expect(result.swiss.max).toBe(30);
    expect(result.swiss.details).toEqual({
      bo1Left: 10,
      bo3SeriesLeft: 8,
      liveBo1: 2,
      liveBo3RemainingMaps: 2,
    });

    expect(result.knockouts.min).toBe(21);
    expect(result.knockouts.max).toBe(35);
    expect(result.knockouts.details).toEqual({
      seriesLeft: 7,
      liveBo5RemainingMaps: 0,
    });

    expect(result.total).toEqual({ min: 45, max: 65 });
    expect(mockGetStageSchedule).toHaveBeenCalledWith(SWISS_STAGE_ID);
  });

  it("falls back to format totals when future Swiss rounds are unpublished", async () => {
    mockGetStageSchedule.mockResolvedValueOnce(defaultStageSchedule);

    const result = await computeRemainingGamesWorlds2025();

    expect(result.swiss.min).toBe(46);
    expect(result.swiss.max).toBe(59);
    expect(result.knockouts.min).toBe(21);
    expect(result.knockouts.max).toBe(35);
    expect(result.total).toEqual({ min: 67, max: 94 });
  });

  it("clamps over-reported matches so remaining counts never go negative", async () => {
    const matches: Match[] = [
      ...Array.from({ length: 25 }, (_, index) =>
        createMatch({
          id: `bo1-completed-${index}`,
          bestOf: 1,
          state: "completed",
        }),
      ),
      createMatch({ id: "bo1-live-extra", bestOf: 1, state: "inProgress" }),
      ...Array.from({ length: 15 }, (_, index) =>
        createMatch({
          id: `bo3-completed-${index}`,
          bestOf: 3,
          state: "completed",
          score: { a: 2, b: 1 },
        }),
      ),
      createMatch({
        id: "bo3-live-extra",
        bestOf: 3,
        state: "inProgress",
        score: { a: 2, b: 0 },
      }),
    ];

    mockGetStageSchedule.mockResolvedValueOnce({ matches });

    const result = await computeRemainingGamesWorlds2025();

    expect(result.swiss.min).toBe(0);
    expect(result.swiss.max).toBe(0);
    expect(result.swiss.details).toEqual({
      bo1Left: 0,
      bo3SeriesLeft: 0,
      liveBo1: 0,
      liveBo3RemainingMaps: 0,
    });
    expect(result.knockouts.min).toBe(21);
    expect(result.knockouts.max).toBe(35);
    expect(result.total).toEqual({ min: 21, max: 35 });
  });
});

function createMatch(overrides: Partial<Match>): Match {
  return {
    id: overrides.id ?? `match-${nextMatchId++}`,
    stageId: overrides.stageId ?? SWISS_STAGE_ID,
    bestOf: overrides.bestOf ?? 1,
    state: overrides.state ?? "unstarted",
    score: overrides.score ?? { a: 0, b: 0 },
    startTime: overrides.startTime,
  };
}
