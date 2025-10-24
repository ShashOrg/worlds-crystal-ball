import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { computeTournamentOutcome } from "./bracket";
import { loadTournamentSchedule, potentialUpcomingGames } from "./schedule";

export type PickProbability = {
  answerKey: string;
  probability: number;
  details?: Record<string, unknown>;
};

type QuestionConfig = Prisma.JsonValue & {
  answerPool?: string;
  buckets?: string[];
};

export async function calculatePickProbabilities(questionId: number): Promise<PickProbability[]> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { tournament: true },
  });

  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const config = (question.configJson ?? {}) as QuestionConfig;

  if (question.type === "binary") {
    return calculateBinary(question.id, question.tournamentId, config);
  }

  if (question.type === "categorical") {
    return calculateCategorical(question.tournament.slug, config);
  }

  if (question.type === "numeric") {
    return calculateNumeric(question.tournament.slug, config);
  }

  return [];
}

async function calculateBinary(
  questionId: number,
  tournamentId: number,
  config: QuestionConfig,
): Promise<PickProbability[]> {
  if (config.answerPool !== "teams_active") {
    return [];
  }

  const outcome = await computeTournamentOutcome(tournamentId);
  const teamIds = Array.from(outcome.teamProbWinTournament.keys());
  if (teamIds.length === 0) return [];

  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } } });
  const slugById = new Map<number, string>();
  for (const team of teams) {
    slugById.set(team.id, team.slug);
  }

  return teamIds
    .map((teamId) => ({
      answerKey: slugById.get(teamId) ?? String(teamId),
      probability: outcome.teamProbWinTournament.get(teamId) ?? 0,
      details: {
        teamId,
        questionId,
      },
    }))
    .sort((a, b) => b.probability - a.probability);
}

async function calculateCategorical(
  tournamentSlug: string,
  config: QuestionConfig,
): Promise<PickProbability[]> {
  if (config.answerPool !== "champions_all") {
    return [];
  }

  const schedule = await loadTournamentScheduleForSlug(tournamentSlug);
  const remainingGames = schedule ? totalPotentialGames(schedule) : 0;

  const championCounts = await prisma.gameChampStats.groupBy({
    by: ["championId"],
    _count: { _all: true },
    where: {
      game: {
        tournament: tournamentSlug,
      },
    },
  });

  const totalPicks = championCounts.reduce((sum, row) => sum + row._count._all, 0);
  const champions = await prisma.champion.findMany({
    where: { id: { in: championCounts.map((row) => row.championId) } },
  });
  const championKey = new Map<number, string>();
  for (const champion of champions) {
    championKey.set(champion.id, champion.key);
  }

  const expectedPerChampion = championCounts.map((row) => {
    const share = totalPicks > 0 ? row._count._all / totalPicks : 0;
    const expectedFuture = share * remainingGames * 10;
    return {
      championId: row.championId,
      key: championKey.get(row.championId) ?? String(row.championId),
      value: row._count._all + expectedFuture,
      current: row._count._all,
      expectedFuture,
    };
  });

  const totalValue = expectedPerChampion.reduce((sum, row) => sum + row.value, 0);
  if (totalValue === 0) {
    return expectedPerChampion.map((row) => ({
      answerKey: row.key,
      probability: 0,
      details: { current: row.current, expectedFuture: row.expectedFuture },
    }));
  }

  return expectedPerChampion
    .map((row) => ({
      answerKey: row.key,
      probability: row.value / totalValue,
      details: {
        current: row.current,
        expectedFuture: row.expectedFuture,
      },
    }))
    .sort((a, b) => b.probability - a.probability);
}

async function calculateNumeric(
  tournamentSlug: string,
  config: QuestionConfig,
): Promise<PickProbability[]> {
  if (!Array.isArray(config.buckets) || config.buckets.length === 0) {
    return [];
  }

  const schedule = await loadTournamentScheduleForSlug(tournamentSlug);
  const completedMatches = schedule
    ? schedule.stages.flatMap((stage) => stage.series).flatMap((series) => series.matches)
        .filter((match) => match.status === "completed").length
    : 0;
  const remainingGames = schedule ? totalPotentialGames(schedule) : 0;

  const expectedBaronsPerGame = 1; // MVP heuristic
  const currentEstimate = completedMatches * expectedBaronsPerGame;
  const futureEstimate = remainingGames * expectedBaronsPerGame;
  const totalEstimate = currentEstimate + futureEstimate;

  const bucketProbabilities = config.buckets.map((bucket) => ({
    answerKey: bucket,
    probability: 0,
    details: { estimate: totalEstimate },
  }));

  const targetBucket = config.buckets.find((bucket) => inBucket(bucket, totalEstimate));
  if (targetBucket) {
    const idx = config.buckets.indexOf(targetBucket);
    bucketProbabilities[idx]!.probability = 1;
  } else if (bucketProbabilities.length > 0) {
    const share = 1 / bucketProbabilities.length;
    for (const bucket of bucketProbabilities) {
      bucket.probability = share;
    }
  }

  return bucketProbabilities;
}

function inBucket(bucket: string, value: number): boolean {
  const match = bucket.match(/^(\d+)(?:-(\d+)|\+)$/);
  if (!match) return false;
  const low = Number.parseInt(match[1]!, 10);
  const high = match[2] ? Number.parseInt(match[2]!, 10) : null;
  if (Number.isNaN(low)) return false;
  if (high === null) {
    return value >= low;
  }
  return value >= low && value <= high;
}

async function loadTournamentScheduleForSlug(tournamentSlug: string) {
  const tournament = await prisma.tournament.findUnique({ where: { slug: tournamentSlug } });
  if (!tournament) return null;
  return loadTournamentSchedule(tournament.id);
}

function totalPotentialGames(schedule: Awaited<ReturnType<typeof loadTournamentSchedule>>) {
  if (!schedule) return 0;
  let total = 0;
  for (const stage of schedule.stages) {
    for (const series of stage.series) {
      total += potentialUpcomingGames(series).length;
    }
  }
  return total;
}
