import { prisma } from "@/lib/prisma";
import { getWorldsEventSchedule } from "@/lib/worlds-event-metadata";

export type GameSummarySource = {
    id: bigint;
    oracleGameId: string | null;
    dateUtc: Date;
    blueTeam: string;
    redTeam: string;
};

export type CrystalBallSummary = {
    totalGames: number;
    totalMatches: number;
    totalScheduledMatches: number | null;
    totalPotentialMatches: number | null;
    totalPossibleMatches: number | null;
    maxRemainingMatches: number | null;
};

const SUMMARY_METRIC_ID = "crystal_ball_summary";

export function normalizeOracleMatchId(raw: string | null | undefined): string | null {
    if (!raw) {
        return null;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    let candidate = trimmed.replace(/\s+/g, "_");

    const withoutGameSuffix = candidate.replace(/(?:[_-]?G(?:AME)?\d+)+$/i, "");
    if (withoutGameSuffix) {
        candidate = withoutGameSuffix;
    }

    candidate = candidate.replace(/[_-]+$/g, "");

    return candidate ? candidate.toUpperCase() : trimmed.toUpperCase();
}

export function deriveMatchIdentifier(game: GameSummarySource): string {
    const normalized = normalizeOracleMatchId(game.oracleGameId);
    if (normalized) {
        return normalized;
    }

    const dateKey = Number.isNaN(game.dateUtc.getTime())
        ? "UNKNOWN-DATE"
        : game.dateUtc.toISOString().slice(0, 10);
    const teams = [game.blueTeam || "BLUE", game.redTeam || "RED"]
        .map((team) => team.trim().toUpperCase())
        .sort()
        .join("_VS_");

    return `${dateKey}_${teams}_${game.id.toString()}`;
}

function seasonDateRange(season: number): { start: Date; end: Date } {
    const start = new Date(Date.UTC(season, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(season + 1, 0, 1, 0, 0, 0));
    return { start, end };
}

function buildSummaryFromGames(games: GameSummarySource[], season: number): CrystalBallSummary {
    const matchIds = new Set<string>();
    for (const game of games) {
        matchIds.add(deriveMatchIdentifier(game));
    }

    const schedule = getWorldsEventSchedule(season);
    const totalScheduledMatches = schedule?.scheduledMatches ?? null;
    const totalPotentialMatches = schedule?.potentialMatches ?? null;

    const totalPossibleMatches =
        totalScheduledMatches !== null || totalPotentialMatches !== null
            ? (totalScheduledMatches ?? 0) + (totalPotentialMatches ?? 0)
            : null;

    const totalMatches = matchIds.size;
    const maxRemainingMatches =
        totalPossibleMatches !== null ? Math.max(0, totalPossibleMatches - totalMatches) : null;

    return {
        totalGames: games.length,
        totalMatches,
        totalScheduledMatches,
        totalPotentialMatches,
        totalPossibleMatches,
        maxRemainingMatches,
    };
}

export async function computeCrystalBallSummary(season: number): Promise<CrystalBallSummary> {
    const { start, end } = seasonDateRange(season);
    const games = await prisma.game.findMany({
        where: {
            dateUtc: {
                gte: start,
                lt: end,
            },
        },
        orderBy: { dateUtc: "asc" },
        select: {
            id: true,
            oracleGameId: true,
            dateUtc: true,
            blueTeam: true,
            redTeam: true,
        },
    });

    return buildSummaryFromGames(games, season);
}

function isCrystalBallSummary(value: unknown): value is CrystalBallSummary {
    if (!value || typeof value !== "object") return false;
    const summary = value as Record<string, unknown>;
    return (
        typeof summary.totalGames === "number" &&
        typeof summary.totalMatches === "number" &&
        (summary.totalScheduledMatches === null || typeof summary.totalScheduledMatches === "number") &&
        (summary.totalPotentialMatches === null || typeof summary.totalPotentialMatches === "number") &&
        (summary.totalPossibleMatches === null || typeof summary.totalPossibleMatches === "number") &&
        (summary.maxRemainingMatches === null || typeof summary.maxRemainingMatches === "number")
    );
}

export async function loadPersistedCrystalBallSummary(): Promise<CrystalBallSummary | null> {
    const record = await prisma.externalMetric.findUnique({
        where: { metricId: SUMMARY_METRIC_ID },
    });

    if (!record) return null;

    const data = record.data as unknown;
    if (!isCrystalBallSummary(data)) {
        return null;
    }

    return data;
}

export async function persistCrystalBallSummary(summary: CrystalBallSummary): Promise<void> {
    await prisma.externalMetric.upsert({
        where: { metricId: SUMMARY_METRIC_ID },
        update: { data: summary },
        create: { metricId: SUMMARY_METRIC_ID, data: summary },
    });
}

export async function recomputeAndStoreCrystalBallSummary(
    season: number,
): Promise<CrystalBallSummary> {
    const summary = await computeCrystalBallSummary(season);
    await persistCrystalBallSummary(summary);
    return summary;
}

export async function getCrystalBallSummary(season: number): Promise<CrystalBallSummary> {
    const stored = await loadPersistedCrystalBallSummary();
    if (stored) {
        return stored;
    }

    return computeCrystalBallSummary(season);
}
