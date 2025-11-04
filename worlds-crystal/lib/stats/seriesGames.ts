import { prisma } from "@/lib/prisma";
import { BestOf, Prisma } from "@prisma/client";

const seriesGameSelect = {
    id: true,
    bestOf: true,
    gameInSeries: true,
    tournament: true,
    stage: true,
    blueTeam: true,
    redTeam: true,
    dateUtc: true,
} as const;

type SeriesGameRecord = Prisma.GameGetPayload<{ select: typeof seriesGameSelect }>;

type Scope = { tournament?: string; stage?: string };

type PlayedSeriesEntry = {
    bestOf: BestOf;
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
        select: seriesGameSelect,
    });

    const playedBySeries = new Map<string, PlayedSeriesEntry>();
    for (const game of games) {
        const key = seriesKey(game);
        const entry = playedBySeries.get(key) ?? {
            bestOf: game.bestOf,
            gamesPlayed: 0,
            maxGame: 0,
        };
        entry.gamesPlayed += 1;
        entry.maxGame = Math.max(entry.maxGame, game.gameInSeries);
        entry.bestOf = normalizeBestOf(entry.bestOf, game.bestOf, entry.maxGame);
        playedBySeries.set(key, entry);
    }

    const numberOfSeries = playedBySeries.size;
    const numberOfGames = games.length;

    const planned = await prisma.plannedSeries.findMany({
        where,
        select: { bestOf: true },
    });

    const totalPlannedSeries = planned.length;

    const playedEntries = Array.from(playedBySeries.values());
    const completedSeriesCount = playedEntries.filter(isSeriesComplete).length;
    const numberOfRemainingSeries = Math.max(0, totalPlannedSeries - completedSeriesCount);

    const maxGamesFor = (bo: BestOf) => (bo === "BO1" ? 1 : bo === "BO3" ? 3 : 5);

    const remainingGamesFromStarted = playedEntries
        .filter((entry) => !isSeriesComplete(entry))
        .map((entry) => Math.max(0, maxGamesFor(entry.bestOf) - entry.gamesPlayed))
        .reduce((acc, value) => acc + value, 0);

    const plannedCounts = new Map<BestOf, number>();
    for (const { bestOf } of planned) {
        plannedCounts.set(bestOf, (plannedCounts.get(bestOf) ?? 0) + 1);
    }

    const unmatchedEntries: PlayedSeriesEntry[] = [];
    for (const entry of playedEntries) {
        const count = plannedCounts.get(entry.bestOf) ?? 0;
        if (count > 0) {
            plannedCounts.set(entry.bestOf, count - 1);
        } else {
            unmatchedEntries.push(entry);
        }
    }

    const bestOfOrder: BestOf[] = [BestOf.BO5, BestOf.BO3, BestOf.BO1];
    for (const entry of unmatchedEntries) {
        for (const bo of bestOfOrder) {
            const count = plannedCounts.get(bo) ?? 0;
            if (count > 0) {
                plannedCounts.set(bo, count - 1);
                break;
            }
        }
    }

    const remainingGamesFromNotStarted = Array.from(plannedCounts.entries()).reduce(
        (acc, [bo, count]) => acc + count * maxGamesFor(bo),
        0,
    );

    const numberOfRemainingGames = remainingGamesFromStarted + remainingGamesFromNotStarted;

    return {
        numberOfSeries,
        numberOfGames,
        numberOfRemainingSeries,
        numberOfRemainingGames,
    };
}

function seriesKey(game: SeriesGameRecord): string {
    return [
        game.tournament,
        game.stage,
        game.blueTeam,
        game.redTeam,
        new Date(game.dateUtc).toDateString(),
    ].join("|");
}

function normalizeBestOf(current: BestOf, incoming: BestOf, observedMaxGame: number): BestOf {
    const maxObserved = observedMaxGame >= 5 ? BestOf.BO5 : observedMaxGame >= 3 ? BestOf.BO3 : BestOf.BO1;
    const rank = (bo: BestOf) => (bo === BestOf.BO1 ? 1 : bo === BestOf.BO3 ? 2 : 3);
    const candidates: BestOf[] = [current, incoming, maxObserved];
    return candidates.reduce((prev, next) => (rank(prev) >= rank(next) ? prev : next));
}

function isSeriesComplete(entry: PlayedSeriesEntry): boolean {
    if (entry.bestOf === BestOf.BO1) return entry.gamesPlayed >= 1;
    if (entry.bestOf === BestOf.BO3) return entry.gamesPlayed >= 2;
    return entry.gamesPlayed >= 3;
}
