import { describe, expect, it, vi } from "vitest";

const scheduleMock = {
  id: 1,
  slug: "test",
  name: "Test",
  year: 2025,
  region: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  stages: [
    {
      id: 1,
      tournamentId: 1,
      name: "Knockout",
      order: 1,
      bestOf: 5,
      type: "Knockout",
      series: [
        {
          id: 101,
          stageId: 1,
          round: 1,
          indexInRound: 1,
          bestOf: 5,
          status: "scheduled",
          blueTeamId: 1,
          redTeamId: 2,
          winnerTeamId: null,
          scheduledAt: null,
          feedsWinnerToId: 103,
          feedsLoserToId: null,
          matches: Array.from({ length: 5 }, (_, idx) => ({
            id: 1000 + idx,
            seriesId: 101,
            gameIndex: idx + 1,
            status: "scheduled",
            blueTeamId: 1,
            redTeamId: 2,
            winnerTeamId: null,
            startedAt: null,
            completedAt: null,
            oracleGameId: null,
          })),
        },
        {
          id: 102,
          stageId: 1,
          round: 1,
          indexInRound: 2,
          bestOf: 5,
          status: "scheduled",
          blueTeamId: 3,
          redTeamId: 4,
          winnerTeamId: null,
          scheduledAt: null,
          feedsWinnerToId: 103,
          feedsLoserToId: null,
          matches: Array.from({ length: 5 }, (_, idx) => ({
            id: 2000 + idx,
            seriesId: 102,
            gameIndex: idx + 1,
            status: "scheduled",
            blueTeamId: 3,
            redTeamId: 4,
            winnerTeamId: null,
            startedAt: null,
            completedAt: null,
            oracleGameId: null,
          })),
        },
        {
          id: 103,
          stageId: 1,
          round: 2,
          indexInRound: 1,
          bestOf: 5,
          status: "scheduled",
          blueTeamId: null,
          redTeamId: null,
          winnerTeamId: null,
          scheduledAt: null,
          feedsWinnerToId: null,
          feedsLoserToId: null,
          matches: Array.from({ length: 5 }, (_, idx) => ({
            id: 3000 + idx,
            seriesId: 103,
            gameIndex: idx + 1,
            status: "scheduled",
            blueTeamId: null,
            redTeamId: null,
            winnerTeamId: null,
            startedAt: null,
            completedAt: null,
            oracleGameId: null,
          })),
        },
      ],
    },
  ],
};

const finalMatchupProbabilities = new Map<string, number>([
  ["1-3", 0.55],
  ["1-4", 0.65],
  ["2-3", 0.45],
  ["2-4", 0.35],
]);

const mocks = vi.hoisted(() => ({
  loadTournamentSchedule: vi.fn(),
  countSeriesScore: vi.fn(),
  getSeriesWinProbability: vi.fn(),
}));

vi.mock("./schedule", () => ({
  loadTournamentSchedule: mocks.loadTournamentSchedule,
  countSeriesScore: mocks.countSeriesScore,
  potentialUpcomingGames: vi.fn(() => []),
}));

vi.mock("./matchup", () => ({
  getSeriesWinProbability: mocks.getSeriesWinProbability,
  setSeriesWinner: vi.fn(),
}));

import { computeTournamentOutcome } from "./bracket";

describe("computeTournamentOutcome", () => {
  it("propagates probabilities through a simple knockout bracket", async () => {
    mocks.loadTournamentSchedule.mockResolvedValue(scheduleMock);
    mocks.countSeriesScore.mockReturnValue({ blueWins: 0, redWins: 0 });
    mocks.getSeriesWinProbability.mockImplementation(
      async (teamA: number, teamB: number, series: { id: number }) => {
        if (series.id === 101) return 0.6;
        if (series.id === 102) return 0.7;
        if (series.id === 103) return finalMatchupProbabilities.get(`${teamA}-${teamB}`) ?? 0.5;
        return 0.5;
      },
    );

    const outcome = await computeTournamentOutcome(1);
    const result = outcome.teamProbWinTournament;
    expect(result.get(1)).toBeCloseTo(0.348, 3);
    expect(result.get(2)).toBeCloseTo(0.168, 3);
    expect(result.get(3)).toBeCloseTo(0.343, 3);
    expect(result.get(4)).toBeCloseTo(0.141, 3);
  });
});
