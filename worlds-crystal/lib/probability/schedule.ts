import { Match, Series, Stage, Tournament } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type MatchWithTeams = Match;
export type SeriesWithMatches = Series & { matches: MatchWithTeams[] };
export type StageWithSeries = Stage & { series: SeriesWithMatches[] };
export type TournamentSchedule = Tournament & { stages: StageWithSeries[] };

export async function loadTournamentSchedule(tournamentId: number): Promise<TournamentSchedule | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          series: {
            orderBy: [{ round: "asc" }, { indexInRound: "asc" }],
            include: { matches: { orderBy: { gameIndex: "asc" } } },
          },
        },
      },
    },
  });

  return tournament as TournamentSchedule | null;
}

export function countSeriesScore(series: SeriesWithMatches): { blueWins: number; redWins: number } {
  let blueWins = 0;
  let redWins = 0;

  for (const match of series.matches) {
    if (match.status !== "completed" || !match.winnerTeamId) continue;
    if (match.winnerTeamId === series.blueTeamId) {
      blueWins += 1;
    } else if (match.winnerTeamId === series.redTeamId) {
      redWins += 1;
    }
  }

  return { blueWins, redWins };
}

export function gamesNeededToWin(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

export function remainingGamesInSeries(series: SeriesWithMatches): number {
  const played = series.matches.filter((match) => match.status === "completed").length;
  return Math.max(series.bestOf - played, 0);
}

export function potentialUpcomingGames(series: SeriesWithMatches): MatchWithTeams[] {
  const { blueWins, redWins } = countSeriesScore(series);
  const winsNeeded = gamesNeededToWin(series.bestOf);
  if (blueWins >= winsNeeded || redWins >= winsNeeded) {
    return [];
  }

  const remainingSlots = winsNeeded * 2 - (blueWins + redWins);
  return series.matches
    .filter((match) => match.status !== "completed")
    .sort((a, b) => a.gameIndex - b.gameIndex)
    .slice(0, Math.max(remainingSlots, 0));
}
