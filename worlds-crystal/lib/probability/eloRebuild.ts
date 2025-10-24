import { prisma } from "@/lib/prisma";

import { getDefaultEloConfig, updateElo } from "./elo";

export async function rebuildTournamentElo(tournamentId: number) {
  const cfg = getDefaultEloConfig();
  const ratingMap = new Map<number, number>();

  const matches = await prisma.match.findMany({
    where: {
      status: "completed",
      winnerTeamId: { not: null },
      series: { stage: { tournamentId } },
    },
    orderBy: [
      { completedAt: "asc" },
      { startedAt: "asc" },
      { id: "asc" },
    ],
  });

  const teams = new Set<number>();
  for (const match of matches) {
    if (match.blueTeamId) teams.add(match.blueTeamId);
    if (match.redTeamId) teams.add(match.redTeamId);
  }

  if (teams.size > 0) {
    await prisma.teamRating.deleteMany({
      where: {
        teamId: { in: Array.from(teams) },
        source: { in: ["elo-rebuild", "elo-local"] },
      },
    });
  }

  const writes: { teamId: number; rating: number; source: string }[] = [];
  for (const match of matches) {
    if (!match.blueTeamId || !match.redTeamId || !match.winnerTeamId) continue;
    const ratingA = ratingMap.get(match.blueTeamId) ?? cfg.base;
    const ratingB = ratingMap.get(match.redTeamId) ?? cfg.base;
    const { newA, newB } = updateElo(ratingA, ratingB, match.winnerTeamId === match.blueTeamId, cfg);
    ratingMap.set(match.blueTeamId, newA);
    ratingMap.set(match.redTeamId, newB);
    writes.push({ teamId: match.blueTeamId, rating: newA, source: "elo-rebuild" });
    writes.push({ teamId: match.redTeamId, rating: newB, source: "elo-rebuild" });
  }

  if (writes.length > 0) {
    await prisma.teamRating.createMany({ data: writes });
  }

  return { teamsUpdated: ratingMap.size, matchesProcessed: matches.length };
}
