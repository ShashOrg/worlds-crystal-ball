import { SeriesWithMatches, loadTournamentSchedule, countSeriesScore } from "./schedule";
import { getSeriesWinProbability } from "./matchup";

export type TournamentOutcome = {
  teamProbWinTournament: Map<number, number>;
};

export async function computeTournamentOutcome(tournamentId: number): Promise<TournamentOutcome> {
  const schedule = await loadTournamentSchedule(tournamentId);
  if (!schedule) {
    return { teamProbWinTournament: new Map() };
  }

  const allSeries: SeriesWithMatches[] = schedule.stages.flatMap((stage) => stage.series);
  const feeders = new Map<number, SeriesWithMatches[]>();
  for (const series of allSeries) {
    if (series.feedsWinnerToId) {
      const list = feeders.get(series.feedsWinnerToId) ?? [];
      list.push(series);
      feeders.set(series.feedsWinnerToId, list);
    }
  }
  for (const [targetId, list] of feeders.entries()) {
    list.sort((a, b) => {
      if (a.stageId !== b.stageId) return a.stageId - b.stageId;
      if (a.round !== b.round) return a.round - b.round;
      return a.indexInRound - b.indexInRound;
    });
    feeders.set(targetId, list);
  }

  const memo = new Map<number, Map<number, number>>();

  const computeSeriesDistribution = async (
    series: SeriesWithMatches,
  ): Promise<Map<number, number>> => {
    if (memo.has(series.id)) return memo.get(series.id)!;

    if (series.status === "completed" && series.winnerTeamId) {
      const completed = new Map<number, number>();
      completed.set(series.winnerTeamId, 1);
      memo.set(series.id, completed);
      return completed;
    }

    const entrants = feeders.get(series.id) ? [...(feeders.get(series.id) ?? [])] : [];

    const slotDistribution = async (teamId: number | null): Promise<Map<number, number>> => {
      if (teamId) {
        const map = new Map<number, number>();
        map.set(teamId, 1);
        return map;
      }

      const feeder = entrants.shift();
      if (!feeder) {
        return new Map();
      }
      return computeSeriesDistribution(feeder);
    };

    const blueDist = await slotDistribution(series.blueTeamId ?? null);
    const redDist = await slotDistribution(series.redTeamId ?? null);

    if (blueDist.size === 0 && redDist.size === 0) {
      const empty = new Map<number, number>();
      memo.set(series.id, empty);
      return empty;
    }

    if (blueDist.size === 0) {
      memo.set(series.id, new Map(redDist));
      return memo.get(series.id)!;
    }
    if (redDist.size === 0) {
      memo.set(series.id, new Map(blueDist));
      return memo.get(series.id)!;
    }

    const outcomes = new Map<number, number>();
    const { blueWins, redWins } = countSeriesScore(series);

    for (const [blueTeam, blueProb] of blueDist.entries()) {
      for (const [redTeam, redProb] of redDist.entries()) {
        if (blueTeam === redTeam) continue;
        const matchupWeight = blueProb * redProb;
        if (matchupWeight === 0) continue;
        const probBlueWins = await getSeriesWinProbability(
          blueTeam,
          redTeam,
          series,
          blueWins,
          redWins,
        );
        const probRedWins = 1 - probBlueWins;
        outcomes.set(blueTeam, (outcomes.get(blueTeam) ?? 0) + matchupWeight * probBlueWins);
        outcomes.set(redTeam, (outcomes.get(redTeam) ?? 0) + matchupWeight * probRedWins);
      }
    }

    memo.set(series.id, outcomes);
    return outcomes;
  };

  const finals = allSeries.filter((series) => !series.feedsWinnerToId);
  const result = new Map<number, number>();
  for (const finalSeries of finals) {
    const distribution = await computeSeriesDistribution(finalSeries);
    for (const [teamId, prob] of distribution.entries()) {
      result.set(teamId, (result.get(teamId) ?? 0) + prob);
    }
  }

  return { teamProbWinTournament: result };
}
