import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

// Accepts either raw text body, or form-data with "csv" field
export async function POST(req: Request) {
    let csvText = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        csvText = String(form.get("csv") ?? "");
    } else {
        csvText = await req.text();
    }

    if (!csvText?.trim()) {
        return NextResponse.json({ ok: false, error: "No CSV provided" }, { status: 400 });
    }

    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = (parsed.data as any[]).filter(Boolean);

    // Expected columns (case-sensitive for now):
    // tournament,stage,dateUtc,patch,blueTeam,redTeam,winnerTeam,side,player,team,championKey,kills,deaths,assists,win
    const byKey = new Map<string, any[]>();
    for (const r of rows) {
        const key = `${r.tournament}|${r.stage}|${r.dateUtc}|${r.blueTeam}|${r.redTeam}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(r);
    }

    let createdGames = 0;
    const errors: string[] = [];

    for (const [, group] of byKey) {
        const g = group[0];

        try {
            const game = await prisma.game.create({
                data: {
                    tournament: String(g.tournament),
                    stage: String(g.stage),
                    dateUtc: new Date(String(g.dateUtc)),
                    patch: g.patch ? String(g.patch) : null,
                    blueTeam: String(g.blueTeam),
                    redTeam: String(g.redTeam),
                    winnerTeam: String(g.winnerTeam),
                },
            });

            for (const r of group) {
                // upsert player if provided
                let playerId: number | null = null;
                if (r.player && String(r.player).trim().length) {
                    const p = await prisma.player.upsert({
                        where: { handle: String(r.player) },
                        update: { team: r.team ? String(r.team) : null },
                        create: { handle: String(r.player), team: r.team ? String(r.team) : null },
                    });
                    playerId = p.id;
                }

                // find champion by key ("Aatrox", "Aurora", etc.)
                const champ = await prisma.champion.findUnique({
                    where: { key: String(r.championKey) },
                });

                if (!champ) {
                    errors.push(`Missing champion key: ${r.championKey}`);
                    continue;
                }

                await prisma.gameChampStats.create({
                    data: {
                        gameId: game.id,
                        side: String(r.side).toUpperCase() === "BLUE" ? "BLUE" : "RED",
                        playerId,
                        championId: champ.id,
                        kills: Number(r.kills ?? 0),
                        deaths: Number(r.deaths ?? 0),
                        assists: Number(r.assists ?? 0),
                        win:
                            String(r.win).toLowerCase() === "true" ||
                            String(r.win) === "1" ||
                            String(r.win).toLowerCase() === "yes",
                    },
                });
            }

            createdGames += 1;
        } catch (e: any) {
            errors.push(`Game create failed: ${e?.message ?? e}`);
        }
    }

    return NextResponse.json({ ok: true, games: createdGames, errors });
}
