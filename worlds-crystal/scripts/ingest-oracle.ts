import "dotenv/config";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

type Row = {
    gameid: string; side: "Blue"|"Red"; team: string; player: string;
    champion: string; kills: string; deaths: string; assists: string; result: "Win"|"Fail"|"Loss";
    date: string; stage: string; tournament: string; patch?: string;
};

// For production you’d fetch from a URL; start with a local CSV
async function main() {
    const csvPath = process.env.ORACLE_CSV_PATH || path.join(process.cwd(), "data", "oracle.csv");
    const text = await fs.readFile(csvPath, "utf-8");
    const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
    const byGame = new Map<string, Row[]>();
    for (const r of parsed.data) {
        if (!r.gameid) continue;
        const key = r.gameid;
        if (!byGame.has(key)) byGame.set(key, []);
        byGame.get(key)!.push(r);
    }

    for (const [id, rows] of byGame) {
        const g0 = rows[0];
        const dateUtc = new Date(g0.date);
        const winnerTeam = rows.find(r => r.result === "Win")?.team ?? rows[0].team;

        const game = await prisma.game.upsert({
            where: { id: BigInt(id) }, // or use a surrogate; adapt to your id scheme
            update: {},
            create: {
                id: BigInt(id),
                tournament: g0.tournament || "Worlds",
                stage: g0.stage || "Unknown",
                dateUtc,
                patch: g0.patch ?? null,
                blueTeam: rows.find(r => r.side === "Blue")?.team ?? "Blue",
                redTeam: rows.find(r => r.side === "Red")?.team ?? "Red",
                winnerTeam,
            },
        });

        for (const r of rows) {
            const champ = await prisma.champion.upsert({
                where: { key: r.champion },
                update: { name: r.champion },
                create: { key: r.champion, name: r.champion },
            });
            const player = await prisma.player.upsert({
                where: { handle: r.player },
                update: { team: r.team },
                create: { handle: r.player, team: r.team },
            });

            await prisma.gameChampStats.create({
                data: {
                    gameId: game.id,
                    side: r.side.toUpperCase() === "BLUE" ? "BLUE" : "RED",
                    playerId: player.id,
                    championId: champ.id,
                    kills: Number(r.kills || 0),
                    deaths: Number(r.deaths || 0),
                    assists: Number(r.assists || 0),
                    win: r.result === "Win",
                },
            });
        }
    }

    console.log(`Ingested ${byGame.size} games.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
