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
                {
                    id: 1n,
                    bestOf: BestOf.BO3,
                    gameInSeries: 1,
                    tournament: "worlds",
                    stage: "groups",
                    blueTeam: "team-a",
                    redTeam: "team-b",
                    dateUtc: new Date("2023-10-10T00:00:00Z"),
                },
                {
                    id: 2n,
                    bestOf: BestOf.BO3,
                    gameInSeries: 2,
                    tournament: "worlds",
                    stage: "groups",
                    blueTeam: "team-a",
                    redTeam: "team-b",
                    dateUtc: new Date("2023-10-10T03:00:00Z"),
                },
                {
                    id: 3n,
                    bestOf: BestOf.BO3,
                    gameInSeries: 1,
                    tournament: "worlds",
                    stage: "groups",
                    blueTeam: "team-c",
                    redTeam: "team-d",
                    dateUtc: new Date("2023-10-11T00:00:00Z"),
                },
            ] as Array<{
                id: bigint;
                bestOf: BestOf;
                gameInSeries: number;
                tournament: string;
                stage: string;
                blueTeam: string;
                redTeam: string;
                dateUtc: Date;
            }>,
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
