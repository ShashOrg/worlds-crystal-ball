import { prisma } from "@/lib/prisma";
import { buildSeriesId } from "@/utils/series";

async function main() {
    const games = await prisma.game.findMany({
        select: {
            id: true,
            tournament: true,
            stage: true,
            dateUtc: true,
            blueTeam: true,
            redTeam: true,
            seriesId: true,
            gameInSeries: true,
            seriesKey: true,
            seriesGameNo: true,
        },
    });

    for (const game of games) {
        const fixedGameInSeries = game.gameInSeries && game.gameInSeries > 0 ? game.gameInSeries : 1;
        const computedSeriesId = buildSeriesId({
            league: game.tournament,
            stage: game.stage,
            dateUtc: game.dateUtc,
            blueTeam: game.blueTeam,
            redTeam: game.redTeam,
        });

        const needsUpdate =
            game.seriesId !== computedSeriesId ||
            game.gameInSeries !== fixedGameInSeries ||
            game.seriesKey !== computedSeriesId ||
            game.seriesGameNo !== fixedGameInSeries;

        if (needsUpdate) {
            await prisma.game.update({
                where: { id: game.id },
                data: {
                    seriesId: computedSeriesId,
                    gameInSeries: fixedGameInSeries,
                    seriesKey: computedSeriesId,
                    seriesGameNo: fixedGameInSeries,
                },
            });
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
