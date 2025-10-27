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
    const seriesKeyFilter = { not: "" } as const;

    const [
        gamesPlayed,
        gamesRemaining,
        seriesPlayedGroups,
        seriesRemainingGroups,
    ] = await Promise.all([
        prisma.game.count({ where: { ...whereBase, dateUtc: { lte: now } } }),
        prisma.game.count({ where: { ...whereBase, dateUtc: { gt: now } } }),
        prisma.game.groupBy({
            by: ["seriesKey"],
            where: { ...whereBase, dateUtc: { lte: now }, seriesKey: seriesKeyFilter },
            _count: { _all: true },
        }),
        prisma.game.groupBy({
            by: ["seriesKey"],
            where: { ...whereBase, dateUtc: { gt: now }, seriesKey: seriesKeyFilter },
            _count: { _all: true },
        }),
    ] as const);

    const seriesPlayed = seriesPlayedGroups.length;
    const seriesRemaining = seriesRemainingGroups.length;

    return {
        games: { played: gamesPlayed, remaining: gamesRemaining },
        series: { played: seriesPlayed, remaining: seriesRemaining },
    };
}
