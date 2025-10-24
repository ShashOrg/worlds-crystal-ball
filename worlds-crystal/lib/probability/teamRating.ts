import { prisma } from "@/lib/prisma";
import { EloConfig, getDefaultEloConfig } from "./elo";

export type TeamRatingRecord = {
  teamId: number;
  rating: number;
  source: string;
  createdAt: Date;
};

async function fetchLatestRating(teamId: number): Promise<TeamRatingRecord | null> {
  const rating = await prisma.teamRating.findFirst({
    where: { teamId },
    orderBy: { createdAt: "desc" },
  });
  return rating ? { ...rating } : null;
}

export async function getRating(teamId: number, cfg: EloConfig = getDefaultEloConfig()): Promise<number> {
  const latest = await fetchLatestRating(teamId);
  if (latest) return latest.rating;
  await setRating(teamId, cfg.base, "elo-seed");
  return cfg.base;
}

export async function getRatings(teamIds: number[], cfg: EloConfig = getDefaultEloConfig()): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (teamIds.length === 0) return map;

  const ratings = await prisma.teamRating.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: [{ teamId: "asc" }, { createdAt: "desc" }],
  });

  for (const teamId of teamIds) {
    const record = ratings.find((r) => r.teamId === teamId);
    if (record) {
      map.set(teamId, record.rating);
    } else {
      map.set(teamId, cfg.base);
    }
  }

  const missing = teamIds.filter((id) => !ratings.some((r) => r.teamId === id));
  if (missing.length > 0) {
    await prisma.teamRating.createMany({
      data: missing.map((teamId) => ({ teamId, rating: cfg.base, source: "elo-seed" })),
      skipDuplicates: true,
    });
  }

  return map;
}

export async function setRating(teamId: number, rating: number, source = "elo-local") {
  await prisma.teamRating.create({
    data: {
      teamId,
      rating,
      source,
    },
  });
}
