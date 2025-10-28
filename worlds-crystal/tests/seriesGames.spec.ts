import { afterEach, describe, expect, it, vi } from "vitest";

import { BestOf } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSeriesAndGamesStats } from "@/lib/stats/seriesGames";

describe("getSeriesAndGamesStats", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns series and game stats with remaining counts", async () => {
        const gameSpy = vi.spyOn(prisma.game, "findMany").mockResolvedValue(
            [
                { seriesId: "series-a", gameInSeries: 1 },
                { seriesId: "series-a", gameInSeries: 2 },
                { seriesId: "series-b", gameInSeries: 1 },
            ] as Array<{ seriesId: string; gameInSeries: number }>,
        );

        const plannedSpy = vi.spyOn(prisma.plannedSeries, "findMany").mockResolvedValue(
            [
                { seriesId: "series-a", bestOf: BestOf.BO3 },
                { seriesId: "series-b", bestOf: BestOf.BO3 },
                { seriesId: "series-c", bestOf: BestOf.BO5 },
            ] as Array<{ seriesId: string; bestOf: BestOf }>,
        );

        const result = await getSeriesAndGamesStats();

        expect(gameSpy).toHaveBeenCalled();
        expect(plannedSpy).toHaveBeenCalled();
        expect(result).toEqual({
            numberOfSeries: 2,
            numberOfGames: 3,
            numberOfRemainingSeries: 2,
            numberOfRemainingGames: 7,
        });
    });
});
