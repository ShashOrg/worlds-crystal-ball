#!/usr/bin/env tsx

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractTeamsFromSchedule(t: { stages?: any[] }): string[] {
  const names: string[] = [];
  for (const stage of Array.isArray(t.stages) ? t.stages : []) {
    for (const series of Array.isArray(stage.series) ? stage.series : []) {
      const candidates = [
        series.blueTeamSlug,
        series.blueTeamName,
        series.blue,
        series.teamBlue,
        series.redTeamSlug,
        series.redTeamName,
        series.red,
        series.teamRed,
      ];
      for (const name of candidates) {
        if (name && typeof name === "string") {
          names.push(name.trim());
        }
      }
    }
  }
  return uniq(names.filter(Boolean));
}

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
  series?: SeriesInput[];
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
  stages?: StageInput[];
  teams?: Array<TeamInput | string>;
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
  const registerTeam = (key: string | null | undefined, id: number) => {
    if (!key) return;
    const trimmed = key.trim();
    if (!trimmed) return;
    teamMap.set(trimmed, id);
    teamMap.set(trimmed.toLowerCase(), id);
  };

  const explicitTeams = Array.isArray(data.teams) ? data.teams : null;
  const teams = explicitTeams ?? extractTeamsFromSchedule(data);
  if (!teams.length) {
    console.warn("[schedule] No teams found from JSON. Skipping team upsert.");
  }

  for (const team of teams) {
    if (!team) continue;
    if (typeof team === "string") {
      const name = team.trim();
      if (!name) continue;
      const slug = slugify(name) || name;
      const dbTeam = await prisma.team.upsert({
        where: { slug },
        create: {
          slug,
          displayName: name,
        },
        update: {
          displayName: name,
        },
      });
      registerTeam(dbTeam.slug, dbTeam.id);
      registerTeam(name, dbTeam.id);
      continue;
    }

    const slug = team.slug?.trim() || slugify(team.displayName ?? "");
    if (!slug) continue;
    const displayName = team.displayName?.trim() || slug;
    const dbTeam = await prisma.team.upsert({
      where: { slug },
      create: {
        slug,
        displayName,
        region: team.region ?? null,
      },
      update: {
        displayName,
        region: team.region ?? null,
      },
    });
    registerTeam(slug, dbTeam.id);
    registerTeam(team.slug, dbTeam.id);
    registerTeam(displayName, dbTeam.id);
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

  const stageInputs = (Array.isArray(data.stages) ? data.stages : [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const stageInput of stageInputs) {
    const stageOrder = stageInput.order ?? 0;
    const stageBestOfRaw = Number(stageInput.bestOf);
    const stageBestOf =
      Number.isFinite(stageBestOfRaw) && stageBestOfRaw > 0 ? Math.floor(stageBestOfRaw) : 1;
    let stage = await prisma.stage.findFirst({
      where: { tournamentId: tournament.id, name: stageInput.name },
    });
    if (!stage) {
      stage = await prisma.stage.create({
        data: {
          tournamentId: tournament.id,
          name: stageInput.name,
          order: stageOrder,
          bestOf: stageBestOf,
          type: stageInput.type,
        },
      });
    } else {
      stage = await prisma.stage.update({
        where: { id: stage.id },
        data: {
          order: stageOrder,
          bestOf: stageBestOf,
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

    const seriesInputs = Array.isArray(stageInput.series) ? stageInput.series : [];

    for (const seriesInput of seriesInputs) {
      const resolveTeamId = (...keys: Array<string | undefined>) => {
        for (const key of keys) {
          if (!key) continue;
          const trimmed = key.trim();
          if (!trimmed) continue;
          const direct = teamMap.get(trimmed) ?? teamMap.get(trimmed.toLowerCase());
          if (direct) return direct;
          const slug = slugify(trimmed);
          const slugMatch = teamMap.get(slug) ?? teamMap.get(slug.toLowerCase());
          if (slugMatch) return slugMatch;
        }
        return undefined;
      };

      const blueTeamId = resolveTeamId(
        seriesInput.blueTeamSlug,
        (seriesInput as any).blueTeamName,
        (seriesInput as any).blue,
        (seriesInput as any).teamBlue,
      );
      const redTeamId = resolveTeamId(
        seriesInput.redTeamSlug,
        (seriesInput as any).redTeamName,
        (seriesInput as any).red,
        (seriesInput as any).teamRed,
      );

      const scheduledAt = seriesInput.scheduledAt ? new Date(seriesInput.scheduledAt) : null;
      const now = new Date();
      const status = scheduledAt && scheduledAt <= now ? "in_progress" : "scheduled";

      const rawBestOf = seriesInput.bestOf ?? stageBestOf;
      const parsedBestOf = Number(rawBestOf);
      const fallbackBestOf = Number(stageBestOf);
      const bestOf = Number.isFinite(parsedBestOf) && parsedBestOf > 0 ? parsedBestOf : fallbackBestOf;
      const resolvedBestOf =
        Number.isFinite(bestOf) && bestOf > 0
          ? Math.floor(bestOf)
          : Math.max(1, Number.isFinite(fallbackBestOf) && fallbackBestOf > 0 ? Math.floor(fallbackBestOf) : 1);
      const series = await prisma.series.create({
        data: {
          stageId: stage.id,
          round: seriesInput.round,
          indexInRound: seriesInput.indexInRound,
          bestOf: resolvedBestOf > 0 ? resolvedBestOf : 1,
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

      const matchCount = resolvedBestOf > 0 ? resolvedBestOf : 1;
      const matches = Array.from({ length: matchCount }, (_, idx) => ({
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
