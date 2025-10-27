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

    const gamesPlayed = await prisma.game.count({
        where: { ...whereBase, dateUtc: { lte: now } },
    });
    const gamesRemaining = await prisma.game.count({
        where: { ...whereBase, dateUtc: { gt: now } },
    });

    const seriesPlayed = (
        await prisma.game.groupBy({
            by: ["seriesKey"],
            where: { ...whereBase, dateUtc: { lte: now }, seriesKey: seriesKeyFilter },
            _count: { _all: true },
        })
    ).length;

    const seriesRemaining = (
        await prisma.game.groupBy({
            by: ["seriesKey"],
            where: { ...whereBase, dateUtc: { gt: now }, seriesKey: seriesKeyFilter },
            _count: { _all: true },
        })
    ).length;

    return {
        games: { played: gamesPlayed, remaining: gamesRemaining },
        series: { played: seriesPlayed, remaining: seriesRemaining },
    };
}
