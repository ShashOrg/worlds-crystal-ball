import { prisma } from "@/lib/prisma";
import { parseSeriesFromOracleId } from "@/lib/oracle/series";

async function main() {
    const rows = await prisma.game.findMany({ where: { seriesKey: "" } });
    for (const game of rows) {
        if (!game.oracleGameId) continue;
        const { seriesKey, seriesGameNo } = parseSeriesFromOracleId(game.oracleGameId);
        await prisma.game.update({
            where: { id: game.id },
            data: { seriesKey, seriesGameNo },
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
