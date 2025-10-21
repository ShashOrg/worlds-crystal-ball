import { describe, expect, it, beforeEach, vi } from "vitest";

import { computeRemainingGamesWorlds2025 } from "./calcWorlds2025";
import type { Match } from "@/src/lib/lolesportsClient";

const mockGameCount = vi.fn<(args?: unknown) => Promise<number>>();

const mockGetStageSchedule = vi.fn<
  (args: { tournamentId?: string; stageId?: string }) => Promise<{
    stageId: string;
    matches: Match[];
  }>
>();

vi.mock("@/src/lib/lolesportsClient", () => ({
  getStageSchedule: mockGetStageSchedule,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      count: mockGameCount,
    },
  },
}));

const SWISS_STAGE_ID = "113475482880934049";
const TOURNAMENT_ID = "113475452383887518";

const defaultStageSchedule = { stageId: SWISS_STAGE_ID, matches: [] as Match[] };
let nextMatchId = 0;

describe("computeRemainingGamesWorlds2025", () => {
  beforeEach(() => {
    mockGetStageSchedule.mockReset();
    mockGameCount.mockReset();
    mockGameCount.mockResolvedValue(0);
    nextMatchId = 0;
  });

  it("reports played totals and remaining ranges using schedule data", async () => {
    const matches: Match[] = [
      ...Array.from({ length: 5 }, (_, index) =>
        createMatch({
          id: `bo1-completed-${index}`,
          bestOf: 1,
          state: "completed",
        }),
      ),
      createMatch({ id: "bo1-live", bestOf: 1, state: "inProgress" }),
      ...Array.from({ length: 3 }, (_, index) =>
        createMatch({
          id: `bo1-unstarted-${index}`,
          bestOf: 1,
          state: "unstarted",
        }),
      ),
      createMatch({
        id: "bo3-completed-1",
        bestOf: 3,
        state: "completed",
        score: { a: 2, b: 1 },
      }),
      createMatch({
        id: "bo3-completed-2",
        bestOf: 3,
        state: "completed",
        score: { a: 2, b: 0 },
      }),
      createMatch({
        id: "bo3-live",
        bestOf: 3,
        state: "inProgress",
        score: { a: 1, b: 0 },
      }),
      ...Array.from({ length: 4 }, (_, index) =>
        createMatch({
          id: `bo3-unstarted-${index}`,
          bestOf: 3,
          state: "unstarted",
        }),
      ),
    ];

    mockGetStageSchedule.mockResolvedValueOnce({ stageId: SWISS_STAGE_ID, matches });

    const result = await computeRemainingGamesWorlds2025();

    expect(result.swiss.min).toBe(36);
    expect(result.swiss.max).toBe(46);
    expect(result.swiss.details).toEqual({
      bo1Left: 15,
      bo3SeriesLeft: 11,
      liveBo1: 1,
      liveBo3RemainingMaps: 1,
    });

    expect(result.knockouts.min).toBe(21);
    expect(result.knockouts.max).toBe(35);
    expect(result.knockouts.details).toEqual({
      seriesLeft: 7,
      liveBo5RemainingMaps: 0,
    });

    expect(result.total).toEqual({ min: 57, max: 81 });
    expect(result.played).toEqual({ maps: 10, series: 7 });
    expect(result.seriesLeft).toEqual({ total: 33 });
    expect(mockGetStageSchedule).toHaveBeenCalledWith({
      tournamentId: TOURNAMENT_ID,
      stageId: SWISS_STAGE_ID,
    });
  });

  it("falls back to format totals when future Swiss rounds are unpublished", async () => {
    mockGetStageSchedule.mockResolvedValueOnce(defaultStageSchedule);

    const result = await computeRemainingGamesWorlds2025();

    expect(result.swiss.min).toBe(46);
    expect(result.swiss.max).toBe(59);
    expect(result.knockouts.min).toBe(21);
    expect(result.knockouts.max).toBe(35);
    expect(result.total).toEqual({ min: 67, max: 94 });
    expect(result.played).toEqual({ maps: 0, series: 0 });
    expect(result.seriesLeft).toEqual({ total: 40 });
  });

  it("uses database fallback for played maps when schedule has no results", async () => {
    mockGetStageSchedule.mockResolvedValueOnce(defaultStageSchedule);
    mockGameCount.mockResolvedValueOnce(18);

    const result = await computeRemainingGamesWorlds2025();

    expect(mockGameCount).toHaveBeenCalledTimes(1);
    expect(result.played).toEqual({ maps: 18, series: 0 });
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

    mockGetStageSchedule.mockResolvedValueOnce({ stageId: SWISS_STAGE_ID, matches });

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
    expect(result.played).toEqual({ maps: 70, series: 40 });
    expect(result.seriesLeft).toEqual({ total: 7 });
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
