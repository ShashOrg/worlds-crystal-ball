import { prisma } from "@/lib/prisma";

export type WorldsScope = {
    tournament?: string;
    year?: number;
};

function worldsWhere({ tournament = "Worlds" }: WorldsScope = {}) {
    return {
        tournament: { contains: tournament, mode: "insensitive" },
    } as const;
}

export async function getLiveCounts(scope?: WorldsScope) {
    const now = new Date();
    const whereBase = worldsWhere(scope);
    const seriesFilter = { not: "" as const };

    const [gamesPlayed, gamesRemaining] = await Promise.all([
        prisma.game.count({ where: { ...whereBase, dateUtc: { lte: now } } }),
        prisma.game.count({ where: { ...whereBase, dateUtc: { gt: now } } }),
    ]);

    const [seriesPlayedGroups, seriesRemainingGroups] = await Promise.all([
        prisma.game.groupBy({
            by: ["seriesId"],
            where: { ...whereBase, dateUtc: { lte: now }, seriesId: seriesFilter },
            _count: { _all: true },
        }),
        prisma.game.groupBy({
            by: ["seriesId"],
            where: { ...whereBase, dateUtc: { gt: now }, seriesId: seriesFilter },
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
