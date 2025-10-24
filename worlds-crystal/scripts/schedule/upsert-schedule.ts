#!/usr/bin/env tsx

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";

type SeriesPointer = {
  stage?: string;
  round: number;
  indexInRound: number;
};

type SeriesInput = {
  round: number;
  indexInRound: number;
  bestOf?: number;
  blueTeamSlug?: string;
  redTeamSlug?: string;
  scheduledAt?: string;
  feedsWinnerTo?: SeriesPointer;
  feedsLoserTo?: SeriesPointer;
};

type StageInput = {
  name: string;
  order: number;
  bestOf: number;
  type: string;
  series: SeriesInput[];
};

type TeamInput = {
  slug: string;
  displayName: string;
  region?: string;
};

type ScheduleFile = {
  tournament: {
    slug: string;
    name: string;
    year: number;
    region?: string;
  };
  stages: StageInput[];
  teams: TeamInput[];
};

function usage(): never {
  console.error("Usage: tsx scripts/schedule/upsert-schedule.ts --file <path>");
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.findIndex((arg) => arg === "--file");
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    usage();
  }

  const filePath = resolve(process.cwd(), args[fileIndex + 1]!);
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as ScheduleFile;

  const tournament = await prisma.tournament.upsert({
    where: { slug: data.tournament.slug },
    create: {
      slug: data.tournament.slug,
      name: data.tournament.name,
      year: data.tournament.year,
      region: data.tournament.region ?? null,
    },
    update: {
      name: data.tournament.name,
      year: data.tournament.year,
      region: data.tournament.region ?? null,
    },
  });

  const teamMap = new Map<string, number>();
  for (const team of data.teams) {
    const dbTeam = await prisma.team.upsert({
      where: { slug: team.slug },
      create: {
        slug: team.slug,
        displayName: team.displayName,
        region: team.region ?? null,
      },
      update: {
        displayName: team.displayName,
        region: team.region ?? null,
      },
    });
    teamMap.set(team.slug, dbTeam.id);
  }

  type SeriesKey = string;
  const seriesKey = (stageName: string, round: number, indexInRound: number): SeriesKey =>
    `${stageName.toLowerCase()}|${round}|${indexInRound}`;

  const seriesPointerUpdates: Array<{
    fromId: number;
    field: "feedsWinnerToId" | "feedsLoserToId";
    target: SeriesPointer;
    stageName: string;
  }> = [];
  const createdSeries = new Map<SeriesKey, number>();

  for (const stageInput of data.stages.sort((a, b) => a.order - b.order)) {
    let stage = await prisma.stage.findFirst({
      where: { tournamentId: tournament.id, name: stageInput.name },
    });
    if (!stage) {
      stage = await prisma.stage.create({
        data: {
          tournamentId: tournament.id,
          name: stageInput.name,
          order: stageInput.order,
          bestOf: stageInput.bestOf,
          type: stageInput.type,
        },
      });
    } else {
      stage = await prisma.stage.update({
        where: { id: stage.id },
        data: {
          order: stageInput.order,
          bestOf: stageInput.bestOf,
          type: stageInput.type,
        },
      });
    }

    const existingSeries = await prisma.series.findMany({ where: { stageId: stage.id } });
    if (existingSeries.length > 0) {
      const seriesIds = existingSeries.map((s) => s.id);
      await prisma.match.deleteMany({ where: { seriesId: { in: seriesIds } } });
      await prisma.series.deleteMany({ where: { id: { in: seriesIds } } });
    }

    for (const seriesInput of stageInput.series) {
      const blueTeamId = seriesInput.blueTeamSlug
        ? teamMap.get(seriesInput.blueTeamSlug)
        : undefined;
      const redTeamId = seriesInput.redTeamSlug
        ? teamMap.get(seriesInput.redTeamSlug)
        : undefined;

      const scheduledAt = seriesInput.scheduledAt ? new Date(seriesInput.scheduledAt) : null;
      const now = new Date();
      const status = scheduledAt && scheduledAt <= now ? "in_progress" : "scheduled";

      const bestOf = seriesInput.bestOf ?? stageInput.bestOf;
      const series = await prisma.series.create({
        data: {
          stageId: stage.id,
          round: seriesInput.round,
          indexInRound: seriesInput.indexInRound,
          bestOf,
          status,
          scheduledAt,
          blueTeamId: blueTeamId ?? null,
          redTeamId: redTeamId ?? null,
        },
      });

      createdSeries.set(seriesKey(stageInput.name, seriesInput.round, seriesInput.indexInRound), series.id);

      if (seriesInput.feedsWinnerTo) {
        seriesPointerUpdates.push({
          fromId: series.id,
          field: "feedsWinnerToId",
          target: seriesInput.feedsWinnerTo,
          stageName: stageInput.name,
        });
      }
      if (seriesInput.feedsLoserTo) {
        seriesPointerUpdates.push({
          fromId: series.id,
          field: "feedsLoserToId",
          target: seriesInput.feedsLoserTo,
          stageName: stageInput.name,
        });
      }

      const matches = Array.from({ length: bestOf }, (_, idx) => ({
        seriesId: series.id,
        gameIndex: idx + 1,
        status,
        blueTeamId: blueTeamId ?? null,
        redTeamId: redTeamId ?? null,
      }));
      if (matches.length > 0) {
        await prisma.match.createMany({ data: matches });
      }
    }
  }

  for (const update of seriesPointerUpdates) {
    const targetStageName = update.target.stage ?? update.stageName;
    const targetId = createdSeries.get(
      seriesKey(targetStageName, update.target.round, update.target.indexInRound),
    );
    if (!targetId) continue;

    await prisma.series.update({
      where: { id: update.fromId },
      data: { [update.field]: targetId },
    });
  }

  console.log(`Upserted schedule for tournament ${tournament.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
