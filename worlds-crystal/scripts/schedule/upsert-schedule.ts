#!/usr/bin/env tsx

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";

// --- helpers: uniq/normalize/aliases/extraction ---

function uniq<T>(xs: T[]) {
  return Array.from(new Set(xs));
}

function keyify(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const TEAM_ALIASES: Record<string, string> = {
  TES: "Top Esports",
  BLG: "Bilibili Gaming",
  HLE: "Hanwha Life Esports",
  GEN: "Gen.G",
  IG: "Invictus Gaming",
  G2: "G2 Esports",
  FNC: "Fnatic",
};

function applyAlias(name: string | null | undefined) {
  const raw = name?.trim();
  if (!raw) return raw;
  const alias = TEAM_ALIASES[raw] ?? TEAM_ALIASES[raw.toUpperCase()];
  return alias ?? raw;
}

function extractTeamsFromSchedule(raw: any): string[] {
  const stages = Array.isArray(raw?.stages) ? raw.stages : [];

  const found: string[] = [];
  for (const stage of stages) {
    const seriesList = Array.isArray(stage?.series) ? stage.series : [];
    for (const s of seriesList) {
      const bt = applyAlias(s?.blueTeamName ?? s?.blue ?? s?.teamBlue);
      const rt = applyAlias(s?.redTeamName ?? s?.red ?? s?.teamRed);
      if (typeof bt === "string" && bt.trim()) found.push(bt.trim());
      if (typeof rt === "string" && rt.trim()) found.push(rt.trim());
    }
  }

  const firstByKey = new Map<string, string>();
  for (const name of found) {
    const k = keyify(name);
    if (!firstByKey.has(k)) firstByKey.set(k, name);
  }
  return Array.from(firstByKey.values());
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  const parsed = JSON.parse(raw);
  const data = parsed as ScheduleFile;

  const container: any = Array.isArray(parsed?.stages)
    ? parsed
    : parsed?.tournament && Array.isArray(parsed?.tournament?.stages)
      ? parsed.tournament
      : parsed;

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

  type NormalizedTeam = {
    name: string;
    slug?: string;
    region?: string | null;
    rawNames: Set<string>;
  };

  const normalizedTeams = new Map<string, NormalizedTeam>();
  const rememberTeam = (rawName: string | null | undefined, extra?: { slug?: string | null; region?: string | null }) => {
    if (typeof rawName !== "string") {
      if (extra?.slug) {
        const fallbackName = extra.slug.trim();
        if (fallbackName) {
          return rememberTeam(fallbackName, extra);
        }
      }
      return;
    }

    const canonical = applyAlias(rawName);
    const clean = canonical?.trim();
    if (!clean) return;

    const key = keyify(clean);
    const existing = normalizedTeams.get(key);
    const slug = extra?.slug?.trim();
    const region = extra?.region ?? null;

    if (existing) {
      if (slug && !existing.slug) existing.slug = slug;
      if (region !== undefined && existing.region == null) existing.region = region;
      existing.rawNames.add(rawName);
      return;
    }

    const record: NormalizedTeam = {
      name: clean,
      slug: slug || undefined,
      region: region ?? null,
      rawNames: new Set([rawName]),
    };

    normalizedTeams.set(key, record);
  };

  const explicitTeamsRaw = Array.isArray(container?.teams)
    ? container.teams
    : Array.isArray(parsed?.teams)
      ? parsed.teams
      : null;

  if (explicitTeamsRaw) {
    for (const entry of explicitTeamsRaw) {
      if (!entry) continue;
      if (typeof entry === "string") {
        rememberTeam(entry);
        continue;
      }

      const slug = typeof entry.slug === "string" ? entry.slug : undefined;
      const displayName =
        typeof entry.displayName === "string" && entry.displayName.trim()
          ? entry.displayName
          : slug ?? null;
      rememberTeam(displayName, { slug, region: entry.region ?? null });
    }
  }

  const derivedTeams = extractTeamsFromSchedule(container);
  for (const name of derivedTeams) {
    rememberTeam(name);
  }

  const teams = Array.from(normalizedTeams.values());
  if (!teams.length) {
    console.warn("[schedule] No teams found in schedule. Skipping team upsert.");
  } else {
    console.log(`[schedule] Upserting ${teams.length} teams…`);
  }

  type TeamRecord = { id: number; slug: string; displayName: string };
  const teamCache = new Map<string, TeamRecord>();

  const registerTeam = (value: string | null | undefined, record: TeamRecord) => {
    if (!value) return;
    const clean = value.trim();
    if (!clean) return;
    teamCache.set(keyify(clean), record);
    const slugKey = slugify(clean);
    if (slugKey) {
      teamCache.set(keyify(slugKey), record);
    }
  };

  for (const team of teams) {
    const name = team.name.trim();
    if (!name) continue;

    const slug = (team.slug && team.slug.trim()) || slugify(name);
    if (!slug) continue;

    const dbTeam = await prisma.team.upsert({
      where: { slug },
      create: {
        slug,
        displayName: name,
        region: team.region ?? null,
      },
      update: {
        displayName: name,
        region: team.region ?? null,
      },
      select: { id: true, slug: true, displayName: true },
    });

    registerTeam(dbTeam.displayName, dbTeam);
    registerTeam(dbTeam.slug, dbTeam);
    if (team.slug && team.slug !== dbTeam.slug) {
      registerTeam(team.slug, dbTeam);
    }
    for (const rawName of team.rawNames) {
      registerTeam(rawName, dbTeam);
      const alias = applyAlias(rawName);
      if (alias && alias !== rawName) {
        registerTeam(alias, dbTeam);
      }
    }
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
      const resolveTeamId = (...keys: Array<string | null | undefined>) => {
        for (const key of keys) {
          if (!key || typeof key !== "string") continue;
          const alias = applyAlias(key);
          const candidates = uniq(
            [key, alias]
              .filter((candidate): candidate is string => typeof candidate === "string")
              .map((candidate) => candidate.trim())
              .filter(Boolean),
          );

          for (const candidate of candidates) {
            const record = teamCache.get(keyify(candidate));
            if (record) return record.id;

            const slugCandidate = slugify(candidate);
            if (slugCandidate) {
              const slugRecord = teamCache.get(keyify(slugCandidate));
              if (slugRecord) return slugRecord.id;
            }
          }
        }
        return undefined;
      };

      const blueName =
        applyAlias(
          (seriesInput as any).blueTeamName ??
            (seriesInput as any).blue ??
            (seriesInput as any).teamBlue,
        )?.trim() ?? null;
      const redName =
        applyAlias(
          (seriesInput as any).redTeamName ??
            (seriesInput as any).red ??
            (seriesInput as any).teamRed,
        )?.trim() ?? null;

      const blueTeamId = resolveTeamId(seriesInput.blueTeamSlug, blueName, (seriesInput as any).blueTeamName, (seriesInput as any).blue, (seriesInput as any).teamBlue);
      const redTeamId = resolveTeamId(seriesInput.redTeamSlug, redName, (seriesInput as any).redTeamName, (seriesInput as any).red, (seriesInput as any).teamRed);

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
