import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type WorldsScope = {
    tournament?: string;
};

function whereFor(scope?: WorldsScope): Prisma.GameWhereInput {
    if (!scope?.tournament) return {};
    return {
        tournament: { contains: scope.tournament, mode: "insensitive" },
    } as const;
}

async function computeCounts(filter: Prisma.GameWhereInput, now: Date) {
    const [gamesPlayed, gamesRemaining] = await Promise.all([
        prisma.game.count({ where: { ...filter, dateUtc: { lte: now } } }),
        prisma.game.count({ where: { ...filter, dateUtc: { gt: now } } }),
    ]);

    const seriesFilter: Prisma.GameWhereInput = {
        ...filter,
        seriesId: { not: "" },
    };

    const [seriesPlayedGroups, seriesRemainingGroups] = await Promise.all([
        prisma.game.groupBy({
            by: ["seriesId"],
            where: { ...seriesFilter, dateUtc: { lte: now } },
            _count: { _all: true },
        }),
        prisma.game.groupBy({
            by: ["seriesId"],
            where: { ...seriesFilter, dateUtc: { gt: now } },
            _count: { _all: true },
        }),
    ]);

    return {
        games: { played: gamesPlayed, remaining: gamesRemaining },
        series: {
            played: seriesPlayedGroups.length,
            remaining: seriesRemainingGroups.length,
        },
    };
}

export async function getLiveCounts(scope?: WorldsScope) {
    const now = new Date();
    return computeCounts(whereFor(scope), now);
}
