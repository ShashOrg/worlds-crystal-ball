import { Series } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { expectedScore, getDefaultEloConfig } from "./elo";
import { getRating } from "./teamRating";
import { seriesWinProbability } from "./seriesWinProb";

export async function getGameWinProbability(teamAId: number, teamBId: number): Promise<number> {
  const cfg = getDefaultEloConfig();
  const [ratingA, ratingB] = await Promise.all([
    getRating(teamAId, cfg),
    getRating(teamBId, cfg),
  ]);

  const adjustedA = ratingA + cfg.homeAdv;
  return expectedScore(adjustedA, ratingB);
}

export async function getSeriesWinProbability(
  teamAId: number,
  teamBId: number,
  series: Series,
  currentAWins: number,
  currentBWins: number,
): Promise<number> {
  const pGame = await getGameWinProbability(teamAId, teamBId);
  return seriesWinProbability(pGame, series.bestOf, currentAWins, currentBWins);
}

export async function setSeriesWinner(seriesId: number, winnerTeamId: number) {
  await prisma.series.update({
    where: { id: seriesId },
    data: {
      winnerTeamId,
      status: "completed",
    },
  });
}
