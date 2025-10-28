import { prisma } from "@/lib/prisma";
import { BestOf } from "@prisma/client";

type Scope = { tournament?: string; stage?: string };

type PlayedSeriesEntry = {
    gamesPlayed: number;
    maxGame: number;
};

type StatsResult = {
    numberOfSeries: number;
    numberOfGames: number;
    numberOfRemainingSeries: number;
    numberOfRemainingGames: number;
};

export async function getSeriesAndGamesStats(scope: Scope = {}): Promise<StatsResult> {
    const where = {
        ...(scope.tournament ? { tournament: scope.tournament } : {}),
        ...(scope.stage ? { stage: scope.stage } : {}),
    };

    const games = await prisma.game.findMany({
        where,
        select: { seriesId: true, gameInSeries: true },
    });

    const playedBySeries = new Map<string, PlayedSeriesEntry>();
    for (const game of games) {
        const entry = playedBySeries.get(game.seriesId) ?? {
            gamesPlayed: 0,
            maxGame: 0,
        };
        entry.gamesPlayed += 1;
        entry.maxGame = Math.max(entry.maxGame, game.gameInSeries);
        playedBySeries.set(game.seriesId, entry);
    }

    const numberOfSeries = playedBySeries.size;
    const numberOfGames = games.length;

    const planned = await prisma.plannedSeries.findMany({
        where,
        select: { seriesId: true, bestOf: true },
    });

    const plannedMap = new Map(planned.map((p) => [p.seriesId, p.bestOf] as const));
    const totalPlannedSeries = plannedMap.size;

    const completedSeriesCount = Array.from(playedBySeries.entries()).filter(([seriesId, entry]) => {
        const plannedBestOf = plannedMap.get(seriesId) ?? inferBestOfFromObserved(entry.maxGame);
        return isSeriesComplete(entry, plannedBestOf);
    }).length;
    const numberOfRemainingSeries = Math.max(0, totalPlannedSeries - completedSeriesCount);

    const maxGamesFor = (bo: BestOf) => (bo === "BO1" ? 1 : bo === "BO3" ? 3 : 5);

    let remainingGamesFromStarted = 0;
    for (const [seriesId, entry] of playedBySeries.entries()) {
        const plannedBestOf = plannedMap.get(seriesId) ?? inferBestOfFromObserved(entry.maxGame);
        if (isSeriesComplete(entry, plannedBestOf)) {
            continue;
        }
        remainingGamesFromStarted += Math.max(0, maxGamesFor(plannedBestOf) - entry.gamesPlayed);
    }

    const remainingGamesFromNotStarted = Array.from(plannedMap.entries())
        .filter(([seriesId]) => !playedBySeries.has(seriesId))
        .map(([, bo]) => maxGamesFor(bo))
        .reduce((acc, value) => acc + value, 0);

    const numberOfRemainingGames = remainingGamesFromStarted + remainingGamesFromNotStarted;

    return {
        numberOfSeries,
        numberOfGames,
        numberOfRemainingSeries,
        numberOfRemainingGames,
    };
}

function inferBestOfFromObserved(observedMaxGame: number): BestOf {
    if (observedMaxGame >= 5) return BestOf.BO5;
    if (observedMaxGame >= 3) return BestOf.BO3;
    return BestOf.BO1;
}

function isSeriesComplete(entry: PlayedSeriesEntry, bestOf: BestOf): boolean {
    if (bestOf === BestOf.BO1) return entry.gamesPlayed >= 1;
    if (bestOf === BestOf.BO3) return entry.gamesPlayed >= 2;
    return entry.gamesPlayed >= 3;
}
